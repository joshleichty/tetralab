import { bumpiness, holes, stackHeight, wellDepth } from '../engine/board.ts'
import { BOARD_H, BOARD_W, CELLS, fits } from '../engine/pieces.ts'
import { detectTSpin } from '../engine/spin.ts'
import type { EvalContext, PlacementOutcome } from './outcome.ts'
import type { Placement } from './types.ts'

/**
 * L3 feature layer (specs/bot-eval.md): named pure functions over a
 * placement's outcome. The registry is the contract — every feature has
 * a name, a doc line, and a hand-computed-board test. Two families:
 *
 * - Published predictive features (Dellacherie via [codemyroad]/
 *   [Thiery & Scherrer 2009 "BCTS"]) — definitions follow the standard
 *   formulations; where the literature has variants (cumulativeWells),
 *   the test pins our choice and the sprint-40 calibration benchmark
 *   (M2) is the fidelity check.
 * - Concept-named features carrying the human vocabulary (holesCreated,
 *   tslots, b2bBroken…) — the seed of L4's explanation layer.
 *
 * All board-shape features evaluate the *resulting* board (`after`),
 * matching the published setups.
 */

export interface FeatureInput {
  before: Uint8Array
  after: Uint8Array
  placement: Placement
  outcome: PlacementOutcome
  ctx: EvalContext
}

const filled = (b: Uint8Array, x: number, y: number) => b[y * BOARD_W + x] !== 0

/** empty↔filled transitions along each row; side walls count as filled */
function rowTransitions(b: Uint8Array): number {
  let count = 0
  for (let y = 0; y < BOARD_H; y++) {
    let prev = true // left wall
    for (let x = 0; x < BOARD_W; x++) {
      const cur = filled(b, x, y)
      if (cur !== prev) count++
      prev = cur
    }
    if (!prev) count++ // right wall
  }
  return count
}

/** empty↔filled transitions down each column; sky empty, floor filled */
function columnTransitions(b: Uint8Array): number {
  let count = 0
  for (let x = 0; x < BOARD_W; x++) {
    let prev = false // above the board
    for (let y = 0; y < BOARD_H; y++) {
      const cur = filled(b, x, y)
      if (cur !== prev) count++
      prev = cur
    }
    if (!prev) count++ // floor
  }
  return count
}

/**
 * Dellacherie cumulative wells: a well cell is empty with both horizontal
 * neighbors filled (walls filled); each maximal vertical run of depth d
 * contributes 1+2+…+d.
 */
function cumulativeWells(b: Uint8Array): number {
  let sum = 0
  for (let x = 0; x < BOARD_W; x++) {
    let run = 0
    for (let y = 0; y < BOARD_H; y++) {
      const isWell =
        !filled(b, x, y) &&
        (x === 0 || filled(b, x - 1, y)) &&
        (x === BOARD_W - 1 || filled(b, x + 1, y))
      if (isWell) {
        run++
      } else {
        sum += (run * (run + 1)) / 2
        run = 0
      }
    }
    sum += (run * (run + 1)) / 2
  }
  return sum
}

/** BCTS hole depth: for each hole, the filled cells above it in its column */
function holeDepth(b: Uint8Array): number {
  let sum = 0
  for (let x = 0; x < BOARD_W; x++) {
    let above = 0
    for (let y = 0; y < BOARD_H; y++) {
      if (filled(b, x, y)) above++
      else if (above > 0) sum += above
    }
  }
  return sum
}

/** BCTS rows with holes: rows containing at least one covered empty cell */
function rowsWithHoles(b: Uint8Array): number {
  const holeRows = new Set<number>()
  for (let x = 0; x < BOARD_W; x++) {
    let covered = false
    for (let y = 0; y < BOARD_H; y++) {
      if (filled(b, x, y)) covered = true
      else if (covered) holeRows.add(y)
    }
  }
  return holeRows.size
}

/**
 * Count distinct full-T-spin rest positions (rot 2, the canonical TSD
 * orientation) whose lock would clear at least one line. Exported for
 * its own tests; the single `tslots` feature suffices for ranking —
 * every candidate shares the same before-board, so "created" and
 * "wasted" both show up as the after-count moving.
 */
