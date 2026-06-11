import { describe, expect, it } from 'vitest'
import {
  bumpiness,
  columnHeights,
  formatBoard,
  holes,
  isWellPure,
  parseRows,
  stackHeight,
  wellDepth,
} from './board'
import { BOARD_H, BOARD_W, PIECE_CELL } from './pieces'
import { CELL_GARBAGE } from './types'

describe('parseRows', () => {
  it('parses bottom-aligned row strings', () => {
    const board = parseRows(['T_________', 'LLLXXXXXX_'])
    expect(board[(BOARD_H - 2) * BOARD_W + 0]).toBe(PIECE_CELL.T)
    expect(board[(BOARD_H - 1) * BOARD_W + 0]).toBe(PIECE_CELL.L)
    expect(board[(BOARD_H - 1) * BOARD_W + 3]).toBe(CELL_GARBAGE)
    expect(board[(BOARD_H - 1) * BOARD_W + 9]).toBe(0)
    // everything above the given rows is empty
    expect(board.slice(0, (BOARD_H - 2) * BOARD_W).every((c) => c === 0)).toBe(true)
  })

  it('accepts _, ., space as empty and X/G as garbage', () => {
    const board = parseRows(['_.        '.slice(0, 10), 'XXXXXXXXXG'])
    expect(board.slice((BOARD_H - 2) * BOARD_W, (BOARD_H - 1) * BOARD_W).every((c) => c === 0)).toBe(
      true,
    )
    expect(board[BOARD_H * BOARD_W - 1]).toBe(CELL_GARBAGE)
  })

  it('round-trips through formatBoard', () => {
    const rows = ['S__ZZ_____', 'XXXX_XXXXX']
    expect(formatBoard(parseRows(rows), 2)).toEqual(rows)
  })

  it('rejects malformed specs', () => {
    expect(() => parseRows(['short'])).toThrow(/wide/)
    expect(() => parseRows(['Q_________'])).toThrow(/unknown cell/)
    expect(() => parseRows(new Array(BOARD_H + 1).fill('_'.repeat(10)))).toThrow(/rows/)
  })
})

describe('board metrics', () => {
  // two 4-high towers flanking a low middle, one covered hole under the T
  const board = parseRows([
    'X________X', //
    'X________X',
    'XT_______X',
    'X_XXXXXXXX',
  ])

  it('columnHeights measures from the top filled cell', () => {
    expect(columnHeights(board)).toEqual([4, 2, 1, 1, 1, 1, 1, 1, 1, 4])
  })

  it('stackHeight is the tallest column', () => {
    expect(stackHeight(board)).toBe(4)
    expect(stackHeight(new Uint8Array(BOARD_W * BOARD_H))).toBe(0)
  })

  it('holes counts covered empties', () => {
    // the empty cell under the T (col 1, bottom row) is the only hole
    expect(holes(board)).toBe(1)
  })

  it('bumpiness sums adjacent height differences', () => {
    // heights 4,2,1,1,1,1,1,1,1,4 → |4-2|+|2-1|+0…+|1-4| = 6
    expect(bumpiness(board)).toBe(6)
    // ignoring the right well column drops the |1-4| step
    expect(bumpiness(board, 9)).toBe(3)
  })

  it('wellDepth measures below the lowest neighbor', () => {
    const welled = parseRows([
      'XXXXXXXXX_', //
      'XXXXXXXXX_',
      'XXXXXXXXX_',
    ])
    expect(wellDepth(welled, 9)).toBe(3)
    expect(wellDepth(welled, 4)).toBe(0)
  })

  it('isWellPure requires a completely empty column', () => {
    const welled = parseRows(['XXXXXXXXX_', 'XXXXXXXXXX'])
    expect(isWellPure(welled, 9)).toBe(false)
    expect(isWellPure(parseRows(['XXXXXXXXX_']), 9)).toBe(true)
  })
})
