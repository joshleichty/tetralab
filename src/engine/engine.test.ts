import { describe, expect, it } from 'vitest'
import { Engine } from './engine'
import { SevenBag } from './rng'
import { BOARD_H, BOARD_W, VISIBLE_START, cellsAt } from './pieces'
import { CELL_GARBAGE, type PieceType } from './types'

function newGame(seed = 42) {
  const e = new Engine({ seed, mode: 'marathon' })
  e.start()
  return e
}

/** fill a board row, optionally leaving holes */
function fillRow(e: Engine, y: number, holes: number[] = []) {
  for (let x = 0; x < BOARD_W; x++) {
    e.board[y * BOARD_W + x] = holes.includes(x) ? 0 : CELL_GARBAGE
  }
}

function stackHeight(e: Engine): number {
  for (let y = 0; y < BOARD_H; y++) {
    for (let x = 0; x < BOARD_W; x++) {
      if (e.board[y * BOARD_W + x]) return BOARD_H - y
    }
  }
  return 0
}

describe('SevenBag', () => {
  it('deals every piece exactly once per bag of 7', () => {
    const bag = new SevenBag(123)
    for (let round = 0; round < 20; round++) {
      const seen = new Set<PieceType>()
      for (let i = 0; i < 7; i++) seen.add(bag.next())
      expect(seen.size).toBe(7)
    }
  })

  it('is deterministic for a given seed', () => {
    const a = new SevenBag(7)
    const b = new SevenBag(7)
    for (let i = 0; i < 50; i++) expect(a.next()).toBe(b.next())
  })

  it('differs across seeds', () => {
    const seq1 = new SevenBag(1)
    const seq2 = new SevenBag(2)
    const s1 = Array.from({ length: 14 }, () => seq1.next()).join('')
    const s2 = Array.from({ length: 14 }, () => seq2.next()).join('')
    expect(s1).not.toBe(s2)
  })
})

describe('Engine basics', () => {
  it('starts with a full preview queue and an active piece', () => {
    const e = newGame()
    expect(e.active).not.toBeNull()
    expect(e.queue.length).toBeGreaterThanOrEqual(e.cfg.queueSize)
    expect(e.status).toBe('playing')
  })

  it('moves left and right within walls', () => {
    const e = newGame()
    const x0 = e.active!.x
    e.applyAction('left')
    expect(e.active!.x).toBe(x0 - 1)
    e.applyAction('right')
    e.applyAction('right')
    expect(e.active!.x).toBe(x0 + 1)
    // shove against the wall: x never goes below 0
    for (let i = 0; i < 20; i++) e.applyAction('left')
    const cells = cellsAt(e.active!.type, e.active!.rot, e.active!.x, e.active!.y)
    expect(Math.min(...cells.map(([x]) => x))).toBe(0)
  })

  it('hard drop locks the piece and spawns the next one', () => {
    const e = newGame()
    const upcoming = e.queue[0]
    e.applyAction('hardDrop')
    expect(e.piecesPlaced).toBe(1)
    expect(stackHeight(e)).toBeGreaterThan(0)
    expect(e.active!.type).toBe(upcoming)
  })

  it('hold swaps the piece and is locked until the next drop', () => {
    const e = newGame()
    const first = e.active!.type
    const next = e.queue[0]
    e.applyAction('hold')
    expect(e.hold).toBe(first)
    expect(e.active!.type).toBe(next)
    // second hold with the same piece must be a no-op
    e.applyAction('hold')
    expect(e.active!.type).toBe(next)
    // after locking, hold is available again
    e.applyAction('hardDrop')
    const current = e.active!.type
    e.applyAction('hold')
    expect(e.hold).toBe(current)
    expect(e.active!.type).toBe(first) // the originally-held piece comes back
  })

  it('gravity pulls the piece down over time', () => {
    const e = newGame()
    const y0 = e.active!.y
    e.tick(2000) // level 1 = 1000ms per row
    expect(e.active!.y).toBeGreaterThan(y0)
  })

  it('soft drop accelerates descent and awards points', () => {
    const e = newGame()
    const y0 = e.active!.y
    e.applyAction('softDropOn')
    e.tick(200) // sdf 20 → 50ms per row at level 1
    expect(e.active!.y).toBeGreaterThan(y0)
    expect(e.score).toBeGreaterThan(0)
  })

  it('locks after the lock delay when grounded', () => {
    const e = newGame()
    e.applyAction('softDropOn')
    e.tick(5000) // reach the floor
    e.applyAction('softDropOff')
    expect(e.piecesPlaced).toBe(0)
    e.tick(e.cfg.lockDelay + 50)
    expect(e.piecesPlaced).toBe(1)
  })
})

