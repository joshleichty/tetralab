import { describe, expect, it } from 'vitest'
import { Engine } from '../engine/engine.ts'
import { createRng } from '../engine/rng.ts'
import { INSTANT_SDF, type GameEvent, type PieceType } from '../engine/types.ts'
import { cellsKeyOf, enumerate, enumerateCandidates } from './enumerate.ts'
import { executePlan } from './execute.ts'
import { planFor } from './path.ts'
import { positionFromRows } from './position.ts'
import type { Placement, Position } from './types.ts'

const PIECES: PieceType[] = ['I', 'O', 'T', 'S', 'Z', 'J', 'L']

/** engine with a scripted board + queue, instant soft drop */
function engineFor(rows: string[] | null, queue: PieceType[], seed = 1): Engine {
  const e = new Engine({ seed, mode: 'marathon', sdf: INSTANT_SDF })
  e.setQueue(queue)
  if (rows) e.setBoard(rows)
  e.start()
  return e
}

function lockEvents(events: GameEvent[]) {
  return events.flatMap((ev) => (ev.kind === 'lock' ? [ev] : []))
}

/** execute the plan for `p` on a fresh engine; assert the lock matches */
function roundTrip(rows: string[] | null, pos: Position, p: Placement, queue: PieceType[]) {
  const e = engineFor(rows, queue)
  const plan = planFor(pos, p)
  expect(plan, `no plan for ${p.type} rot${p.rot} @ (${p.x},${p.y})`).not.toBeNull()
  e.takeEvents()
  executePlan(e, plan!)
  const locks = lockEvents(e.takeEvents())
  expect(locks).toHaveLength(1)
  expect(cellsKeyOf(locks[0].cells)).toBe(cellsKeyOf(p.cells))
}

describe('enumerate: empty board (finesse-set parity)', () => {
  // distinct placements per piece on an empty board — the same identities
  // finesse.ts collapses to (rot-duplicates merged): community-standard
  // counts (T/J/L 4 distinct rots = 34, S/Z/I 2 = 17, O 1 = 9)
  const EXPECTED: Record<PieceType, number> = { I: 17, O: 9, T: 34, S: 17, Z: 17, J: 34, L: 34 }

  for (const t of PIECES) {
    it(`finds exactly ${EXPECTED[t]} placements for ${t}, all hard-drop-only`, () => {
      const pos = positionFromRows([], t, { holdUsed: true })
      const placements = enumerate(pos)
      expect(placements).toHaveLength(EXPECTED[t])
      for (const p of placements) {
        expect(p.spin).toBe('none')
        expect(p.hardDropOnly).toBe(true)
        expect(p.usedHold).toBe(false)
      }
    })
  }

  it('round-trips every empty-board placement through a real engine', () => {
    for (const t of PIECES) {
      const pos = positionFromRows([], t, { holdUsed: true })
      for (const p of enumerate(pos)) roundTrip(null, pos, p, [t])
    }
  })

  it('is deterministic: same position, identical output', () => {
    const pos = positionFromRows([], 'T', { holdUsed: true })
    expect(JSON.stringify(enumerate(pos))).toBe(
      JSON.stringify(enumerate(positionFromRows([], 'T', { holdUsed: true }))),
    )
  })
})

describe('enumerate: hold', () => {
  it('includes the hold piece (from queue when hold is empty), plans prefixed with hold', () => {
    const pos = positionFromRows([], 'T', { queue: ['I'] })
    const placements = enumerate(pos)
    expect(placements.filter((p) => !p.usedHold)).toHaveLength(34) // T
    expect(placements.filter((p) => p.usedHold)).toHaveLength(17) // I via hold
    // canonical order puts non-hold first
    expect(placements.findIndex((p) => p.usedHold)).toBe(34)
  })

  it('skips hold when already used, or when it yields the same piece', () => {
    expect(
      enumerate(positionFromRows([], 'T', { queue: ['I'], holdUsed: true })),
    ).toHaveLength(34)
    expect(enumerate(positionFromRows([], 'T', { hold: 'T' }))).toHaveLength(34)
  })

  it('round-trips a hold placement', () => {
    const pos = positionFromRows([], 'T', { queue: ['I'] })
    const iFlat = enumerate(pos).find((p) => p.usedHold && p.rot === 0)!
    roundTrip(null, pos, iFlat, ['T', 'I'])
  })
})

