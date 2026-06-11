import { describe, expect, it } from 'vitest'
import { Engine } from '../engine/engine.ts'
import { INSTANT_SDF } from '../engine/types.ts'
import { enumerate } from './enumerate.ts'
import { executePlan } from './execute.ts'
import { FEATURES, internals, tslotCount } from './features.ts'
import type { FeatureInput } from './features.ts'
import { DEFAULT_CONTEXT, placementOutcome } from './outcome.ts'
import { planFor } from './path.ts'
import { positionFromRows } from './position.ts'

const { rowTransitions, columnTransitions, cumulativeWells, holeDepth, rowsWithHoles } = internals

const board = (rows: string[]) => positionFromRows(rows, 'T').board

// the bot-core TSD chamber: T rot2 spins into (0,38)(1,38)(2,38)(1,39)
const TSD_ROWS = ['X_________', '___XXXXXXX', 'X_XXXXXXXX']

function tsdPlacement(rows: string[] = TSD_ROWS) {
  const pos = positionFromRows(rows, 'T', { holdUsed: true })
  const tsd = enumerate(pos).find((p) => p.spin === 'full')
  expect(tsd).toBeDefined()
  return { pos, tsd: tsd! }
}

describe('board scans (hand-computed values)', () => {
  it('empty board: transitions are wall/floor constants, the rest zero', () => {
    const b = board([])
    expect(rowTransitions(b)).toBe(80) // 40 rows × 2 wall transitions
    expect(columnTransitions(b)).toBe(10) // 10 floor transitions
    expect(cumulativeWells(b)).toBe(0)
    expect(holeDepth(b)).toBe(0)
    expect(rowsWithHoles(b)).toBe(0)
  })

  it('alternating bottom row: 10 row transitions, five 1-deep wells', () => {
    const b = board(['X_X_X_X_X_'])
    expect(rowTransitions(b)).toBe(10 + 39 * 2)
    expect(columnTransitions(b)).toBe(10) // filled cols: 1 at the cell; empty cols: 1 at floor
    expect(cumulativeWells(b)).toBe(5) // cols 1,3,5,7,9 (right wall counts filled)
  })

  it('a 2-deep covered hole: holeDepth 2, one row with holes', () => {
    const b = board(['X_________', 'X_________', '_XXXXXXXXX'])
    expect(holeDepth(b)).toBe(2)
    expect(rowsWithHoles(b)).toBe(1)
  })

  it('a 3-deep interior well accumulates 1+2+3', () => {
    const b = board(['X_XXXXXXXX', 'X_XXXXXXXX', 'X_XXXXXXXX'])
    expect(cumulativeWells(b)).toBe(6)
  })
})

describe('placementOutcome', () => {
  it('TSD: clears 2, erodes 4 piece cells, sends 4 (6 with b2b)', () => {
    const { pos, tsd } = tsdPlacement()
    const out = placementOutcome(pos.board, tsd)
    expect(out.linesCleared).toBe(2)
    expect(out.erodedPieceCells).toBe(4) // all 4 T cells sat in the 2 cleared rows
    expect(out.difficult).toBe(true)
    expect(out.perfectClear).toBe(false)
    expect(out.attack).toBe(4) // tspin[2], no b2b
    const withB2b = placementOutcome(pos.board, tsd, { b2b: true, combo: -1 })
    expect(withB2b.attack).toBe(5) // +b2bBonus
  })

  it('agrees with a real Engine: board, lines, and attack', () => {
    const { pos, tsd } = tsdPlacement()
    const out = placementOutcome(pos.board, tsd)

    const e = new Engine({ seed: 1, mode: 'marathon', sdf: INSTANT_SDF })
    e.setQueue(['T', 'I', 'O'])
    e.setBoard(TSD_ROWS)
    e.start()
    executePlan(e, planFor(e.snapshot()!, tsd)!)
    const clear = e
      .takeEvents()
      .flatMap((ev) => (ev.kind === 'clear' ? [ev.info] : []))[0]

    expect(clear.lines).toBe(out.linesCleared)
    expect(clear.attack).toBe(out.attack)
    // engine board after lock+collapse equals the simulated outcome,
    // ignoring color vs garbage cell values (occupancy only)
    for (let i = 0; i < out.after.length; i++) {
      expect(out.after[i] === 0).toBe(e.board[i] === 0)
    }
  })
})

describe('feature functions on outcomes', () => {
  function inputFor(rows: string[], pick: 'tsd' | 'first') {
    const pos = positionFromRows(rows, 'T', { holdUsed: true })
    const all = enumerate(pos)
    const placement = pick === 'tsd' ? all.find((p) => p.spin === 'full')! : all[0]
    const outcome = placementOutcome(pos.board, placement)
    return {
      before: pos.board,
      after: outcome.after,
      placement,
      outcome,
      ctx: DEFAULT_CONTEXT,
    } satisfies FeatureInput
  }

  it('landingHeight is the height-from-bottom of the piece center', () => {
    const pos = positionFromRows([], 'I', { holdUsed: true })
    const flat = enumerate(pos).find((p) => p.rot === 0 && p.x === 0)!
    const outcome = placementOutcome(pos.board, flat)
    const i = { before: pos.board, after: outcome.after, placement: flat, outcome, ctx: DEFAULT_CONTEXT }
    expect(FEATURES.landingHeight(i)).toBe(0) // flat I on the floor
  })

  it('erodedPieceCells multiplies lines by eroded cells (TSD = 2×4)', () => {
    const i = inputFor(TSD_ROWS, 'tsd')
    expect(FEATURES.erodedPieceCells(i)).toBe(8)
    expect(FEATURES.linesCleared(i)).toBe(2)
    expect(FEATURES.attack(i)).toBe(4)
  })

  it('holesCreated goes negative when a clear uncovers nothing but removes rows', () => {
    const i = inputFor(TSD_ROWS, 'tsd')
    expect(FEATURES.holesCreated(i)).toBeLessThanOrEqual(0)
    expect(FEATURES.holes(i)).toBe(0) // the TSD leaves a clean board + the stray X
  })

  it('b2bBroken fires only on a live chain broken by a plain clear', () => {
    const { pos, tsd } = tsdPlacement()
    const outcome = placementOutcome(pos.board, tsd, { b2b: true, combo: -1 })
    const i = { before: pos.board, after: outcome.after, placement: tsd, outcome, ctx: { b2b: true, combo: -1 } }
    expect(FEATURES.b2bBroken(i)).toBe(0) // a TSD extends, never breaks
  })
})

describe('tslotCount', () => {
  it('sees the (overhung) TSD slot before the spin and not after', () => {
    const { pos, tsd } = tsdPlacement()
    expect(tslotCount(pos.board)).toBe(1)
    expect(tslotCount(placementOutcome(pos.board, tsd).after)).toBe(0)
  })

  it('is zero on an empty board', () => {
    expect(tslotCount(board([]))).toBe(0)
  })
})
