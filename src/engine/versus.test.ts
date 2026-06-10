/**
 * Versus substrate (spec Phase 2): attack table ([WN] winternebs
 * TETRIS-FAQ /versus/, verified in the Phase-0 audit), garbage
 * queue → cancel → enter, messiness + change-on-attack holes, scripted
 * pressure, and complete headless matches.
 */
import { describe, expect, it } from 'vitest'
import { DEFAULT_ATTACK_CONFIG, attackFor } from './attack'
import { Engine } from './engine'
import { BOARD_H, BOARD_W } from './pieces'
import { STEP_MS } from './replay'
import { Match, ScriptedPressureOpponent } from './versus'
import type { EngineConfig, Mode, PieceType, Rot } from './types'

const A = DEFAULT_ATTACK_CONFIG

function atk(partial: Partial<Parameters<typeof attackFor>[0]>): number {
  return attackFor(
    { lines: 0, tspin: 'none', b2b: false, combo: 0, perfectClear: false, ...partial },
    A,
  )
}

describe('attack table ([WN] guideline standard)', () => {
  it('plain clears send 0/1/2/4', () => {
    expect(atk({ lines: 1 })).toBe(0)
    expect(atk({ lines: 2 })).toBe(1)
    expect(atk({ lines: 3 })).toBe(2)
    expect(atk({ lines: 4 })).toBe(4)
  })

  it('T-spins send 2/4/6, minis 0/1', () => {
    expect(atk({ lines: 1, tspin: 'full' })).toBe(2)
    expect(atk({ lines: 2, tspin: 'full' })).toBe(4)
    expect(atk({ lines: 3, tspin: 'full' })).toBe(6)
    expect(atk({ lines: 1, tspin: 'mini' })).toBe(0)
    expect(atk({ lines: 2, tspin: 'mini' })).toBe(1)
  })

  it('B2B adds +1 per attack', () => {
    expect(atk({ lines: 4, b2b: true })).toBe(5)
    expect(atk({ lines: 2, tspin: 'full', b2b: true })).toBe(5)
  })

  it('combo bonus is additive, FAQ table 0,0,1,1,1,2,2,3,3,4,4,4,5 from 1-combo', () => {
    expect(atk({ lines: 1, combo: 1 })).toBe(0)
    expect(atk({ lines: 1, combo: 2 })).toBe(0)
    expect(atk({ lines: 1, combo: 3 })).toBe(1)
    expect(atk({ lines: 1, combo: 6 })).toBe(2)
    expect(atk({ lines: 1, combo: 13 })).toBe(5)
    expect(atk({ lines: 1, combo: 20 })).toBe(5) // clamps at the table end
    expect(atk({ lines: 4, combo: 3 })).toBe(5) // stacks with the clear's attack
  })

  it('perfect clear adds +10 (config; clients range 5–10)', () => {
    expect(atk({ lines: 4, perfectClear: true })).toBe(14)
    expect(A.perfectClear).toBe(10)
  })

  it('a T-spin-0 sends nothing', () => {
    expect(atk({ lines: 0, tspin: 'full' })).toBe(0)
  })
})

// ── engine integration ───────────────────────────────────────────

function game(cfg: Partial<EngineConfig> & { seed?: number; mode?: Mode } = {}) {
  const e = new Engine({ seed: 42, mode: 'battle', ...cfg })
  e.start()
  return e
}

function setActive(e: Engine, type: PieceType, rot: Rot, x: number, y: number) {
  e.active!.type = type
  e.active!.rot = rot
  e.active!.x = x
  e.active!.y = y
}

function fillRow(e: Engine, y: number, holes: number[] = []) {
  for (let x = 0; x < BOARD_W; x++) {
    e.board[y * BOARD_W + x] = holes.includes(x) ? 0 : 8
  }
}