export function tslotCount(b: Uint8Array): number {
  let count = 0
  const cells = CELLS['T'][2]
  // every grounded rot-2 fit, not just straight-drop-reachable ones:
  // canonical TSD slots sit under their overhang, and a slot still being
  // built (or one a kick would enter) should count toward the reward
  for (let x = 0; x <= BOARD_W - 3; x++) {
    for (let y = 0; y < BOARD_H; y++) {
      if (!fits(b, 'T', 2, x, y)) continue
      if (fits(b, 'T', 2, x, y + 1)) continue // not grounded
      if (detectTSpin(b, { rot: 2, x, y }, true, 0) !== 'full') continue
      // would it clear? check the rows the T occupies, with its cells filled
      const tCells = new Set(cells.map(([dx, dy]) => `${x + dx},${y + dy}`))
      let clears = false
      for (const dy of [1, 2]) {
        const row = y + dy
        let full = true
        for (let cx = 0; cx < BOARD_W; cx++) {
          if (!filled(b, cx, row) && !tCells.has(`${cx},${row}`)) {
            full = false
            break
          }
        }
        if (full) {
          clears = true
          break
        }
      }
      if (clears) count++
    }
  }
  return count
}

export const FEATURES = {
  // ── published set ────────────────────────────────────────────────
  /** height-from-bottom of the piece's vertical center at lock [Dellacherie] */
  landingHeight: (i: FeatureInput) => {
    const ys = i.placement.cells.map(([, y]) => y)
    return BOARD_H - 1 - (Math.min(...ys) + Math.max(...ys)) / 2
  },
  /** lines cleared × placed-piece cells in the cleared rows [Dellacherie] */
  erodedPieceCells: (i: FeatureInput) => i.outcome.linesCleared * i.outcome.erodedPieceCells,
  /** row transitions, walls filled [Dellacherie] */
  rowTransitions: (i: FeatureInput) => rowTransitions(i.after),
  /** column transitions, sky empty / floor filled [Dellacherie] */
  columnTransitions: (i: FeatureInput) => columnTransitions(i.after),
  /** covered empty cells [Dellacherie; engine/board.ts] */
  holes: (i: FeatureInput) => holes(i.after),
  /** cumulative well cells, 1+2+…+depth per well [Dellacherie] */
  cumulativeWells: (i: FeatureInput) => cumulativeWells(i.after),
  /** sum over holes of filled cells above [BCTS] */
  holeDepth: (i: FeatureInput) => holeDepth(i.after),
  /** rows containing at least one hole [BCTS] */
  rowsWithHoles: (i: FeatureInput) => rowsWithHoles(i.after),

  // ── concept-named set ────────────────────────────────────────────
  /** lines this placement clears */
  linesCleared: (i: FeatureInput) => i.outcome.linesCleared,
  /** holes after minus holes before — negative when digging pays off */
  holesCreated: (i: FeatureInput) => holes(i.after) - holes(i.before),
  /** tallest column after [engine/board.ts] */
  maxHeight: (i: FeatureInput) => stackHeight(i.after),
  /** surface roughness after [engine/board.ts] */
  bumpiness: (i: FeatureInput) => bumpiness(i.after),
  /** depth of the deepest well after — rewards keeping a quad well */
  deepestWell: (i: FeatureInput) => {
    let max = 0
    for (let x = 0; x < BOARD_W; x++) max = Math.max(max, wellDepth(i.after, x))
    return max
  },
  /** line-clearing full-T-spin slots present after (rot-2 TSD shapes) */
  tslots: (i: FeatureInput) => tslotCount(i.after),
  /** 1 if this placement breaks a live back-to-back chain */
  b2bBroken: (i: FeatureInput) =>
    i.ctx.b2b && i.outcome.linesCleared > 0 && !i.outcome.difficult ? 1 : 0,
  /** 1 if this clear extends a live combo */
  comboContinued: (i: FeatureInput) => (i.ctx.combo >= 0 && i.outcome.linesCleared > 0 ? 1 : 0),
  /** attack sent (tetra's table, context-aware) */
  attack: (i: FeatureInput) => i.outcome.attack,
  /** 1 on perfect clear */
  perfectClear: (i: FeatureInput) => (i.outcome.perfectClear ? 1 : 0),
} as const

export type FeatureName = keyof typeof FEATURES

export const FEATURE_NAMES = Object.keys(FEATURES) as FeatureName[]

export function featureValues(i: FeatureInput): Record<FeatureName, number> {
  const out = {} as Record<FeatureName, number>
  for (const name of FEATURE_NAMES) out[name] = FEATURES[name](i)
  return out
}

// internal functions exposed for direct unit testing
export const internals = { rowTransitions, columnTransitions, cumulativeWells, holeDepth, rowsWithHoles }
