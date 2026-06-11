import { bumpiness, playerHoles } from './board.ts'
import { Engine } from './engine.ts'
import { buildFinesseTable } from './finesse-gen.ts'
import type { FinesseTable } from './finesse-gen.ts'
import { optimalInputs } from './finesse.ts'
import type { Replay } from './replay.ts'
import { Match, ScriptedPressureOpponent } from './versus.ts'
import type { GameEvent, GameStatus, PieceType, Rot } from './types.ts'

/**
 * Derived replay stats (spec training-core §4): resimulate a recorded
 * game headlessly and measure what the scoreboard can't — input
 * efficiency and stacking discipline, per piece and aggregated. Consumers:
 * Progress (skill measurement), the future Review surface, and lesson
 * pass conditions that reference real-game tendencies.
 *
 * Input fidelity comes from `Replay.presses` (physical keydowns; DAS/ARR
 * repeats appear only in `actions`). Replays recorded before that field
 * existed still analyze — `kpp`/finesse fields come back null.
 *
 * Finesse grading mirrors the live rule (controller.ts): pieces that used
 * soft drop aren't graded (tucks/spins legitimately need extra inputs),
 * a fault is `presses > optimal`. The optimum is the no-180 teaching
 * table (finesse-gen.ts) unless the player pressed 180 on that piece, in
 * which case the 180-aware optimum (finesse.ts) applies — neither input
 * style is penalized for the other's standard.
 */

export interface PieceStat {
  index: number
  /** sim step of the lock */
  step: number
  type: PieceType
  rot: Rot
  x: number
  /** movement+rotation presses spent on this piece (null without press data) */
  presses: number | null
  /** the optimum this piece was graded against */
  optimal: number
  /** null = not graded (soft drop used, or no press data) */
  fault: boolean | null
  /** player-made holes delta at this lock (cheese terrain excluded) */
  holesDelta: number
  /** surface bumpiness after this lock */
  bumpiness: number
}

export interface ReplayStats {
  /** resimulated outcome matches the recorded summary (determinism check) */
  verified: boolean
  pieces: number
  /** total physical keypresses / pieces, the live-KPP definition */
  kpp: number | null
  finesseFaults: number | null
  /** faults / finesse-graded pieces */
  faultRate: number | null
  /** Σ positive player-hole deltas across the game */
  holesCreated: number
  roughness: { mean: number; max: number; timeline: number[] }
  /** cheese mode only (null otherwise/with nothing cleared): the
   *  community blocks-per-100-lines downstack metric */
  downstack: { cheeseCleared: number; blocksPer100: number } | null
  final: { status: GameStatus; score: number; lines: number; pieces: number; elapsedMs: number }
  perPiece: PieceStat[]
}

let teachingTable: FinesseTable | null = null

function noR180Optimal(type: PieceType, rot: Rot, x: number): number {
  teachingTable ??= buildFinesseTable()
  return teachingTable.pieces[type][`${rot}:${x}`]?.count ?? 0
}

const FINESSE_PRESSES = new Set(['left', 'right', 'cw', 'ccw', 'r180'])

/** Resimulate a replay step-by-step and derive per-piece + aggregate stats. */
export function analyzeReplay(replay: Replay): ReplayStats {
  let engine: Engine
  let match: Match | null = null
  if (replay.config.mode === 'battle') {
    if (!replay.opponent) {
      throw new Error('battle replay lacks its opponent config (recorded before M6)')
    }
    match = new Match(replay.config, new ScriptedPressureOpponent(replay.opponent))
    engine = match.engine
    match.start()
  } else {
    engine = new Engine(replay.config)
    engine.start()
  }

  const hasPresses = replay.presses !== undefined
  const presses = replay.presses ?? []
  const perPiece: PieceStat[] = []
  let a = 0
  let s = 0
  let p = 0
  // the current piece's press window (advanced at each lock/hold)
  let windowMoves = 0
  let windowSoft = false
  let windowR180 = false
  let prevHoles = playerHoles(engine.board)

  /** consume presses stamped up to and including `step` into the window */
  const consumePresses = (step: number) => {
    while (p < presses.length && presses[p][0] <= step) {
      const action = presses[p][1]
      if (FINESSE_PRESSES.has(action)) windowMoves++
      if (action === 'softDropOn') windowSoft = true
      if (action === 'r180') windowR180 = true
      p++
    }
  }

  const handleEvents = (events: GameEvent[], step: number) => {
    for (const ev of events) {
      if (ev.kind === 'hold') {
        // inputs spent pre-hold aren't the next piece's (live rule)
        consumePresses(step)
        windowMoves = 0
        windowSoft = false
        windowR180 = false
      } else if (ev.kind === 'lock') {
        consumePresses(step)
        const { type, rot, x } = ev.piece
        const optimal = windowR180 ? optimalInputs(type, rot, x) : noR180Optimal(type, rot, x)
        const holesNow = playerHoles(engine.board)
        perPiece.push({
          index: perPiece.length,
          step,
          type,
          rot,
          x,
          presses: hasPresses ? windowMoves : null,
          optimal,
          fault: hasPresses && !windowSoft ? windowMoves > optimal : null,
          holesDelta: holesNow - prevHoles,
          bumpiness: bumpiness(engine.board),
        })
        prevHoles = holesNow
        windowMoves = 0
        windowSoft = false
        windowR180 = false
      }
    }
  }

  for (let step = 0; step < replay.endStep; step++) {
    while (s < replay.sdfChanges.length && replay.sdfChanges[s][0] === step) {
      engine.cfg.sdf = replay.sdfChanges[s][1]
      s++
    }
    while (a < replay.actions.length && replay.actions[a][0] === step) {
      engine.applyAction(replay.actions[a][1])
      a++
    }
    if (match) match.tick(replay.stepMs)
    else engine.tick(replay.stepMs)
    handleEvents(match ? match.takeEvents() : engine.takeEvents(), step)
  }

  const pieces = engine.piecesPlaced
  const graded = perPiece.filter((x) => x.fault !== null)
  const faults = graded.filter((x) => x.fault).length
  const timeline = perPiece.map((x) => x.bumpiness)
  const cheeseCleared =
    replay.config.mode === 'cheese' ? replay.config.cheeseTotal - engine.cheeseLeft() : 0

  return {
    verified:
      engine.status === replay.summary.status &&
      engine.score === replay.summary.score &&
      engine.lines === replay.summary.lines &&
      pieces === replay.summary.pieces,
    pieces,
    kpp: hasPresses && pieces > 0 ? presses.length / pieces : null,
    finesseFaults: hasPresses ? faults : null,
    faultRate: hasPresses && graded.length > 0 ? faults / graded.length : null,
    holesCreated: perPiece.reduce((sum, x) => sum + Math.max(0, x.holesDelta), 0),
    roughness: {
      mean: timeline.length > 0 ? timeline.reduce((q, v) => q + v, 0) / timeline.length : 0,
      max: timeline.length > 0 ? Math.max(...timeline) : 0,
      timeline,
    },
    downstack:
      cheeseCleared > 0
        ? { cheeseCleared, blocksPer100: (pieces / cheeseCleared) * 100 }
        : null,
    final: {
      status: engine.status,
      score: engine.score,
      lines: engine.lines,
      pieces,
      elapsedMs: engine.elapsed,
    },
    perPiece,
  }
}