describe('enumerate: spins and tucks (fixture boards)', () => {
  // classic TSD chamber (shape from parity.test.ts §3): T must soft-drop
  // beside the slot and rotate in; locks cells (0,38)(1,38)(2,38)(1,39)
  const TSD_ROWS = [
    'X_________', // row 37: overhang corner
    '___XXXXXXX', // row 38
    'X_XXXXXXXX', // row 39
  ]

  it('finds the TSD as a full spin, soft-drop-only', () => {
    const pos = positionFromRows(TSD_ROWS, 'T', { holdUsed: true })
    const tsd = enumerate(pos).find(
      (p) =>
        p.spin === 'full' &&
        cellsKeyOf(p.cells) ===
          cellsKeyOf([
            [0, 38],
            [1, 38],
            [2, 38],
            [1, 39],
          ]),
    )
    expect(tsd).toBeDefined()
    expect(tsd!.hardDropOnly).toBe(false)
    expect(tsd!.rot).toBe(2)
  })

  it('executes the TSD plan: the engine clears T-SPIN DOUBLE', () => {
    const e = engineFor(TSD_ROWS, ['T', 'I', 'O'])
    const pos = e.snapshot()!
    const tsd = enumerate(pos).find((p) => p.spin === 'full' && p.cells.some(([, y]) => y === 39))!
    const plan = planFor(pos, tsd)!
    e.takeEvents()
    executePlan(e, plan)
    const events = e.takeEvents()
    expect(events.some((ev) => ev.kind === 'clear' && ev.info.label === 'T-SPIN DOUBLE')).toBe(true)
    expect(e.lines).toBe(2)
  })

  // the canonical TST chamber (parity.test.ts §3): entered only via the
  // final (±1,∓2) SRS kick; locks cells (4,37)(3,38)(4,38)(4,39)
  const TST_ROWS = [
    '____X_____', // row 35: overhang sealing the chamber
    '__________', // row 36
    'XXXX_XXXXX', // row 37
    'XXX__XXXXX', // row 38
    'XXXX_XXXXX', // row 39
  ]

  it('finds the kick-only TST and executes it: T-SPIN TRIPLE', () => {
    const e = engineFor(TST_ROWS, ['T', 'I', 'O'])
    const pos = e.snapshot()!
    const tst = enumerate(pos).find(
      (p) =>
        p.spin === 'full' &&
        cellsKeyOf(p.cells) ===
          cellsKeyOf([
            [4, 37],
            [3, 38],
            [4, 38],
            [4, 39],
          ]),
    )
    expect(tst).toBeDefined()
    expect(tst!.hardDropOnly).toBe(false)
    const plan = planFor(pos, tst!)!
    e.takeEvents()
    executePlan(e, plan)
    const events = e.takeEvents()
    expect(events.some((ev) => ev.kind === 'clear' && ev.info.label === 'T-SPIN TRIPLE')).toBe(true)
    expect(e.lines).toBe(3)
  })

  // wall mini: T drops beside the col-0 notch, CW kicks off the wall
  // (kick index 1, one front corner) — mini, and the engine must agree
  const MINI_ROWS = [
    '___XXXXXXX', // row 38
    '_XXXXXXXXX', // row 39: the notch; (1,39) is the third corner
  ]

  it('finds the wall mini and the engine labels it T-SPIN MINI SINGLE', () => {
    const e = engineFor(MINI_ROWS, ['T', 'I', 'O'])
    const pos = e.snapshot()!
    const minis = enumerate(pos).filter((p) => p.spin === 'mini')
    const target = minis.find(
      (p) =>
        cellsKeyOf(p.cells) ===
        cellsKeyOf([
          [0, 37],
          [0, 38],
          [1, 38],
          [0, 39],
        ]),
    )
    expect(target).toBeDefined()
    const plan = planFor(pos, target!)!
    e.takeEvents()
    executePlan(e, plan)
    const events = e.takeEvents()
    expect(events.some((ev) => ev.kind === 'clear' && ev.info.label === 'T-SPIN MINI SINGLE')).toBe(
      true,
    )
  })

  // a ledge the I must duck under: straight drop at x=0 rests on top,
  // the tuck slides underneath along the floor
  const TUCK_ROWS = [
    'XX________', // row 37: floating ledge
    '__________', // row 38
    '__________', // row 39
  ]

  it('finds the I tuck under a ledge (and the rest on top of it)', () => {
    const pos = positionFromRows(TUCK_ROWS, 'I', { holdUsed: true })
    const placements = enumerate(pos)
    const floor = (x0: number, y: number) =>
      cellsKeyOf([0, 1, 2, 3].map((i) => [x0 + i, y] as [number, number]))

    const tuck = placements.find((p) => cellsKeyOf(p.cells) === floor(0, 39))
    expect(tuck).toBeDefined()
    expect(tuck!.hardDropOnly).toBe(false)

    const onLedge = placements.find((p) => cellsKeyOf(p.cells) === floor(0, 36))
    expect(onLedge).toBeDefined()
    expect(onLedge!.hardDropOnly).toBe(true)

    roundTrip(TUCK_ROWS, pos, tuck!, ['I'])
  })
})

