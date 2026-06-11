import { Engine } from '../engine/engine.ts'
import { INSTANT_SDF } from '../engine/types.ts'
import type { GameStatus } from '../engine/types.ts'
import { executePlan } from './execute.ts'
import type { EvalProfile } from './profiles.ts'
import { suggest } from './suggest.ts'
import type { SuggestOptions } from './suggest.ts'

/**
 * Greedy self-play (specs/bot-eval.md M2): suggest()[0] → executePlan,
 * whole games, headless. The tuning and regression instrument — profile
 * differences must show up *behaviorally* here, not just in scores.
 *
 * Benchmark modes are level-1 only (plans assume inputs-faster-than-
 * gravity): sprint | cheese | endless ('endless' = survival with the
 * rise timer effectively off — the open-ended playground).
 */

export type BenchMode = 'sprint' | 'cheese' | 'endless'

export interface GameResult {
  seed: number
  mode: BenchMode
  status: GameStatus
  pieces: number
  lines: number
  /** sum of ClearInfo.attack (pre-cancellation) */
  attack: number
  attackPerPiece: number
  /** simulated time, ms */
  simMs: number
}

export function playGame(
  profile: EvalProfile,
  opts: { seed: number; mode: BenchMode; maxPieces?: number; lookahead?: SuggestOptions['lookahead'] },
): GameResult {
  const maxPieces = opts.maxPieces ?? 300
  const e =
    opts.mode === 'endless'
      ? new Engine({ seed: opts.seed, mode: 'survival', sdf: INSTANT_SDF, riseStartMs: 1e9 })
      : new Engine({ seed: opts.seed, mode: opts.mode, sdf: INSTANT_SDF })
  e.start()

  let pieces = 0
  let attack = 0
  while (e.status === 'playing' && pieces < maxPieces) {
    const pos = e.snapshot()
    if (!pos) break
    // live context straight from the engine's public counters
    const context = { b2b: e.b2b >= 0, combo: e.combo }
    const top = suggest(pos, profile, { context, lookahead: opts.lookahead })[0]
    executePlan(e, top.plan)
    for (const ev of e.takeEvents()) {
      if (ev.kind === 'clear') attack += ev.info.attack
    }
    pieces++
  }

  return {
    seed: opts.seed,
    mode: opts.mode,
    status: e.status,
    pieces,
    lines: e.lines,
    attack,
    attackPerPiece: pieces > 0 ? attack / pieces : 0,
    simMs: e.elapsed,
  }
}

export function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 === 1 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}
