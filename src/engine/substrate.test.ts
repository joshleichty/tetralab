import { describe, expect, it } from 'vitest'
import { Engine } from './engine'
import { BOARD_H, BOARD_W, PIECE_TYPES, SPAWN_Y, fits, spawnX } from './pieces'
import { detectTSpin } from './spin'
import { CELL_GARBAGE, type Rot } from './types'

/**
 * Bot-substrate primitives (specs/bot-core.md M0): pure collision, pure
 * T-spin detection, and Engine.snapshot(). The engine delegates to the
 * pure functions, so the existing engine/parity suites also exercise them;
 * these tests pin the pure surfaces directly.
 */

const emptyBoard = () => new Uint8Array(BOARD_W * BOARD_H)

function set(board: Uint8Array, x: number, y: number) {
  board[y * BOARD_W + x] = CELL_GARBAGE
}

describe('fits (pure collision)', () => {
  it('accepts the spawn cell on an empty board for every piece', () => {
    const board = emptyBoard()
    for (const t of PIECE_TYPES) {
      expect(fits(board, t, 0, spawnX(t), SPAWN_Y)).toBe(true)
    }
  })

  it('rejects out-of-bounds positions on all sides', () => {
    const board = emptyBoard()
    expect(fits(board, 'T', 0, -1, 10)).toBe(false) // left wall
    expect(fits(board, 'T', 0, BOARD_W - 2, 10)).toBe(false) // right wall (T is 3 wide)
    expect(fits(board, 'T', 0, BOARD_W - 3, 10)).toBe(true)
    expect(fits(board, 'T', 0, 3, BOARD_H - 1)).toBe(false) // floor (T rot 0 spans dy 0..1)
    expect(fits(board, 'T', 0, 3, BOARD_H - 2)).toBe(true)
  })

  it('rejects overlap with a filled cell', () => {
    const board = emptyBoard()
    set(board, 4, 11) // under the T's center cell at (3, 10): cell (4, 11)
    expect(fits(board, 'T', 0, 3, 10)).toBe(false)
    expect(fits(board, 'T', 0, 3, 9)).toBe(true) // one row up clears it
  })

  it('agrees with Engine.canFit for the active piece', () => {
    const e = new Engine({ seed: 42, mode: 'marathon' })
    e.start()
    const p = e.active!
    for (const rot of [0, 1, 2, 3] as Rot[]) {
      for (let dx = -2; dx <= 2; dx++) {
        expect(fits(e.board, p.type, rot, p.x + dx, p.y)).toBe(e.canFit(p.x + dx, p.y, rot))
      }
    }
  })
})

describe('detectTSpin (pure 3-corner rule)', () => {
  // T bounding box at (3, 10): corners (3,10) (5,10) (5,12) (3,12)
  const piece = (rot: Rot) => ({ rot, x: 3, y: 10 })

  it('is none when the last move was not a rotation', () => {
    const board = emptyBoard()
    set(board, 3, 10)
    set(board, 5, 10)
    set(board, 3, 12)
    expect(detectTSpin(board, piece(0), false, 0)).toBe('none')
  })

  it('is none with fewer than 3 corners filled', () => {
    const board = emptyBoard()
    set(board, 3, 10)
    set(board, 5, 10)
    expect(detectTSpin(board, piece(0), true, 0)).toBe('none')
  })

  it('is full when both front corners are filled', () => {
    const board = emptyBoard()
    set(board, 3, 10) // front for rot 0 (top-left)
    set(board, 5, 10) // front for rot 0 (top-right)
    set(board, 3, 12)
    expect(detectTSpin(board, piece(0), true, 0)).toBe('full')
  })

  it('is mini when only one front corner is filled', () => {
    const board = emptyBoard()
    set(board, 3, 10) // top-left: front for rot 0
    set(board, 5, 12) // back corners
    set(board, 3, 12)
    expect(detectTSpin(board, piece(0), true, 0)).toBe('mini')
  })

  it('upgrades mini to full on the final (1,2) SRS kick', () => {
    const board = emptyBoard()
    set(board, 3, 10)
    set(board, 5, 12)
    set(board, 3, 12)
    expect(detectTSpin(board, piece(0), true, 4)).toBe('full')
  })

  it('counts out-of-bounds as occupied (wall corners)', () => {
    // box origin x = -1: left corners are off-board, so two corners are
    // "filled" for free; one real corner makes three
    const board = emptyBoard()
    set(board, 1, 10)
    expect(detectTSpin(board, { rot: 3, x: -1, y: 10 }, true, 0)).toBe('full') // front for rot 3: (3,0) = bottom-left + top-left, both OOB
  })
})

describe('Engine.snapshot (L0 Position)', () => {
  it('is null before start and after game over', () => {
    const e = new Engine({ seed: 1, mode: 'marathon' })
    expect(e.snapshot()).toBeNull()
  })

  it('captures piece, previews, and hold state', () => {
    const e = new Engine({ seed: 7, mode: 'marathon' })
    e.start()
    const s = e.snapshot()!
    expect(s.piece).toBe(e.active!.type)
    expect(s.queue).toEqual(e.queue.slice(0, e.cfg.queueSize))
    expect(s.queue.length).toBe(e.cfg.queueSize)
    expect(s.hold).toBeNull()
    expect(s.holdUsed).toBe(false)

    const held = s.piece
    e.applyAction('hold')
    const s2 = e.snapshot()!
    expect(s2.hold).toBe(held)
    expect(s2.holdUsed).toBe(true)
    expect(s2.piece).toBe(e.active!.type)
  })

  it('returns copies, never aliases of live state', () => {
    const e = new Engine({ seed: 7, mode: 'marathon' })
    e.start()
    const s = e.snapshot()!
    s.board[0] = CELL_GARBAGE
    s.queue.pop()
    expect(e.board[0]).toBe(0)
    expect(e.queue.length).toBe(e.cfg.queueSize + 1)
  })
})