/** lock a vertical I into the column-0 well across the bottom 4 rows */
function quad(e: Engine) {
  for (let r = 1; r <= 4; r++) fillRow(e, BOARD_H - r, [0])
  setActive(e, 'I', 1, -2, BOARD_H - 4)
  e.tick(e.cfg.lockDelay + 1)
}

function garbageHoles(e: Engine, rows: number): number[] {
  const holes: number[] = []
  for (let r = 1; r <= rows; r++) {
    for (let x = 0; x < BOARD_W; x++) {
      if (e.cellAt(x, BOARD_H - r) === 0) holes.push(x)
    }
  }
  return holes
}

describe('garbage queue → cancel → enter', () => {
  it('outgoing attack cancels pending garbage first, remainder sends', () => {
    const e = game()
    e.board[20 * BOARD_W + 9] = 8 // anti-PC junk
    e.queueGarbage(3)
    expect(e.pendingGarbage()).toBe(3)
    quad(e) // 4 attack: 3 cancelled, 1 sent
    const evs = e.takeEvents()
    const sent = evs.find((x) => x.kind === 'attack')
    expect(sent && sent.kind === 'attack' && sent.lines).toBe(1)
    expect(e.pendingGarbage()).toBe(0)
    expect(evs.some((x) => x.kind === 'garbage')).toBe(false) // nothing entered
  })

  it('partial cancel: the uncancelled remainder enters on that same lock', () => {
    // "uncancelled garbage enters when a piece locks" — a clearing lock
    // is still a lock, so what survives cancellation rises immediately
    const e = game()
    e.board[20 * BOARD_W + 9] = 8
    e.queueGarbage(5)
    quad(e) // 4 attack cancels 4 of 5; the last line enters
    const evs = e.takeEvents()
    expect(evs.some((x) => x.kind === 'attack')).toBe(false)
    const g = evs.find((x) => x.kind === 'garbage')
    expect(g && g.kind === 'garbage' && g.rows).toBe(1)
    expect(e.pendingGarbage()).toBe(0)
  })

  it('clean attacks share one hole; the hole re-rolls between attacks (change on attack)', () => {
    const e = game({ seed: 7 }) // messiness 0 by default
    e.queueGarbage(4)
    e.applyAction('hardDrop')
    let holes = garbageHoles(e, 4)
    expect(new Set(holes).size).toBe(1) // one attack, one hole column

    // a second engine receiving two separate attacks re-rolls between them
    const e2 = game({ seed: 1000 })
    e2.queueGarbage(2)
    e2.queueGarbage(2)
    e2.applyAction('hardDrop')
    holes = garbageHoles(e2, 4)
    expect(new Set(holes.slice(0, 2)).size).toBe(1) // second attack (on top)
    expect(new Set(holes.slice(2)).size).toBe(1) // first attack (below)
    expect(holes[0]).not.toBe(holes[2]) // seed 1000 picked: holes 9 then 4
  })

  it('messiness 1 moves the hole on every line within an attack', () => {
    const e = game({ attack: { ...A, messiness: 1 } })
    e.queueGarbage(6)
    e.applyAction('hardDrop')
    const holes = garbageHoles(e, 6)
    expect(holes.length).toBe(6)
    for (let i = 1; i < holes.length; i++) {
      expect(holes[i]).not.toBe(holes[i - 1]) // every adjacent pair differs
    }
  })

  it('garbage entry is deterministic for a seed', () => {
    const run = () => {
      const e = game({ seed: 99, attack: { ...A, messiness: 0.5 } })
      e.queueGarbage(8)
      e.applyAction('hardDrop')
      return garbageHoles(e, 8).join(',')
    }
    expect(run()).toBe(run())
  })

  it('a flood that pushes the stack above the buffer tops the player out', () => {
    const e = game()
    e.queueGarbage(45) // taller than the whole board
    e.applyAction('hardDrop')
    expect(e.status).toBe('over')
  })
})

// ── scripted pressure ────────────────────────────────────────────

