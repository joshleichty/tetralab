import { describe, expect, it } from 'vitest'
import { PROFILES } from './profiles.ts'
import type { EvalProfile } from './profiles.ts'
import { median, playGame } from './selfplay.ts'

/**
 * Pinned self-play benchmarks (specs/bot-eval.md M2). Everything is
 * seeded and deterministic, so these are exact regression gates, not
 * statistical tests. Bounds pinned 2026-06-10 after measuring on the
 * seed pool — observed: sprint completion 10/10 (dellacherie & clean);
 * cheese median pieces clean 87.5 vs versus 134; endless attack/piece
 * versus 0.285 vs dellacherie 0.0275; lookahead-1 cheese median 70.5 vs
 * greedy 87.5. Bounds keep ≥2× slack: a failure is a real behavioral
 * regression in features/profiles/search.
 */

const SEEDS = [1000, 1001, 1002, 1003, 1004]
const PAIRED_SEEDS = [1000, 1001, 1002]
const SLOW = 60_000

describe('pinned self-play benchmarks', () => {
  it('calibration: published dellacherie weights complete sprint-40 on every seed', () => {
    for (const seed of SEEDS) {
      const r = playGame(PROFILES.dellacherie, { seed, mode: 'sprint', maxPieces: 250 })
      expect(r.status, `seed ${seed}`).toBe('won')
    }
  }, SLOW)

  it('behavioral split: clean out-digs versus on cheese (paired seeds)', () => {
    let cleanTotal = 0
    let versusTotal = 0
    for (const seed of PAIRED_SEEDS) {
      const c = playGame(PROFILES.clean, { seed, mode: 'cheese' })
      expect(c.status, `clean seed ${seed}`).toBe('won')
      cleanTotal += c.pieces
      versusTotal += playGame(PROFILES.versus, { seed, mode: 'cheese' }).pieces
    }
    expect(cleanTotal).toBeLessThan(versusTotal)
  }, SLOW)

  it('behavioral split: versus out-attacks dellacherie on the endless playground', () => {
    const app = (p: EvalProfile) =>
      median(
        SEEDS.map((seed) => playGame(p, { seed, mode: 'endless', maxPieces: 120 }).attackPerPiece),
      )
    const v = app(PROFILES.versus)
    expect(v).toBeGreaterThan(2 * app(PROFILES.dellacherie))
    expect(v).toBeGreaterThan(0.15)
  }, SLOW)

  it('depth pays: lookahead-1 digs cheese in fewer total pieces than greedy', () => {
    let greedy = 0
    let deep = 0
    for (const seed of PAIRED_SEEDS) {
      greedy += playGame(PROFILES.clean, { seed, mode: 'cheese' }).pieces
      deep += playGame(PROFILES.clean, { seed, mode: 'cheese', lookahead: 1 }).pieces
    }
    expect(deep).toBeLessThan(greedy)
  }, SLOW)
})
