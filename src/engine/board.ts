import { BOARD_H, BOARD_W, PIECE_CELL } from './pieces.ts'
import { CELL_GARBAGE } from './types.ts'
import type { PieceType } from './types.ts'

/**
 * Board specs and metrics: pure functions over the flat board array.
 *
 * The row-string format is the lesson-authoring surface (fumen-style):
 * `'LLL_______'` — one char per column, `_`/`.`/space empty, piece letters
 * for colored cells, `X`/`G` for garbage. Rows are bottom-aligned: the last
 * string is the bottom row of the board.
 *
 * The metrics are the GoalSpec substrate and double as evaluation features
 * for the bot stream (holes/bumpiness/well are classic heuristic terms).
 */

const CHAR_CELL: Record<string, number> = {
  _: 0,
  '.': 0,
  ' ': 0,
  X: CELL_GARBAGE,
  G: CELL_GARBAGE,
}
for (const t of Object.keys(PIECE_CELL)) CHAR_CELL[t] = PIECE_CELL[t as PieceType]

/** Parse bottom-aligned row strings into a full board array. Throws on bad input. */
export function parseRows(rows: string[]): Uint8Array {
  if (rows.length > BOARD_H) throw new Error(`board spec has ${rows.length} rows (max ${BOARD_H})`)
  const board = new Uint8Array(BOARD_W * BOARD_H)
  const top = BOARD_H - rows.length
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    if (row.length !== BOARD_W) {
      throw new Error(`board spec row ${i} is ${row.length} chars wide (want ${BOARD_W}): "${row}"`)
    }
    for (let x = 0; x < BOARD_W; x++) {
      const cell = CHAR_CELL[row[x]]
      if (cell === undefined) throw new Error(`board spec row ${i}: unknown cell char "${row[x]}"`)
      board[(top + i) * BOARD_W + x] = cell
    }
  }
  return board
}

/** Render a board back to row strings (debugging/tests); skips empty top rows. */
export function formatBoard(board: Uint8Array, minRows = 1): string[] {
  const CELL_CHAR: string[] = ['_', 'I', 'O', 'T', 'S', 'Z', 'J', 'L', 'X']
  const rows: string[] = []
  for (let y = 0; y < BOARD_H; y++) {
    let s = ''
    for (let x = 0; x < BOARD_W; x++) s += CELL_CHAR[board[y * BOARD_W + x]] ?? '?'
    rows.push(s)
  }
  let first = 0
  while (first < BOARD_H - minRows && rows[first] === '_'.repeat(BOARD_W)) first++
  return rows.slice(first)
}

/** Height of each column: number of rows from the topmost filled cell down. */
export function columnHeights(board: Uint8Array): number[] {
  const heights = new Array<number>(BOARD_W).fill(0)
  for (let x = 0; x < BOARD_W; x++) {
    for (let y = 0; y < BOARD_H; y++) {
      if (board[y * BOARD_W + x] !== 0) {
        heights[x] = BOARD_H - y
        break
      }
    }
  }
  return heights
}

/** Tallest column height. */
export function stackHeight(board: Uint8Array): number {
  return Math.max(...columnHeights(board))
}

/** Covered empty cells: empties strictly below their column's top filled cell. */
export function holes(board: Uint8Array): number {
  let count = 0
  for (let x = 0; x < BOARD_W; x++) {
    let covered = false
    for (let y = 0; y < BOARD_H; y++) {
      if (board[y * BOARD_W + x] !== 0) covered = true
      else if (covered) count++
    }
  }
  return count
}

/**
 * Holes the *player* made: covered empty cells whose nearest filled cell
 * above is a piece, not garbage. Cheese/garbage rows carry their own hole
 * cells (covered by the garbage row above); those are the terrain, not a
 * stacking mistake — but a piece sealing a column it still needs is one.
 * The downstacking-stat and C-track-goal counterpart of `holes`.
 */
export function playerHoles(board: Uint8Array): number {
  let count = 0
  for (let x = 0; x < BOARD_W; x++) {
    let cover = 0 // cell value of the nearest filled cell above
    for (let y = 0; y < BOARD_H; y++) {
      const cell = board[y * BOARD_W + x]
      if (cell !== 0) cover = cell
      else if (cover !== 0 && cover !== CELL_GARBAGE) count++
    }
  }
  return count
}

/**
 * Surface roughness: sum of |height difference| between adjacent columns.
 * Pass `ignoreColumn` to exclude a dedicated well from the measurement
 * (its neighbors are compared to each other instead).
 */
export function bumpiness(board: Uint8Array, ignoreColumn?: number): number {
  const heights = columnHeights(board).filter((_, x) => x !== ignoreColumn)
  let sum = 0
  for (let i = 1; i < heights.length; i++) sum += Math.abs(heights[i] - heights[i - 1])
  return sum
}

/** How far the well column sits below its lowest neighbor (0 if not a well). */
export function wellDepth(board: Uint8Array, column: number): number {
  const heights = columnHeights(board)
  const neighbors: number[] = []
  if (column > 0) neighbors.push(heights[column - 1])
  if (column < BOARD_W - 1) neighbors.push(heights[column + 1])
  return Math.max(0, Math.min(...neighbors) - heights[column])
}

/** A pure well has no filled cells in its column at all. */
export function isWellPure(board: Uint8Array, column: number): boolean {
  for (let y = 0; y < BOARD_H; y++) {
    if (board[y * BOARD_W + column] !== 0) return false
  }
  return true
}
