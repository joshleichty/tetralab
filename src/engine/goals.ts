import { bumpiness, isWellPure, playerHoles } from './board.ts'
import type { Engine } from './engine.ts'
import type { GameEvent } from './types.ts'

/**
 * GoalSpecs: declarative pass/fail conditions for lesson challenges,
 * compiled to evaluators that watch engine state + drained events.
 * One definition, two consumers: the lesson runtime judges challenges
 * with these, and the same predicates later serve as RL reward
 * components (bot stream).
 *
 * Usage: create the evaluator when the challenge starts (it baselines
 * against the current board), then feed it every drained event batch —
 * at least once per piece lock, which the fixed-step loop guarantees.
 */

export type GoalSpec =
  /** place `pieces` pieces without ever increasing the player-made hole
   *  count (playerHoles: cheese/garbage terrain doesn't count, sealing a
   *  column you still need does — works on downstacking boards too) */
  | { kind: 'noNewHoles'; pieces: number }
  /** clear `n` lines total; with `label`, only clears matching the
   *  ClearInfo label count (e.g. 'T-SPIN DOUBLE', 'QUAD') */
  | { kind: 'clearLines'; n: number; label?: string }
  /** get surface bumpiness down to `value` or less; with `pieces`,
   *  fail if it takes more than that many pieces */
  | { kind: 'maxBumpiness'; value: number; ignoreColumn?: number; pieces?: number }
  /** keep the well column completely empty for `pieces` pieces */
  | { kind: 'wellPure'; column: number; pieces: number }

export type GoalState = 'pending' | 'passed' | 'failed'

export interface GoalEvaluator {
  readonly spec: GoalSpec
  readonly state: GoalState
  /** pieces locked since the evaluator was created */
  readonly piecesUsed: number
  /** feed freshly drained events; returns the (possibly settled) state */
  observe(events: GameEvent[]): GoalState
}

export function compileGoal(spec: GoalSpec, engine: Engine): GoalEvaluator {
  switch (spec.kind) {
    case 'noNewHoles':
      return new Evaluator(spec, engine, {
        baseline: (e) => ({ holes: playerHoles(e.board) }),
        onLock(e, memo: { holes: number }) {
          const now = playerHoles(e.board)
          if (now > memo.holes) return 'failed'
          memo.holes = now
          return null
        },
        passAfterPieces: spec.pieces,
      })
    case 'clearLines':
      return new Evaluator(spec, engine, {
        baseline: () => ({ cleared: 0 }),
        onEvent(_e, ev, memo: { cleared: number }) {
          if (ev.kind !== 'clear') return null
          if (spec.label !== undefined && ev.info.label !== spec.label) return null
          memo.cleared += ev.info.lines
          return memo.cleared >= spec.n ? 'passed' : null
        },
      })
    case 'maxBumpiness':
      return new Evaluator(spec, engine, {
        baseline: () => ({}),
        onLock(e) {
          return bumpiness(e.board, spec.ignoreColumn) <= spec.value ? 'passed' : null
        },
        failAfterPieces: spec.pieces,
      })
    case 'wellPure':
      return new Evaluator(spec, engine, {
        baseline: () => ({}),
        onLock(e) {
          return isWellPure(e.board, spec.column) ? null : 'failed'
        },
        passAfterPieces: spec.pieces,
      })
  }
}

interface GoalHooks<M> {
  baseline: (engine: Engine) => M
  /** called once per lock event, after the board has settled (post-clear) */
  onLock?: (engine: Engine, memo: M) => GoalState | null
  /** called for every event */
  onEvent?: (engine: Engine, ev: GameEvent, memo: M) => GoalState | null
  /** pass once this many pieces locked without failing */
  passAfterPieces?: number
  /** fail once this many pieces locked without passing */
  failAfterPieces?: number
}

class Evaluator<M> implements GoalEvaluator {
  state: GoalState = 'pending'
  piecesUsed = 0
  readonly spec: GoalSpec
  private readonly engine: Engine
  private readonly hooks: GoalHooks<M>
  private readonly memo: M

  constructor(spec: GoalSpec, engine: Engine, hooks: GoalHooks<M>) {
    this.spec = spec
    this.engine = engine
    this.hooks = hooks
    this.memo = hooks.baseline(engine)
  }

  observe(events: GameEvent[]): GoalState {
    if (this.state !== 'pending') return this.state
    for (const ev of events) {
      if (ev.kind === 'gameover') {
        this.state = 'failed'
        return this.state
      }
      const fromEvent = this.hooks.onEvent?.(this.engine, ev, this.memo)
      if (fromEvent) {
        this.state = fromEvent
        return this.state
      }
      if (ev.kind === 'lock') {
        this.piecesUsed++
        const fromLock = this.hooks.onLock?.(this.engine, this.memo)
        if (fromLock) {
          this.state = fromLock
          return this.state
        }
        if (this.hooks.passAfterPieces !== undefined && this.piecesUsed >= this.hooks.passAfterPieces) {
          this.state = 'passed'
          return this.state
        }
        if (this.hooks.failAfterPieces !== undefined && this.piecesUsed >= this.hooks.failAfterPieces) {
          this.state = 'failed'
          return this.state
        }
      }
    }
    return this.state
  }
}
