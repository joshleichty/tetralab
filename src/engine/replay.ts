import { Engine } from './engine'
import type { Action, EngineConfig, GameStatus } from './types'

/**
 * Replay recording (Decision D5 in docs/parity.md: record now, view later).
 *
 * A replay is `{engine version, full config (seed included), fixed-step
 * action log}` — replays re-simulate on the deterministic engine, no board
 * state is stored (docs/quality-bar.md §5.3). The whole stack runs on a
 * fixed timestep (`STEP_MS`); actions are stamped with the step index they
 * preceded, so playback is exact by construction. The same step grid is
 * the substrate for lockstep netcode (spec Phase 4).
 */

/** bump when engine rules change in any state-visible way; gates playback */
export const REPLAY_VERSION = 1

/** fixed simulation timestep, ms (200 steps/sec) */
export const STEP_MS = 5

export interface Replay {
  version: number
  /** full engine config, seed and mode included */
  config: EngineConfig
  stepMs: number
  /** actions in dispatch order, each stamped with the step it ran before */
  actions: Array<[step: number, action: Action]>
  /** mid-game soft-drop-factor edits (settings changed while paused) */
  sdfChanges: Array<[step: number, sdf: number]>
  /** number of steps simulated */
  endStep: number
  /** denormalized outcome for list display; never used in playback */
  summary: { status: GameStatus; score: number; lines: number; pieces: number }
  /** wall-clock stamp added by the persistence layer (engine stays pure) */
  recordedAt?: number
}

export class ReplayRecorder {
  private readonly config: EngineConfig
  private readonly actions: Array<[number, Action]> = []
  private readonly sdfChanges: Array<[number, number]> = []

  constructor(config: EngineConfig) {
    this.config = { ...config }
  }

  record(step: number, action: Action) {
    this.actions.push([step, action])
  }

  recordSdf(step: number, sdf: number) {
    this.sdfChanges.push([step, sdf])
  }

  finish(engine: Engine, endStep: number): Replay {
    return {
      version: REPLAY_VERSION,
      config: this.config,
      stepMs: STEP_MS,
      actions: this.actions,
      sdfChanges: this.sdfChanges,
      endStep,
      summary: {
        status: engine.status,
        score: engine.score,
        lines: engine.lines,
        pieces: engine.piecesPlaced,
      },
    }
  }
}

/**
 * Re-simulate a replay and return the final engine. Identical to the
 * recorded game by the determinism invariant (same seed, same step grid,
 * same action order).
 */
export function simulateReplay(replay: Replay): Engine {
  if (replay.version !== REPLAY_VERSION) {
    throw new Error(
      `replay version ${replay.version} does not match engine version ${REPLAY_VERSION}`,
    )
  }
  const engine = new Engine(replay.config)
  engine.start()
  let a = 0
  let s = 0
  for (let step = 0; step < replay.endStep; step++) {
    while (s < replay.sdfChanges.length && replay.sdfChanges[s][0] === step) {
      engine.cfg.sdf = replay.sdfChanges[s][1]
      s++
    }
    while (a < replay.actions.length && replay.actions[a][0] === step) {
      engine.applyAction(replay.actions[a][1])
      a++
    }
    engine.tick(replay.stepMs)
  }
  return engine
}
