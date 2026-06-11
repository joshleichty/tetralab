/**
 * Training hooks (spec training-core §7): lesson mode, setBoard, setQueue,
 * place-by-spec — the substrate the lesson runtime (M2) drives.
 */
import { describe, expect, it } from 'vitest'
import { Engine } from './engine'
import { formatBoard } from './board'
import { BOARD_H, BOARD_W } from './pieces'
import type { GameEvent, PieceType } from './types'

function lessonEngine(rows?: string[], queue?: PieceType[]): Engine {
  const e = new Engine({ seed: 1, mode: 'lesson' })
  if (rows) e.setBoard(rows)
  if (queue) e.setQueue(queue)
  e.start()
  return e
}

function lockEvents(e: Engine): Array<Extract<GameEvent, { kind: 'lock' }>> {
  return e.takeEvents().filter((ev) => ev.kind === 'lock')
}

describe('lesson mode', () => {
  it('exerts no gravity: the piece floats however long time passes', () => {
    const e = lessonEngine()
    const y = e.active!.y
    e.tick(60_000)
    expect(e.active!.y).toBe(y)
    expect(e.status).toBe('playing')
  })

  it('never auto-locks a grounded piece', () => {
    const e = lessonEngine(undefined, ['T'])
    e.applyAction('softDropOn') // ride soft drop to the floor
    e.tick(5_000)
    e.applyAction('softDropOff')
    expect(e.canFit(e.active!.x, e.active!.y + 1, e.active!.rot)).toBe(false) // grounded
    e.tick(60_000) // far beyond any lock delay
    expect(e.piecesPlaced).toBe(0)
    expect(e.active!.type).toBe('T')
    e.applyAction('hardDrop') // locking stays player-controlled
    expect(e.piecesPlaced).toBe(1)
  })

  it('soft drop still moves the piece (time the lesson allows)', () => {
    const e = lessonEngine()
    const y = e.active!.y
    e.applyAction('softDropOn')
    e.tick(1_000)
    expect(e.active!.y).toBeGreaterThan(y)
  })

  it('has no win condition: 40+ cleared lines do not end the game', () => {
    const e = new Engine({ seed: 1, mode: 'lesson' })
    e.setQueue(new Array<PieceType>(12).fill('I'))
    e.start()
    for (let i = 0; i < 11; i++) {
      e.setBoard(['XXXXXXXXX_', 'XXXXXXXXX_', 'XXXXXXXXX_', 'XXXXXXXXX_'])
      expect(e.place({ type: 'I', rot: 1, x: 7 })).toBe(true) // vertical I down column 9
    }
    expect(e.lines).toBe(44)
    expect(e.status).toBe('playing')
  })
})

describe('setBoard', () => {
  it('loads row strings bottom-aligned', () => {
    const e = lessonEngine(['T_________', 'XXXXXXXXX_'])
    expect(formatBoard(e.board, 2)).toEqual(['T_________', 'XXXXXXXXX_'])
  })

  it('accepts a full flat array', () => {
    const flat = new Uint8Array(BOARD_W * BOARD_H)
    flat[BOARD_W * BOARD_H - 1] = 8
    const e = new Engine({ seed: 1, mode: 'lesson' })
    e.setBoard(flat)
    expect(e.cellAt(9, BOARD_H - 1)).toBe(8)
  })

  it('rejects malformed input', () => {
    const e = new Engine({ seed: 1, mode: 'lesson' })
    expect(() => e.setBoard(['nope'])).toThrow()
    expect(() => e.setBoard(new Uint8Array(3))).toThrow(/cells/)
  })
})

describe('setQueue', () => {
  it('scripts the upcoming pieces, then the seeded bag resumes', () => {
    const e = new Engine({ seed: 7, mode: 'lesson' })
    e.setQueue(['T', 'I', 'O'])
    e.start()
    expect(e.active!.type).toBe('T')
    e.applyAction('hardDrop')
    expect(e.active!.type).toBe('I')
    e.applyAction('hardDrop')
    expect(e.active!.type).toBe('O')
    // the bag refilled the preview behind the script
    expect(e.queue.length).toBe(e.cfg.queueSize + 1)
  })

  it('is deterministic: same seed + same script ⇒ same resumed bag', () => {
    const run = () => {
      const e = new Engine({ seed: 7, mode: 'lesson' })
      e.setQueue(['T'])
      e.start()
      e.applyAction('hardDrop')
      return [e.active!.type, ...e.queue].join('')
    }
    expect(run()).toBe(run())
  })

  it('a script longer than the preview drains back to normal length', () => {
    const e = new Engine({ seed: 7, mode: 'lesson' })
    const script: PieceType[] = ['T', 'I', 'O', 'S', 'Z', 'J', 'L', 'T', 'I', 'O']
    e.setQueue(script)
    e.start()
    for (let i = 0; i < script.length; i++) {
      expect(e.active!.type).toBe(script[i])
      e.applyAction('hardDrop')
    }
    expect(e.queue.length).toBe(e.cfg.queueSize + 1)
  })
})

describe('place', () => {
  it('drops the piece straight down at (rot, x) and locks it', () => {
    const e = lessonEngine(undefined, ['T'])
    expect(e.place({ type: 'T', rot: 2, x: 6 })).toBe(true)
    const [lock] = lockEvents(e)
    expect(lock.piece).toEqual({ type: 'T', rot: 2, x: 6 })
    // T 180 (flat side up) rests its row on the floor
    expect(e.cellAt(7, BOARD_H - 1)).not.toBe(0)
  })

  it('pulls the requested piece via hold when needed', () => {
    const e = lessonEngine(undefined, ['T', 'I'])
    expect(e.place({ type: 'I', rot: 0, x: 0 })).toBe(true)
    expect(e.hold).toBe('T')
    expect(lockEvents(e)[0].piece.type).toBe('I')
  })

  it('returns false, state untouched, when the piece is unavailable', () => {
    const e = lessonEngine(undefined, ['T', 'I'])
    e.applyAction('hold') // hold burned on T; active I, hold T
    expect(e.place({ type: 'S', rot: 0, x: 3 })).toBe(false)
    expect(e.active!.type).toBe('I')
    expect(e.piecesPlaced).toBe(0)
  })

  it('returns false when the placement cannot be reached by a straight drop', () => {
    const full = new Uint8Array(BOARD_W * BOARD_H)
    for (let y = 0; y < BOARD_H; y++) full[y * BOARD_W] = 8 // column 0 filled to the very top
    const e = new Engine({ seed: 1, mode: 'lesson' })
    e.setBoard(full)
    e.setQueue(['I'])
    e.start()
    expect(e.place({ type: 'I', rot: 1, x: -2 })).toBe(false) // vertical I into column 0
    expect(e.active!.type).toBe('I')
  })

  it('clears lines like any other lock', () => {
    const e = lessonEngine(['XXXXXXXXX_', 'XXXXXXXXX_'], ['I'])
    expect(e.place({ type: 'I', rot: 1, x: 7 })).toBe(true) // vertical I down column 9
    expect(e.lines).toBe(2)
    expect(e.takeEvents().some((ev) => ev.kind === 'clear')).toBe(true)
  })
})
