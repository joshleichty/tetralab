/**
 * Parity test suite — the coverage contract for docs/parity.md §1–4.
 *
 * Every test cites the source it encodes (spec invariant 4, see
 * specs/feature-parity.md). Source keys are docs/parity.md's:
 *   [PDF] 2009 Tetris Design Guideline · [TW] tetris.wiki ·
 *   [HD] harddrop.com · [TIO] tetr.io client source · [JS] Jstris ·
 *   [BD] tetrio-bot-docs · [TV] TemariVirus kick tables, extracted from the
 *   tetr.io source (Budget-Tetris-Engine src/kicks/*.zig, fetched 2026-06-09).
 *
 * Published kick tables use y-up coordinates; the engine stores y-down.
 * Tables below are written VERBATIM from the sources (y-up) and converted
 * with `yDown()` so the citation stays literal.
 */
import { describe, expect, it } from 'vitest'
import { Engine, gravityMsPerRow } from './engine'
import { kicksFor } from './srs'
import { SevenBag } from './rng'
import { BOARD_H, BOARD_W, SPAWN_Y, VISIBLE_START, cellsAt } from './pieces'
import { CELL_GARBAGE, type EngineConfig, type Mode, type PieceType, type Rot } from './types'

// ── helpers ──────────────────────────────────────────────────────

function game(cfg: Partial<EngineConfig> & { seed?: number; mode?: Mode } = {}) {
  const e = new Engine({ seed: 42, mode: 'marathon', ...cfg })
  e.start()
  return e
}

/** teleport the active piece into a crafted scenario */
function setActive(e: Engine, type: PieceType, rot: Rot, x: number, y: number) {
  e.active!.type = type
  e.active!.rot = rot
  e.active!.x = x
  e.active!.y = y
}

function fillRow(e: Engine, y: number, holes: number[] = []) {
  for (let x = 0; x < BOARD_W; x++) {
    e.board[y * BOARD_W + x] = holes.includes(x) ? 0 : CELL_GARBAGE
  }
}

function fillCell(e: Engine, x: number, y: number) {
  e.board[y * BOARD_W + x] = CELL_GARBAGE
}

/** a lone cell far from the action so clears never become perfect clears */
function antiPC(e: Engine) {
  fillCell(e, 9, 20)
}

/** lock the grounded active piece by letting the full lock delay elapse */
function lockByDelay(e: Engine) {
  e.tick(e.cfg.lockDelay + 1)
}

/** force the next spawn to be `type` by locking the current piece */
function spawnFresh(e: Engine, type: PieceType) {
  e.queue[0] = type
  e.applyAction('hardDrop')
}

function activeCells(e: Engine): Array<[number, number]> {
  const p = e.active!
  return cellsAt(p.type, p.rot, p.x, p.y).sort((a, b) => a[1] - b[1] || a[0] - b[0])
}

type Kick = [number, number]
const neg = (v: number) => (v === 0 ? 0 : -v) // avoid -0 (toEqual distinguishes it)
/** published tables are y-up; the engine board is y-down */
function yDown(kicks: Kick[]): Kick[] {
  return kicks.map(([x, y]) => [x, neg(y)])
}

function expectKicks(type: PieceType, from: Rot, to: Rot, publishedYUp: Kick[]) {
  expect(kicksFor(type, from, to)).toEqual(yDown(publishedYUp))
}

// ── §1 Rotation & spawning ───────────────────────────────────────

describe('parity §1: SRS 90° kicks, JLSTZ', () => {
  // Source: [TW]/[HD] SRS pages — the guideline JLSTZ wall kick data,
  // verbatim (y-up). Same table for J, L, S, T, Z.
  const JLSTZ: Record<string, Kick[]> = {
    '0>1': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
    '1>0': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
    '1>2': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
    '2>1': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
    '2>3': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
    '3>2': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
    '3>0': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
    '0>3': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
  }

  it('matches the published table for all 8 transitions, all 5 pieces', () => {
    for (const piece of ['J', 'L', 'S', 'T', 'Z'] as PieceType[]) {
      for (const [key, kicks] of Object.entries(JLSTZ)) {
        const [from, to] = key.split('>').map(Number) as [Rot, Rot]
        expectKicks(piece, from, to, kicks)
      }
    }
  })
})