describe('Line clears & scoring', () => {
  it('clears a single line and scores 100 at level 1', () => {
    const e = newGame()
    // build a full bottom row except where the next piece will land flat
    const bottom = BOARD_H - 1
    fillRow(e, bottom, [])
    // row is full already → simulate by leaving a hole and dropping an I piece is
    // fiddly across seeds; instead verify the collapse path directly:
    // leave 4 holes and place an I piece horizontally over them.
    fillRow(e, bottom, [3, 4, 5, 6])
    // force the active piece to be I at spawn
    e.active!.type = 'I'
    e.active!.rot = 0
    e.active!.x = 3
    e.applyAction('hardDrop')
    expect(e.lines).toBe(1)
    expect(stackHeight(e)).toBe(0) // garbage row cleared, I piece cleared with it
    expect(e.score).toBeGreaterThanOrEqual(100)
  })

  it('awards QUAD points for 4 lines', () => {
    const e = newGame()
    for (let i = 1; i <= 4; i++) fillRow(e, BOARD_H - i, [0])
    e.active!.type = 'I'
    e.active!.rot = 1 // vertical I occupies column 2 of its 4×4 box
    e.active!.x = -2 // so its cells land in board column 0
    e.applyAction('hardDrop')
    expect(e.lines).toBe(4)
    const ev = e.takeEvents().find((x) => x.kind === 'clear')
    expect(ev && ev.kind === 'clear' && ev.info.label).toBe('QUAD')
    // 800 × level 1, plus hard drop cells
    expect(e.score).toBeGreaterThanOrEqual(800)
  })

  it('detects a perfect clear', () => {
    const e = newGame()
    // empty board + flat I piece into a prepared 1-high well of width 10 minus 4
    fillRow(e, BOARD_H - 1, [3, 4, 5, 6])
    e.active!.type = 'I'
    e.active!.rot = 0
    e.active!.x = 3
    e.applyAction('hardDrop')
    const all = e.board.every((c) => c === 0)
    expect(all).toBe(true)
    expect(e.score).toBeGreaterThan(800) // includes PC bonus
  })
})

describe('SRS rotation', () => {
  it('rotates four times back to spawn orientation', () => {
    const e = newGame()
    const before = { ...e.active! }
    for (let i = 0; i < 4; i++) e.applyAction('cw')
    expect(e.active!.rot).toBe(before.rot)
    expect(e.active!.x).toBe(before.x)
  })

  it('180 rotation works', () => {
    const e = newGame()
    if (e.active!.type === 'O') e.applyAction('hold')
    const r0 = e.active!.rot
    e.applyAction('r180')
    expect(e.active!.rot).toBe((r0 + 2) % 4)
  })

  it('wall kicks let a piece rotate against the wall', () => {
    const e = newGame()
    if (e.active!.type === 'O') e.applyAction('hold')
    // shove flush against the left wall, then rotate — must not get stuck/disappear
    for (let i = 0; i < 12; i++) e.applyAction('left')
    e.applyAction('cw')
    expect(e.active).not.toBeNull()
    const cells = cellsAt(e.active!.type, e.active!.rot, e.active!.x, e.active!.y)
    for (const [x] of cells) expect(x).toBeGreaterThanOrEqual(0)
  })
})

describe('T-spin detection', () => {
  it('scores a T-spin single via the 3-corner rule', () => {
    const e = newGame()
    const b = BOARD_H - 1 // bottom row
    // slot at the bottom-left:
    //   row b-2:  X . . . …            (overhang corner at x=0)
    //   row b-1:  . . . . …            (the T's flat side fits here)
    //   row b  :  X . X X X X X X X X  (hole at x=1 for the T's point)
    fillRow(e, b, [1])
    e.board[(b - 2) * BOARD_W + 0] = CELL_GARBAGE
    // T pointing up, flat side on row b-1, box top-left at (0, b-3+1)
    e.active!.type = 'T'
    e.active!.rot = 0
    e.active!.x = 0
    e.active!.y = b - 2
    // final placement move is a 180 rotation into the slot — point fills the hole
    e.applyAction('r180')
    expect(e.active!.rot).toBe(2)
    e.tick(e.cfg.lockDelay + 100)
    expect(e.lines).toBe(1)
    expect(e.score).toBeGreaterThanOrEqual(800) // T-spin single, not a plain single
  })
})

describe('Garbage (training hook)', () => {
  it('pushes garbage rows in from the bottom with a hole', () => {
    const e = newGame()
    e.addGarbage(3, 4)
    for (let r = 1; r <= 3; r++) {
      const y = BOARD_H - r
      for (let x = 0; x < BOARD_W; x++) {
        const v = e.board[y * BOARD_W + x]
        expect(v).toBe(x === 4 ? 0 : CELL_GARBAGE)
      }
    }
    expect(stackHeight(e)).toBe(3)
  })
})

