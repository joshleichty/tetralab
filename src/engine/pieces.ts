import type { PieceType, Rot } from './types.ts'

export const BOARD_W = 10
/** total rows including hidden buffer; rows [VISIBLE_START, BOARD_H) are visible */
export const BOARD_H = 40
export const VISIBLE_ROWS = 20
export const VISIBLE_START = BOARD_H - VISIBLE_ROWS // 20

export const PIECE_TYPES: PieceType[] = ['I', 'O', 'T', 'S', 'Z', 'J', 'L']

/** board cell value for each piece type (1-indexed; 0 is empty, 8 is garbage) */
export const PIECE_CELL: Record<PieceType, number> = {
  I: 1,
  O: 2,
  T: 3,
  S: 4,
  Z: 5,
  J: 6,
  L: 7,
}

const SHAPES: Record<PieceType, number[][]> = {
  I: [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ],
  O: [
    [1, 1],
    [1, 1],
  ],
  T: [
    [0, 1, 0],
    [1, 1, 1],
    [0, 0, 0],
  ],
  S: [
    [0, 1, 1],
    [1, 1, 0],
    [0, 0, 0],
  ],
  Z: [
    [1, 1, 0],
    [0, 1, 1],
    [0, 0, 0],
  ],
  J: [
    [1, 0, 0],
    [1, 1, 1],
    [0, 0, 0],
  ],
  L: [
    [0, 0, 1],
    [1, 1, 1],
    [0, 0, 0],
  ],
}

function rotateCW(m: number[][]): number[][] {
  const n = m.length
  const out = m.map((row) => row.slice())
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      out[x][n - 1 - y] = m[y][x]
    }
  }
  return out
}

function cellsOf(m: number[][]): Array<[number, number]> {
  const cells: Array<[number, number]> = []
  for (let y = 0; y < m.length; y++) {
    for (let x = 0; x < m.length; x++) {
      if (m[y][x]) cells.push([x, y])
    }
  }
  return cells
}

function buildCells(): Record<PieceType, Array<Array<[number, number]>>> {
  const out = {} as Record<PieceType, Array<Array<[number, number]>>>
  for (const t of PIECE_TYPES) {
    const rots: Array<Array<[number, number]>> = []
    let m = SHAPES[t]
    for (let r = 0; r < 4; r++) {
      rots.push(cellsOf(m))
      m = rotateCW(m)
    }
    out[t] = rots
  }
  return out
}

/** CELLS[type][rot] -> list of [dx, dy] offsets from the bounding-box origin */
export const CELLS = buildCells()

export const BOX_SIZE: Record<PieceType, number> = {
  I: 4,
  O: 2,
  T: 3,
  S: 3,
  Z: 3,
  J: 3,
  L: 3,
}

export function spawnX(type: PieceType): number {
  return Math.floor((BOARD_W - BOX_SIZE[type]) / 2)
}

/** spawn so the lowest cells sit on row 19 — just above the visible field */
export const SPAWN_Y = VISIBLE_START - 2

export function cellsAt(type: PieceType, rot: Rot, x: number, y: number): Array<[number, number]> {
  return CELLS[type][rot].map(([dx, dy]) => [x + dx, y + dy])
}

/**
 * Pure collision test: can `type` at `rot` sit with its bounding-box
 * origin at (x, y) on this board? `Engine.canFit` delegates here; the bot
 * layer's enumerator calls it directly (board as argument, no instance).
 */
export function fits(board: Uint8Array, type: PieceType, rot: Rot, x: number, y: number): boolean {
  for (const [dx, dy] of CELLS[type][rot]) {
    const cx = x + dx
    const cy = y + dy
    if (cx < 0 || cx >= BOARD_W || cy < 0 || cy >= BOARD_H) return false
    if (board[cy * BOARD_W + cx] !== 0) return false
  }
  return true
}