describe('round-trip property: every claim proven by the engine', () => {
  /** drive a whole game by picking seeded-random enumerated placements */
  function dogfood(
    mode: 'marathon' | 'cheese',
    seed: number,
    pieces: number,
    between?: (e: Engine, i: number) => void,
  ) {
    const e = new Engine({ seed, mode, sdf: INSTANT_SDF })
    e.start()
    const rng = createRng(seed ^ 0xbeef)
    for (let i = 0; i < pieces && e.status === 'playing'; i++) {
      const pos = e.snapshot()!
      const candidates = enumerate(pos)
      expect(candidates.length).toBeGreaterThan(0)
      const pick = candidates[Math.floor(rng() * candidates.length)]
      const plan = planFor(pos, pick)
      expect(plan).not.toBeNull()
      e.takeEvents()
      executePlan(e, plan!)
      const locks = lockEvents(e.takeEvents())
      expect(locks).toHaveLength(1)
      expect(cellsKeyOf(locks[0].cells)).toBe(cellsKeyOf(pick.cells))
      between?.(e, i)
    }
  }

  it('holds across a random marathon game (30 pieces)', () => {
    dogfood('marathon', 11, 30)
  })

  it('holds across a cheese board (15 pieces)', () => {
    dogfood('cheese', 3, 15)
  })

  it('holds across survival-style rising garbage (cheese row every 3rd piece)', () => {
    // survival's timed rise is insertCheese(1) (engine.ts); inserting
    // between placements exercises the same boards without racing the
    // plan against the rise timer
    dogfood('marathon', 5, 18, (e, i) => {
      if (i % 3 === 2) e.insertCheese(1)
    })
  })

  /** build a real mid-game stack deterministically */
  function buildMidGame(seed: number, pieces: number): Engine {
    const builder = new Engine({ seed, mode: 'marathon', sdf: INSTANT_SDF })
    builder.start()
    const rng = createRng(77)
    for (let i = 0; i < pieces && builder.status === 'playing'; i++) {
      const pos = builder.snapshot()!
      const candidates = enumerate(pos).filter((p) => !p.usedHold)
      executePlan(builder, planFor(pos, candidates[Math.floor(rng() * candidates.length)])!)
    }
    expect(builder.status).toBe('playing')
    return builder
  }

  it('verifies every placement on a mid-game stack, exhaustively', () => {
    const builder = buildMidGame(21, 12)
    const pos = builder.snapshot()!
    const rows: string[] = []
    for (let y = 0; y < 40; y++) {
      let s = ''
      for (let x = 0; x < 10; x++) s += pos.board[y * 10 + x] === 0 ? '_' : 'X'
      rows.push(s)
    }
    for (const p of enumerate(pos)) {
      roundTrip(rows, pos, p, [pos.piece, ...(pos.hold ? [pos.hold] : pos.queue)])
    }
  })

  it('enumerate + plans stay within the perf budget on a mid-game board', () => {
    const pos = buildMidGame(33, 12).snapshot()!
    enumerateCandidates(pos) // warm-up
    const N = 50
    const t0 = performance.now()
    for (let i = 0; i < N; i++) enumerateCandidates(pos)
    const avg = (performance.now() - t0) / N
    console.log(`enumerateCandidates (both pieces, with plans): ${avg.toFixed(3)}ms avg`)
    expect(avg).toBeLessThan(10) // generous ceiling; typical is well under 1ms
  })
})