describe('ScriptedPressureOpponent', () => {
  it('averages its configured APM and is seed-deterministic', () => {
    const run = (seed: number) => {
      const o = new ScriptedPressureOpponent({ seed, apm: 60, hp: 100 })
      const sent: number[] = []
      for (let t = 0; t < 60_000; t += STEP_MS) {
        o.tick(STEP_MS)
        sent.push(...o.takeOutgoing())
      }
      return sent
    }
    const a = run(5)
    const total = a.reduce((x, y) => x + y, 0)
    expect(total).toBeGreaterThanOrEqual(55) // one minute at 60 lines/min,
    expect(total).toBeLessThanOrEqual(65) // modulo the trailing burst
    expect(run(5)).toEqual(a)
    expect(run(6)).not.toEqual(a)
  })

  it('takes damage and stops attacking at 0 hp', () => {
    const o = new ScriptedPressureOpponent({ seed: 1, apm: 600, hp: 5 })
    o.receiveAttack(4)
    expect(o.hp).toBe(1)
    o.receiveAttack(4)
    expect(o.hp).toBe(0)
    o.tick(60_000)
    expect(o.takeOutgoing()).toEqual([])
  })
})

// ── full matches, headless ───────────────────────────────────────

describe('Match', () => {
  it('player depletes the opponent HP and wins', () => {
    const opponent = new ScriptedPressureOpponent({ seed: 2, apm: 10, hp: 8 })
    const match = new Match({ seed: 11 }, opponent)
    match.start()
    match.engine.board[20 * BOARD_W + 9] = 8 // anti-PC junk
    quad(match.engine) // 4 attack
    match.tick(STEP_MS)
    expect(opponent.hp).toBe(4)
    expect(match.status).toBe('playing')
    quad(match.engine) // B2B quad: 5 attack → hp 0
    match.tick(STEP_MS)
    expect(opponent.hp).toBe(0)
    expect(match.status).toBe('won')
    expect(match.takeEvents().some((e) => e.kind === 'win')).toBe(true)
  })

  it('player buried under scripted pressure loses', () => {
    // heavy pressure, idle player: pieces gravity-lock while garbage floods in
    const opponent = new ScriptedPressureOpponent({ seed: 3, apm: 600, hp: 1000 })
    const match = new Match({ seed: 12 }, opponent)
    match.start()
    for (let t = 0; t < 300_000 && match.status === 'playing'; t += STEP_MS) {
      match.tick(STEP_MS)
    }
    expect(match.status).toBe('lost')
    expect(match.engine.status).toBe('over')
  })

  it('a full active match runs deterministically end to end', () => {
    const run = () => {
      const opponent = new ScriptedPressureOpponent({ seed: 21, apm: 120, hp: 40 })
      const match = new Match({ seed: 31 }, opponent)
      match.start()
      const log: string[] = []
      for (let step = 0; step < 24_000 && match.status === 'playing'; step++) {
        if (step % 120 === 0) match.applyAction('left')
        if (step % 90 === 0) match.applyAction('cw')
        if (step % 50 === 0) match.applyAction('hardDrop')
        match.tick(STEP_MS)
        for (const ev of match.takeEvents()) {
          if (ev.kind === 'attack' || ev.kind === 'garbage') log.push(`${step}:${ev.kind}`)
        }
      }
      return { status: match.status, hp: opponent.hp, log: log.join('|') }
    }
    const a = run()
    expect(a.status).not.toBe('playing') // pressure resolves the match either way
    expect(run()).toEqual(a) // and identically every time
  })

  it('routes opponent bursts into the player engine garbage meter', () => {
    const opponent = new ScriptedPressureOpponent({ seed: 4, apm: 240, hp: 100 })
    const match = new Match({ seed: 13 }, opponent)
    match.start()
    for (let t = 0; t < 5_000; t += STEP_MS) match.tick(STEP_MS)
    expect(match.engine.pendingGarbage()).toBeGreaterThan(0)
  })
})