describe('parity §1: SRS+ I kicks (Decision D1)', () => {
  // Source: [TV] srs_plus.zig (extracted from the tetr.io client source),
  // verbatim y-up. SRS+ is TETR.IO's default rotation system; its I kicks
  // are symmetric along the y-axis [TW-TETR.IO].
  const I_PLUS: Record<string, Kick[]> = {
    '0>1': [[0, 0], [1, 0], [-2, 0], [-2, -1], [1, 2]],
    '1>2': [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]],
    '2>3': [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
    '3>0': [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
    '0>3': [[0, 0], [-1, 0], [2, 0], [2, -1], [-1, 2]],
    '1>0': [[0, 0], [-1, 0], [2, 0], [-1, -2], [2, 1]],
    '2>1': [[0, 0], [-2, 0], [1, 0], [-2, 1], [1, -2]],
    '3>2': [[0, 0], [1, 0], [-2, 0], [1, 2], [-2, -1]],
  }

  it('matches the TETR.IO SRS+ I table for all 8 transitions', () => {
    for (const [key, kicks] of Object.entries(I_PLUS)) {
      const [from, to] = key.split('>').map(Number) as [Rot, Rot]
      expectKicks('I', from, to, kicks)
    }
  })

  it('is y-symmetric: every CCW transition mirrors its CW counterpart in x', () => {
    // [TW-TETR.IO]: "the I wall kicks are symmetrical along the y-axis"
    const mirrorPairs: Array<[[Rot, Rot], [Rot, Rot]]> = [
      [[0, 1], [0, 3]],
      [[1, 2], [3, 2]],
      [[2, 3], [2, 1]],
      [[3, 0], [1, 0]],
    ]
    for (const [[a, b], [c, d]] of mirrorPairs) {
      const cw = kicksFor('I', a, b).map(([x, y]) => [neg(x), y])
      expect(kicksFor('I', c, d)).toEqual(cw)
    }
  })
})

describe('parity §1: O piece', () => {
  it('has no kicks and rotation never displaces it', () => {
    // [TW]/[HD]: the O piece "cannot kick"; rotation is a visual no-op
    expect(kicksFor('O', 0, 1)).toEqual([[0, 0]])
    const e = game()
    spawnFresh(e, 'O')
    const before = activeCells(e)
    const { x, y } = e.active!
    e.applyAction('cw')
    expect(activeCells(e)).toEqual(before)
    expect(e.active!.x).toBe(x)
    expect(e.active!.y).toBe(y)
  })
})

describe('parity §1: 180° kicks (TETR.IO table)', () => {
  // Source: [TV] srs_tetrio.zig double_kicks, verbatim y-up. No guideline
  // 180 standard exists; TETR.IO's table is the defensible choice
  // (docs/parity.md §1).
  const K180: Record<string, Kick[]> = {
    '0>2': [[0, 0], [0, 1], [1, 1], [-1, 1], [1, 0], [-1, 0]],
    '1>3': [[0, 0], [1, 0], [1, 2], [1, 1], [0, 2], [0, 1]],
    '2>0': [[0, 0], [0, -1], [-1, -1], [1, -1], [-1, 0], [1, 0]],
    '3>1': [[0, 0], [-1, 0], [-1, 2], [-1, 1], [0, 2], [0, 1]],
  }
  // Source: [TV] srs_plus.zig double_i_kicks — SRS+ adds minimal I-180
  // kicks (Decision D1); plain TETR.IO "SRS" has none.
  const I180: Record<string, Kick[]> = {
    '0>2': [[0, 0], [0, 1]],
    '1>3': [[0, 0], [1, 0]],
    '2>0': [[0, 0], [0, -1]],
    '3>1': [[0, 0], [-1, 0]],
  }

  it('matches the TETR.IO 180 table for JLSTZ+T', () => {
    for (const piece of ['J', 'L', 'S', 'T', 'Z'] as PieceType[]) {
      for (const [key, kicks] of Object.entries(K180)) {
        const [from, to] = key.split('>').map(Number) as [Rot, Rot]
        expectKicks(piece, from, to, kicks)
      }
    }
  })

  it('matches the SRS+ minimal I-180 table (D1)', () => {
    for (const [key, kicks] of Object.entries(I180)) {
      const [from, to] = key.split('>').map(Number) as [Rot, Rot]
      expectKicks('I', from, to, kicks)
    }
  })

  it('lets a floor-flat I rotate 180 via the (0,+1) lift kick', () => {
    // Behavioral D1 check: without the SRS+ I-180 kick this rotation is
    // impossible (rot 2 sits one row lower in the bounding box).
    const e = game()
    setActive(e, 'I', 0, 3, BOARD_H - 2) // flat on the floor
    e.applyAction('r180')
    expect(e.active!.rot).toBe(2)
    expect(e.active!.y).toBe(BOARD_H - 3) // kicked one row up, same cells
  })
})

describe('parity §1: spawning', () => {
  // Expected post-spawn cells: north-facing, flat side down, columns per
  // [HD-Spawn_Location] (JLSTZ 3–5, O 4–5, I 3–6), generated in the two
  // hidden rows just above the skyline [PDF §3.4][TW-Guideline], then
  // immediately dropped one row because nothing obstructs ("a Tetrimino
  // moves down immediately after appearing", [TW-Guideline][PDF]).
  const SPAWN_CELLS: Record<PieceType, Array<[number, number]>> = {
    I: [[3, 20], [4, 20], [5, 20], [6, 20]],
    O: [[4, 19], [5, 19], [4, 20], [5, 20]],
    T: [[4, 19], [3, 20], [4, 20], [5, 20]],
    S: [[4, 19], [5, 19], [3, 20], [4, 20]],
    Z: [[3, 19], [4, 19], [4, 20], [5, 20]],
    J: [[3, 19], [3, 20], [4, 20], [5, 20]],
    L: [[5, 19], [3, 20], [4, 20], [5, 20]],
  }

  it('spawns every piece north-facing at the guideline columns and rows, then drops one row', () => {
    for (const type of Object.keys(SPAWN_CELLS) as PieceType[]) {
      const e = game()
      spawnFresh(e, type)
      expect(e.active!.type).toBe(type)
      expect(e.active!.rot).toBe(0)
      expect(activeCells(e)).toEqual(SPAWN_CELLS[type])
    }
  })

  it('skips the immediate drop when obstructed, staying in the hidden rows', () => {
    // [PDF]: the move-down happens only "if no existing Block is in its path"
    const e = game()
    setActive(e, 'T', 0, 3, 35) // park the current piece out of the way
    fillRow(e, VISIBLE_START) // block row 20
    e.applyAction('hold') // hold spawns the next piece without locking
    expect(e.active!.y).toBe(SPAWN_Y)
    expect(Math.min(...activeCells(e).map(([, y]) => y))).toBeGreaterThanOrEqual(18)
  })

  it('spawns the next piece synchronously on lock (0 ARE, intentional divergence)', () => {
    // Tetra runs 0 ARE = modern competitive default ([TIO] are:0);
    // [PDF] specifies 0.2s for offline guideline games. Documented in
    // docs/engine.md as an intentional divergence.
    const e = game()
    e.applyAction('hardDrop')
    expect(e.piecesPlaced).toBe(1)
    expect(e.active).not.toBeNull()
  })
})

// ── §2 Locking & top-out ─────────────────────────────────────────

describe('parity §2: lock delay', () => {
  it('locks a grounded piece after 500 ms, not before', () => {
    // [PDF §5.7]: 0.5 s Lock Down timer (cfg.lockDelay default 500)
    const e = game()
    setActive(e, 'T', 0, 3, BOARD_H - 2)
    e.tick(499)
    expect(e.piecesPlaced).toBe(0)
    e.tick(2)
    expect(e.piecesPlaced).toBe(1)
  })

  it('move-resets the timer (Extended Placement Lock Down)', () => {
    // [PDF §5.7]: each move/rotation while grounded resets the timer
    const e = game()
    setActive(e, 'T', 0, 3, BOARD_H - 2)
    e.tick(400)
    e.applyAction('left') // restores resets: first time at this (new lowest) row
    e.tick(400)
    e.applyAction('right') // a true move-reset at the same altitude
    e.tick(499)
    expect(e.piecesPlaced).toBe(0) // 1299 ms grounded, still alive
    e.tick(2)
    expect(e.piecesPlaced).toBe(1)
  })

  it('locks immediately on surface contact once all 15 resets are spent', () => {
    // [PDF §5.7]: after the 15-move cap, the piece "Locks Down immediately"
    // on touching a surface — the residual timer no longer applies
    const e = game()
    setActive(e, 'T', 0, 3, BOARD_H - 2)
    e.applyAction('left') // new-lowest-row: restores the counter
    for (let i = 0; i < 15; i++) e.applyAction(i % 2 === 0 ? 'right' : 'left')
    expect(e.piecesPlaced).toBe(0)
    e.tick(1) // grounded with cap spent → instant lock
    expect(e.piecesPlaced).toBe(1)
  })

  it('does not insta-lock while resets remain', () => {
    const e = game()
    setActive(e, 'T', 0, 3, BOARD_H - 2)
    e.applyAction('left')
    for (let i = 0; i < 14; i++) e.applyAction(i % 2 === 0 ? 'right' : 'left')
    e.tick(1)
    expect(e.piecesPlaced).toBe(0)
  })

  it('restores the reset counter only on reaching a new lowest row', () => {
    // [PDF §5.7]: the counter is restored when the piece falls to a row
    // below the lowest it has reached
    const e = game()
    fillCell(e, 4, 32) // a one-cell pillar to ground on
    setActive(e, 'T', 0, 3, 30)
    e.applyAction('left') // new lowest → counter restored
    for (let i = 0; i < 15; i++) e.applyAction(i % 2 === 0 ? 'right' : 'left')
    // cap is spent; walk off the pillar (still grounded for two steps)
    e.applyAction('right')
    e.applyAction('right') // x=5 → nothing below → airborne
    e.tick(4000)
    e.tick(4000) // falls 8 rows to the floor: every row down is a new lowest
    e.tick(1)
    expect(e.piecesPlaced).toBe(0) // would have insta-locked without restore
    e.tick(e.cfg.lockDelay)
    expect(e.piecesPlaced).toBe(1) // normal delay applies again
  })
})

describe('parity §2: dropping', () => {
  it('hard drop locks instantly and scores +2 per cell, flat', () => {
    // [PDF §5.4][TW-Scoring]
    const e = game()
    const dist = e.ghostY() - e.active!.y
    e.applyAction('hardDrop')
    expect(e.piecesPlaced).toBe(1)
    expect(e.score).toBe(2 * dist)
    const ev = e.takeEvents().find((x) => x.kind === 'harddrop')
    expect(ev && ev.kind === 'harddrop' && ev.distance).toBe(dist)
  })

  it('soft drop never locks; the normal lock delay applies on the floor', () => {
    // [PDF §5.5]
    const e = game()
    e.applyAction('softDropOn')
    e.tick(3000) // sdf 20 at level 1 = 50 ms/row → floor long since reached
    expect(e.piecesPlaced).toBe(0)
    expect(e.ghostY()).toBe(e.active!.y) // grounded
    e.tick(e.cfg.lockDelay + 1)
    expect(e.piecesPlaced).toBe(1)
  })
})

describe('parity §2: top-out rules', () => {
  it('block out: lifts an obstructed spawn up to 2 rows (Decision D2, lenient divergence)', () => {
    // Strict [PDF] declares game over on an obstructed spawn; guideline
    // games try one row [HD-Spawn]. Tetra deliberately tries two —
    // documented intentional divergence (docs/parity.md D2).
    const lifted1 = game()
    setActive(lifted1, 'T', 0, 3, 35)
    fillRow(lifted1, 19)
    lifted1.applyAction('hold')
    expect(lifted1.status).toBe('playing')
    expect(lifted1.active!.y).toBe(SPAWN_Y - 1)

    const lifted2 = game()
    setActive(lifted2, 'T', 0, 3, 35)
    fillRow(lifted2, 18)
    fillRow(lifted2, 19)
    lifted2.applyAction('hold')
    expect(lifted2.status).toBe('playing')
    expect(lifted2.active!.y).toBe(SPAWN_Y - 2)

    const blocked = game()
    setActive(blocked, 'T', 0, 3, 35)
    for (let y = 16; y <= 19; y++) fillRow(blocked, y)
    blocked.applyAction('hold')
    expect(blocked.status).toBe('over')
  })

  it('lock out: a piece locking entirely above the visible field ends the game', () => {
    // [TW-Top_out]
    const e = game()
    for (let y = VISIBLE_START; y < BOARD_H; y++) fillRow(e, y, [0])
    setActive(e, 'T', 0, 3, SPAWN_Y)
    e.applyAction('hardDrop') // rests on the stack at rows 18–19
    expect(e.status).toBe('over')
  })

  it('garbage push-out: a block shoved above the buffer tops the game out', () => {
    // [TW-Top_out] guideline rule; pre-M1 tetra silently deleted row 0
    const e = game()
    fillCell(e, 5, 0) // occupied top buffer row
    e.addGarbage(1, 4)
    expect(e.status).toBe('over')
  })

  it('garbage rise preserves every row below the buffer top', () => {
    const e = game()
    fillCell(e, 5, 1)
    e.addGarbage(1, 4)
    expect(e.status).toBe('playing')
    expect(e.cellAt(5, 0)).toBe(CELL_GARBAGE) // shifted up intact, not deleted
    e.addGarbage(1, 4) // now row 0 is occupied → push-out
    expect(e.status).toBe('over')
  })

  it('clears lines with zero delay: board collapsed and next piece live in the same call', () => {
    // [TIO] lineclear_are:0 · [JS] clear delay default 0 ms
    const e = game()
    fillRow(e, BOARD_H - 1, [3, 4, 5, 6])
    setActive(e, 'I', 0, 3, BOARD_H - 2)
    e.applyAction('hardDrop')
    expect(e.lines).toBe(1)
    expect(e.active).not.toBeNull()
    expect(e.board.every((c) => c === 0)).toBe(true)
  })
})

// ── §3 Scoring ───────────────────────────────────────────────────

describe('parity §3: clear points', () => {
  // [TW-Scoring][PDF]: Single 100 / Double 300 / Triple 500 / Tetris 800,
  // × level. Pieces are locked by lock delay so no drop points interfere.

  it('single = 100 × level', () => {
    const e = game()
    antiPC(e)
    fillRow(e, BOARD_H - 1, [3, 4, 5, 6])
    setActive(e, 'I', 0, 3, BOARD_H - 2)
    lockByDelay(e)
    expect(e.lines).toBe(1)
    expect(e.score).toBe(100)
  })

  it('double = 300 × level', () => {
    const e = game()
    antiPC(e)
    fillRow(e, BOARD_H - 2, [0])
    fillRow(e, BOARD_H - 1, [0])
    setActive(e, 'I', 1, -2, BOARD_H - 4) // vertical I in column 0
    lockByDelay(e)
    expect(e.lines).toBe(2)
    expect(e.score).toBe(300)
  })

  it('triple = 500 × level', () => {
    const e = game()
    antiPC(e)
    for (let r = 1; r <= 3; r++) fillRow(e, BOARD_H - r, [0])
    setActive(e, 'I', 1, -2, BOARD_H - 4)
    lockByDelay(e)
    expect(e.lines).toBe(3)
    expect(e.score).toBe(500)
  })

  it('quad = 800 × level, labelled QUAD', () => {
    const e = game()
    antiPC(e)
    for (let r = 1; r <= 4; r++) fillRow(e, BOARD_H - r, [0])
    setActive(e, 'I', 1, -2, BOARD_H - 4)
    lockByDelay(e)
    expect(e.lines).toBe(4)
    expect(e.score).toBe(800)
    const ev = e.takeEvents().find((x) => x.kind === 'clear')
    expect(ev && ev.kind === 'clear' && ev.info.label).toBe('QUAD')
  })

  it('level multiplies clear points (single at level 4 = 400)', () => {
    // [TW-Scoring]: level multiplies clears/T-spins/combo only
    const e = game()
    e.level = 4
    antiPC(e)
    fillRow(e, BOARD_H - 1, [3, 4, 5, 6])
    setActive(e, 'I', 0, 3, BOARD_H - 2)
    lockByDelay(e)
    expect(e.score).toBe(400)
  })
})

describe('parity §3: T-spin scoring', () => {
  const b = BOARD_H - 1

  /** the TSS pocket from the 3-corner rule: T r180s point-down into it */
  function tspinSingleSetup(e: Engine, extraHoles: number[] = []) {
    fillRow(e, b, [1, ...extraHoles])
    fillCell(e, 0, b - 2) // overhang corner
    setActive(e, 'T', 0, 0, b - 2)
    e.applyAction('r180') // point fills the hole at x=1
  }

  it('T-spin no-lines = 400 × level', () => {
    // [TW-Scoring]: T-spin (0 lines) 400; 3-corner rule [TW-T-Spin]
    const e = game()
    tspinSingleSetup(e, [9]) // row stays incomplete → no clear
    lockByDelay(e)
    expect(e.lines).toBe(0)
    expect(e.score).toBe(400)
  })

  it('T-spin single = 800 × level', () => {
    const e = game()
    tspinSingleSetup(e)
    lockByDelay(e)
    expect(e.lines).toBe(1)
    expect(e.score).toBe(800)
    expect(e.takeEvents().some((x) => x.kind === 'clear' && x.info.label === 'T-SPIN SINGLE')).toBe(
      true,
    )
  })

  it('T-spin double = 1200 × level', () => {
    // classic TSD slot: T r180s into two rows it completes
    const e = game()
    fillRow(e, b - 1, [0, 1, 2])
    fillRow(e, b, [1])
    fillCell(e, 0, b - 2)
    setActive(e, 'T', 0, 0, b - 2)
    e.applyAction('r180')
    lockByDelay(e)
    expect(e.lines).toBe(2)
    expect(e.score).toBe(1200)
    expect(e.takeEvents().some((x) => x.kind === 'clear' && x.info.label === 'T-SPIN DOUBLE')).toBe(
      true,
    )
  })

  it('T-spin triple = 1600 × level, entered via the SRS (±1,−2) kick', () => {
    // The canonical TST chamber: CCW rotation falls through to SRS kick 5
    // ((+1,+2) screen coords), dropping the T two rows into the slot.
    // Kicks: [TW-SRS]; points: [TW-Scoring].
    const e = game()
    fillRow(e, 37, [4])
    fillRow(e, 38, [3, 4])
    fillRow(e, 39, [4])
    fillCell(e, 4, 35) // overhang sealing the chamber
    setActive(e, 'T', 0, 2, 35)
    e.applyAction('ccw')
    expect(e.active!.rot).toBe(3)
    expect(e.active!.x).toBe(3)
    expect(e.active!.y).toBe(37)
    lockByDelay(e)
    expect(e.lines).toBe(3)
    expect(e.score).toBe(1600)
    expect(e.takeEvents().some((x) => x.kind === 'clear' && x.info.label === 'T-SPIN TRIPLE')).toBe(
      true,
    )
  })

  /**
   * Mini pocket: T rotates under a single overhang; only one of the two
   * front (point-side) corners is filled → mini by the 3-corner rule
   * [TW-T-Spin]. Mini-TSD (400, "if present" [TW-Scoring]) has no
   * reachable setup without exotic kicks — value encoded in the engine
   * table, behavioral test omitted (documented in docs/parity.md §3).
   */
  function miniSetup(e: Engine, rowHoles: number[]) {
    fillRow(e, 39, rowHoles)
    fillCell(e, 0, 38)
    fillCell(e, 3, 38)
    fillCell(e, 0, 36) // blocks the (0,-2) escape kick
    setActive(e, 'T', 3, 1, 37)
    e.applyAction('cw') // settles point-up under the overhang at (0,38)
    expect(e.active!.rot).toBe(0)
    expect(e.active!.x).toBe(0)
    expect(e.active!.y).toBe(38)
  }

  it('mini T-spin no-lines = 100 × level', () => {
    const e = game()
    miniSetup(e, [0, 1, 2, 9]) // row 39 stays incomplete
    lockByDelay(e)
    expect(e.lines).toBe(0)
    expect(e.score).toBe(100)
  })

  it('mini T-spin single = 200 × level', () => {
    const e = game()
    miniSetup(e, [0, 1, 2])
    lockByDelay(e)
    expect(e.lines).toBe(1)
    expect(e.score).toBe(200)
    expect(
      e.takeEvents().some((x) => x.kind === 'clear' && x.info.label === 'T-SPIN MINI SINGLE'),
    ).toBe(true)
  })
})

describe('parity §3: back-to-back', () => {
  /** drop a vertical I into the column-0 well across rows 36–39 */
  function quad(e: Engine) {
    setActive(e, 'I', 1, -2, BOARD_H - 4)
    lockByDelay(e)
  }
  function prepQuadRows(e: Engine) {
    for (let r = 1; r <= 4; r++) fillRow(e, BOARD_H - r, [0])
  }

  it('applies ×1.5 from the second consecutive difficult clear', () => {
    // [TW-Scoring][PDF worked example]: the B2B bonus multiplies the action
    // score; the first clear of a chain is unbonused. (Engine applies the
    // ×1.5 before the level multiply — algebraically identical.)
    const e = game()
    antiPC(e)
    prepQuadRows(e)
    quad(e)
    expect(e.score).toBe(800) // first quad: no bonus
    prepQuadRows(e)
    quad(e)
    // second quad: 800 × 1.5 = 1200, plus 1-combo 50 (× level 1)
    expect(e.score).toBe(800 + 1200 + 50)
  })

  it('only Single/Double/Triple break the chain; a T-spin-0 neither breaks nor bonuses', () => {
    // [PDF][TW-Scoring]
    const e = game()
    antiPC(e)
    prepQuadRows(e)
    quad(e)
    const afterFirst = e.score
    // T-spin-0 between the quads (uses the standard 3-corner pocket high up)
    fillCell(e, 0, 30)
    fillCell(e, 0, 32)
    fillCell(e, 2, 32)
    setActive(e, 'T', 0, 0, 30)
    e.applyAction('r180')
    lockByDelay(e)
    expect(e.lines).toBe(4) // still only the quad's lines
    const afterSpin = e.score
    expect(afterSpin).toBe(afterFirst + 400)
    prepQuadRows(e)
    quad(e)
    expect(e.score).toBe(afterSpin + 1200) // B2B held through the T-spin-0
  })

  it('a plain single breaks the chain', () => {
    const e = game()
    antiPC(e)
    prepQuadRows(e)
    quad(e)
    fillRow(e, BOARD_H - 1, [3, 4, 5, 6])
    setActive(e, 'I', 0, 3, BOARD_H - 2)
    lockByDelay(e) // single: +100 + 1-combo 50
    const afterSingle = e.score
    expect(afterSingle).toBe(800 + 150)
    prepQuadRows(e)
    quad(e) // chain was broken: unbonused 800 + 2-combo 100
    expect(e.score).toBe(afterSingle + 800 + 100)
  })
})

describe('parity §3: combo', () => {
  function single(e: Engine) {
    fillRow(e, BOARD_H - 1, [3, 4, 5, 6])
    setActive(e, 'I', 0, 3, BOARD_H - 2)
    lockByDelay(e)
  }

  it('scores 50 × combo count × level; the first clear in a chain scores 0', () => {
    // [TW-Scoring][HD]: combo starts counting from the second consecutive clear
    const e = game()
    antiPC(e)
    single(e)
    expect(e.score).toBe(100)
    single(e)
    expect(e.score).toBe(100 + 100 + 50)
    single(e)
    expect(e.score).toBe(100 + 150 + 100 + 100)
  })

  it('resets on any non-clearing lock — including a T-spin-0', () => {
    // Standard semantics ([TW-Scoring]; pre-M1 tetra preserved combo
    // through T-spin-0 locks — fixed, docs/parity.md §3)
    const e = game()
    antiPC(e)
    single(e)
    single(e) // combo 1
    // T-spin-0 lock: scores 400 but clears nothing → combo must reset
    fillCell(e, 0, 30)
    fillCell(e, 0, 32)
    fillCell(e, 2, 32)
    setActive(e, 'T', 0, 0, 30)
    e.applyAction('r180')
    lockByDelay(e)
    const afterSpin = e.score
    single(e) // first clear of a NEW chain → no combo bonus
    expect(e.score).toBe(afterSpin + 100)
  })

  it('resets on a plain non-clearing lock', () => {
    const e = game()
    antiPC(e)
    single(e)
    single(e) // combo 1
    setActive(e, 'T', 0, 5, 30) // lock in the air column, clears nothing
    e.applyAction('hardDrop')
    const afterPlain = e.score
    single(e)
    expect(e.score).toBe(afterPlain + 100)
  })
})

describe('parity §3: perfect clears', () => {
  // [TW-Scoring]: PC bonuses 800/1200/1800/2000 × level, additive on top
  // of the clear score (Tetris Effect-era values; absent from [PDF] —
  // documented choice in docs/parity.md §3).

  it('single PC = 100 + 800', () => {
    const e = game()
    fillRow(e, BOARD_H - 1, [3, 4, 5, 6])
    setActive(e, 'I', 0, 3, BOARD_H - 2)
    lockByDelay(e)
    expect(e.score).toBe(900)
  })

  it('double PC = 300 + 1200', () => {
    const e = game()
    fillRow(e, BOARD_H - 2, [4, 5])
    fillRow(e, BOARD_H - 1, [4, 5])
    setActive(e, 'O', 0, 4, BOARD_H - 2)
    lockByDelay(e)
    expect(e.lines).toBe(2)
    expect(e.score).toBe(1500)
  })

  it('triple PC = 500 + 1800', () => {
    const e = game()
    fillRow(e, BOARD_H - 3, [4, 5])
    fillRow(e, BOARD_H - 2, [4])
    fillRow(e, BOARD_H - 1, [4])
    setActive(e, 'J', 1, 3, BOARD_H - 3)
    lockByDelay(e)
    expect(e.lines).toBe(3)
    expect(e.score).toBe(2300)
  })

  it('quad PC = 800 + 2000', () => {
    const e = game()
    for (let r = 1; r <= 4; r++) fillRow(e, BOARD_H - r, [0])
    setActive(e, 'I', 1, -2, BOARD_H - 4)
    lockByDelay(e)
    expect(e.lines).toBe(4)
    expect(e.score).toBe(2800)
  })

  it('B2B quad PC = 3200 bonus instead of 2000', () => {
    // [TW-Scoring]: "Back-to-back Tetris perfect clear 3200 × level"
    const e = game()
    for (let r = 1; r <= 8; r++) fillRow(e, BOARD_H - r, [0])
    setActive(e, 'I', 1, -2, BOARD_H - 4)
    lockByDelay(e) // first quad: 800, board keeps 4 garbage rows
    expect(e.score).toBe(800)
    setActive(e, 'I', 1, -2, BOARD_H - 4)
    lockByDelay(e) // B2B quad 1200 + 1-combo 50 + B2B-PC 3200
    expect(e.board.every((c) => c === 0)).toBe(true)
    expect(e.score).toBe(800 + 1200 + 50 + 3200)
  })
})

describe('parity §3: drop points', () => {
  it('hard drop +2/cell and soft drop +1/cell are flat, never level-multiplied', () => {
    // [TW-Scoring][PDF]: drop points are the only never-multiplied award
    const e = game()
    e.level = 7
    const dist = e.ghostY() - e.active!.y
    e.applyAction('hardDrop')
    expect(e.score).toBe(2 * dist)

    const soft = game()
    soft.level = 7
    const y0 = soft.active!.y
    soft.applyAction('softDropOn')
    soft.tick(100)
    const dropped = soft.active!.y - y0
    expect(dropped).toBeGreaterThan(0)
    expect(soft.score).toBe(dropped)
  })
})

// ── §4 Gravity, levels, randomizer, queue, hold ──────────────────

describe('parity §4: gravity', () => {
  it('follows the guideline curve (0.8 − (L−1)·0.007)^(L−1) seconds per row', () => {
    // [PDF §7][TW-Marathon], verbatim formula; tetra caps the curve at
    // level 20 and floors at 0.5 ms/row (documented in docs/parity.md §4)
    for (let level = 1; level <= 20; level++) {
      const secs = Math.pow(0.8 - (level - 1) * 0.007, level - 1)
      expect(gravityMsPerRow(level)).toBe(Math.max(secs * 1000, 0.5))
    }
    expect(gravityMsPerRow(25)).toBe(gravityMsPerRow(20)) // capped
  })

  it('moves the piece down exactly once per gravity interval at level 1', () => {
    const e = game()
    const y0 = e.active!.y
    e.tick(999)
    expect(e.active!.y).toBe(y0)
    e.tick(2)
    expect(e.active!.y).toBe(y0 + 1)
  })

  it('soft drop multiplies gravity by SDF (default 20)', () => {
    // [PDF §7.1] suggests 20×; [TIO] SDF settable 5–41 (41 = ∞)
    const e = game()
    expect(e.cfg.sdf).toBe(20)
    const y0 = e.active!.y
    e.applyAction('softDropOn')
    e.tick(49) // 1000/20 = 50 ms per row
    expect(e.active!.y).toBe(y0)
    e.tick(2)
    expect(e.active!.y).toBe(y0 + 1)
  })
})

describe('parity §4: marathon levelling (Decision D3)', () => {
  function clearSingle(e: Engine) {
    fillRow(e, BOARD_H - 1, [3, 4, 5, 6])
    setActive(e, 'I', 0, 3, BOARD_H - 2)
    lockByDelay(e)
  }

  it('levels up every 10 lines', () => {
    // [TW-Marathon]: fixed goal, 10 lines per level
    const e = game()
    antiPC(e)
    e.lines = 9
    clearSingle(e)
    expect(e.lines).toBe(10)
    expect(e.level).toBe(2)
    expect(e.takeEvents().some((x) => x.kind === 'levelup' && x.level === 2)).toBe(true)
  })

  it('ends as a win on completing level 15 (150 lines)', () => {
    // [TW-Marathon] typical cap: 15 levels / 150 lines; Decision D3
    const e = game()
    antiPC(e)
    e.lines = 149
    e.level = 15
    clearSingle(e)
    expect(e.lines).toBe(150)
    expect(e.status).toBe('won')
    expect(e.level).toBe(15)
    expect(e.takeEvents().some((x) => x.kind === 'win')).toBe(true)
  })
})

describe('parity §4: 7-bag randomizer', () => {
  it('deals every piece exactly once per bag, deterministically by seed', () => {
    // [PDF §3.3][TW-Random_Generator]: pure Random Generator (7-bag)
    const a = new SevenBag(2026)
    const b = new SevenBag(2026)
    for (let round = 0; round < 50; round++) {
      const seen = new Set<PieceType>()
      for (let i = 0; i < 7; i++) {
        const piece = a.next()
        seen.add(piece)
        expect(b.next()).toBe(piece)
      }
      expect(seen.size).toBe(7)
    }
  })

  it('imposes no first-bag constraint', () => {
    // Guideline specifies none; TETR.IO's S/Z/O-skip is stride-mode only [BD]
    const firsts = new Set<PieceType>()
    for (let seed = 0; seed < 300; seed++) firsts.add(new SevenBag(seed).next())
    expect(firsts.has('S') || firsts.has('Z')).toBe(true)
    expect(firsts.has('O')).toBe(true)
  })
})

describe('parity §4: queue & hold', () => {
  it('always exposes at least 5 previews', () => {
    // [TIO] nextcount default 5 · [JS] default 5
    const e = game()
    expect(e.cfg.queueSize).toBe(5)
    expect(e.queue.length).toBeGreaterThanOrEqual(5)
    e.applyAction('hold')
    expect(e.queue.length).toBeGreaterThanOrEqual(5)
    for (let i = 0; i < 10; i++) e.applyAction('hardDrop')
    expect(e.queue.length).toBeGreaterThanOrEqual(5)
  })

  it('hold swaps, resets orientation to spawn, and re-enables only after a lock down', () => {
    // [PDF §5.6]: "A Lock Down must take place between Holds"; the held
    // piece returns in its spawn orientation. holdUsed drives the dimmed
    // hold preview (docs/parity.md §4).
    const e = game()
    spawnFresh(e, 'T')
    e.applyAction('cw')
    expect(e.active!.rot).toBe(1)
    e.applyAction('hold')
    expect(e.hold).toBe('T')
    expect(e.holdUsed).toBe(true)
    const swapped = e.active!.type
    e.applyAction('hold') // no-op until a lock
    expect(e.active!.type).toBe(swapped)
    e.applyAction('hardDrop')
    expect(e.holdUsed).toBe(false)
    e.applyAction('hold')
    expect(e.active!.type).toBe('T')
    expect(e.active!.rot).toBe(0) // orientation reset, not the rotated state
  })
})
