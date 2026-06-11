import { DEFAULT_ATTACK_CONFIG, attackFor } from '../engine/attack.ts'
import type { AttackConfig } from '../engine/attack.ts'
import { BOARD_H, BOARD_W, PIECE_CELL } from '../engine/pieces.ts'
import type { Placement, Spin } from './types.ts'

/**
 * L3 substrate: simulate a placement's lock purely — apply cells, find
 * and collapse full rows, derive the clear result — mirroring the
 * engine's lockPiece/clearLines exactly (verified against a real Engine
 * in tests). Attack uses tetra's own table (`engine/attack.ts`), not a
 * ported approximation.
 */

export interface EvalContext {
  /** a back-to-back chain is alive entering this placement (engine.b2b >= 0) */
  b2b: boolean
  /** engine combo counter entering this placement (-1 = no chain) */
  combo: number
  attack?: AttackConfig
}

export const DEFAULT_CONTEXT: EvalContext = { b2b: false, combo: -1 }

export interface PlacementOutcome {
  /** board after the lock, full rows collapsed */
  after: Uint8Array
  linesCleared: number
  /** placed-piece cells that sat in cleared rows (raw count) */
  erodedPieceCells: number
  spin: Spin
  /** quad or spin clear — preserves/extends back-to-back */
  difficult: boolean
  perfectClear: boolean
  /** lines this placement would send (before cancellation) */
  attack: number
}

export function placementOutcome(
  board: Uint8Array,
  p: Placement,
  ctx: EvalContext = DEFAULT_CONTEXT,
): PlacementOutcome {
  const after = board.slice()
  for (const [x, y] of p.cells) after[y * BOARD_W + x] = PIECE_CELL[p.type]

  const fullRows: number[] = []
  for (let y = 0; y < BOARD_H; y++) {
    let full = true
    for (let x = 0; x < BOARD_W; x++) {
      if (after[y * BOARD_W + x] === 0) {
        full = false
        break
      }
    }
    if (full) fullRows.push(y)
  }
  const eroded = p.cells.filter(([, y]) => fullRows.includes(y)).length

  // collapse, exactly like Engine.clearLines
  for (const row of fullRows) {
    after.copyWithin(BOARD_W, 0, row * BOARD_W)
    after.fill(0, 0, BOARD_W)
  }

  const lines = fullRows.length
  const difficult = lines === 4 || (p.spin !== 'none' && lines > 0)
  const perfectClear = lines > 0 && after.every((c) => c === 0)
  const attack = attackFor(
    {
      lines,
      tspin: p.spin,
      b2b: difficult && ctx.b2b,
      combo: lines > 0 ? ctx.combo + 1 : -1,
      perfectClear,
    },
    ctx.attack ?? DEFAULT_ATTACK_CONFIG,
  )

  return {
    after,
    linesCleared: lines,
    erodedPieceCells: eroded,
    spin: p.spin,
    difficult,
    perfectClear,
    attack,
  }
}