describe('Top out', () => {
  it('ends the game when the stack reaches the spawn zone', () => {
    const e = newGame()
    for (let y = VISIBLE_START - 4; y < BOARD_H; y++) fillRow(e, y, [9])
    e.applyAction('hardDrop')
    // either block-out on this spawn or the next; play a couple pieces max
    for (let i = 0; i < 3 && e.status === 'playing'; i++) e.applyAction('hardDrop')
    expect(e.status).toBe('over')
  })
})

describe('Cheese mode', () => {
  function newCheese(total = 18, seed = 5) {
    const e = new Engine({ seed, mode: 'cheese', cheeseTotal: total })
    e.start()
    return e
  }

  it('starts with cheeseHeight rows on the board and the rest pooled', () => {
    const e = newCheese(18)
    expect(e.cheeseRows()).toBe(9)
    expect(e.cheesePool).toBe(9)
    expect(e.cheeseLeft()).toBe(18)
  })

  it('small races start with the whole pool on the board', () => {
    const e = newCheese(5)
    expect(e.cheeseRows()).toBe(5)
    expect(e.cheesePool).toBe(0)
  })

  it('every cheese row has exactly one hole, never matching the row below', () => {
    const e = newCheese(18)
    let prevHole = -1
    for (let y = BOARD_H - 1; y >= BOARD_H - 9; y--) {
      const holes: number[] = []
      for (let x = 0; x < BOARD_W; x++) {
        if (e.board[y * BOARD_W + x] === 0) holes.push(x)
      }
      expect(holes.length).toBe(1)
      expect(holes[0]).not.toBe(prevHole)
      prevHole = holes[0]
    }
  })

  it('refills cheese from the pool after digging', () => {
    const e = newCheese(18)
    // clear the bottom cheese row: find its hole and fill it with a vertical I
    const bottom = BOARD_H - 1
    let hole = 0
    for (let x = 0; x < BOARD_W; x++) {
      if (e.board[bottom * BOARD_W + x] === 0) hole = x
    }
    // carve a clean shaft above the hole so the I can reach it
    for (let y = BOARD_H - 9; y < bottom; y++) e.board[y * BOARD_W + hole] = 0
    e.active!.type = 'I'
    e.active!.rot = 1
    e.active!.x = hole - 2
    e.applyAction('hardDrop')
    expect(e.lines).toBe(1)
    // one row dug, pool refills the board back up to 9
    expect(e.cheeseRows()).toBe(9)
    expect(e.cheesePool).toBe(8)
    expect(e.cheeseLeft()).toBe(17)
  })

  it('wins when all cheese is dug', () => {
    const e = newCheese(1, 11)
    const bottom = BOARD_H - 1
    let hole = 0
    for (let x = 0; x < BOARD_W; x++) {
      if (e.board[bottom * BOARD_W + x] === 0) hole = x
    }
    e.active!.type = 'I'
    e.active!.rot = 1
    e.active!.x = hole - 2
    e.applyAction('hardDrop')
    expect(e.cheeseLeft()).toBe(0)
    expect(e.status).toBe('won')
  })
})

describe('Survival mode', () => {
  it('garbage rises on a timer', () => {
    const e = new Engine({ seed: 3, mode: 'survival', riseStartMs: 1000 })
    e.start()
    expect(e.cheeseRows()).toBe(0)
    e.tick(999)
    expect(e.cheeseRows()).toBe(0)
    e.tick(2)
    expect(e.cheeseRows()).toBe(1)
  })

  it('rise interval accelerates down to the floor', () => {
    const e = new Engine({
      seed: 3,
      mode: 'survival',
      riseStartMs: 1000,
      riseDecayMs: 400,
      riseMinMs: 500,
    })
    e.start()
    e.tick(1001) // first rise; interval 1000 -> 600
    expect(e.cheeseRows()).toBe(1)
    e.tick(601) // second rise; interval 600 -> 500 (floor)
    expect(e.cheeseRows()).toBe(2)
    e.tick(501)
    expect(e.cheeseRows()).toBe(3)
  })

  it('tops out when garbage buries the spawn zone', () => {
    const e = new Engine({ seed: 3, mode: 'survival', riseStartMs: 10, riseMinMs: 10 })
    e.start()
    for (let i = 0; i < 50 && e.status === 'playing'; i++) e.tick(20)
    expect(e.status).toBe('over')
  })
})

describe('Sprint mode', () => {
  it('wins at 40 lines', () => {
    const e = new Engine({ seed: 9, mode: 'sprint' })
    e.start()
    e.lines = 39
    fillRow(e, BOARD_H - 1, [3, 4, 5, 6])
    e.active!.type = 'I'
    e.active!.rot = 0
    e.active!.x = 3
    e.applyAction('hardDrop')
    expect(e.lines).toBe(40)
    expect(e.status).toBe('won')
  })
})
