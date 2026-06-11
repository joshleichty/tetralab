import { Engine } from './engine.ts'
import { Match, ScriptedPressureOpponent } from './versus.ts'
import type { ScriptedPressureConfig } from './versus.ts'
import type { Action, EngineConfig, GameStatus } from './types.ts'

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
  /**
   * Physical keydowns (no DAS/ARR repeats), stamped like actions. Never
   * used in playback — the input-fidelity layer for derived stats (KPP,
   * finesse faults; stats.ts). Optional: replays recorded before M1
   * lack it and analyze with degraded fidelity.
   */
  presses?: Array<[step: number, action: Action]>
  /** number of steps simulated */
  endStep: number
  /**
   * battle mode: the scripted opponent's config. The opponent is fully
   * deterministic on the same step grid, so its config alone makes
   * playback self-contained — no opponent timing log is needed (M6
   * design; online matches record both action streams instead, see
   * `MatchReplay` in src/net/lockstep.ts).
   */
  opponent?: ScriptedPressureConfig
  /** denormalized outcome for list display; never used in playback */
  summary: { status: GameStatus; score: number; lines: number; pieces: number }
  /** wall-clock stamp added by the persistence layer (engine stays pure) */
  recordedAt?: number
}

export class ReplayRecorder {
  private readonly config: EngineConfig
  private readonly actions: Array<[number, Action]> = []
  private readonly sdfChanges: Array<[number, number]> = []
  private readonly presses: Array<[number, Action]> = []
  private opponent: ScriptedPressureConfig | undefined

  constructor(config: EngineConfig) {
    this.config = { ...config }
  }

  record(step: number, action: Action) {
    this.actions.push([step, action])
  }

  recordSdf(step: number, sdf: number) {
    this.sdfChanges.push([step, sdf])
  }

  /** log a physical keydown (see Replay.presses) */
  recordPress(step: number, action: Action) {
    this.presses.push([step, action])
  }

  /** battle mode: snapshot the scripted opponent's config (see Replay.opponent) */
  setOpponent(cfg: ScriptedPressureConfig) {
    this.opponent = { ...cfg }
  }

  finish(engine: Engine, endStep: number): Replay {
    return {
      version: REPLAY_VERSION,
      config: this.config,
      stepMs: STEP_MS,
      actions: this.actions,
      sdfChanges: this.sdfChanges,
      presses: this.presses,
      endStep,
      opponent: this.opponent,
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
 * same action order). Battle replays rebuild the scripted opponent from
 * its recorded config and drive a `Match`, mirroring `GameController`
 * exactly: actions go straight to the engine (the controller bypasses
 * `Match.applyAction`), then `match.tick` runs — so attack routing and
 * opponent bursts land on the same step they did live.
 */
export function simulateReplay(replay: Replay): Engine {
  if (replay.version !== REPLAY_VERSION) {
    throw new Error(
      `replay version ${replay.version} does not match engine version ${REPLAY_VERSION}`,
    )
  }
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
    if (match) match.tick(replay.stepMs)
    else engine.tick(replay.stepMs)
  }
  return engine
}
