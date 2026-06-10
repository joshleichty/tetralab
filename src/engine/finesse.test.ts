/**
 * Finesse optimum table (docs/parity.md §8, [HD-Finesse]): minimal
 * keypresses from spawn — taps, DAS-to-wall (1 press), rotations (1 each).
 */
import { describe, expect, it } from 'vitest'
import { Engine } from './engine'
import { optimalInputs } from './finesse'
import { BOARD_W, CELLS } from './pieces'
import type { PieceType, Rot } from './types'

function validX(type: PieceType, rot: Rot, x: number): boolean {
  return CELLS[type][rot].every(([dx]) => x + dx >= 0 && x + dx < BOARD_W)
}

describe('finesse optimums', () => {
  it('spawn-column hard drop needs zero inputs', () => {
    for (const type of ['I', 'O', 'T', 'S', 'Z', 'J', 'L'] as PieceType[]) {
      const e = new Engine({ seed: 3, mode: 'marathon' })
      e.start()
      e.queue[0] = type
      e.applyAction('hardDrop')
      const p = e.active!
      expect(optimalInputs(p.type, p.rot, p.x)).toBe(0)
    }
  })

  it('walls are one DAS press away', () => {
    // [HD-Finesse]: holding a direction to the wall is a single input
    expect(optimalInputs('T', 0, 0)).toBe(1) // T flush left
    expect(optimalInputs('T', 0, 7)).toBe(1) // T flush right
    expect(optimalInputs('O', 0, 0)).toBe(1)
    expect(optimalInputs('O', 0, 8)).toBe(1)
    expect(optimalInputs('I', 0, 0)).toBe(1)
    expect(optimalInputs('I', 0, 6)).toBe(1)
  })

  it('vertical I in the wall columns is rotate + DAS = 2', () => {
    expect(optimalInputs('I', 1, -2)).toBe(2) // column 0
    expect(optimalInputs('I', 1, 7)).toBe(2) // column 9
  })

  it('one-off-wall positions cost 2 (DAS + tap back, or two taps)', () => {
    expect(optimalInputs('T', 0, 1)).toBe(2)
    expect(optimalInputs('T', 0, 6)).toBe(2)
  })

  it('equivalent placements share an optimum: S/Z/I 180 states cost like spawn states', () => {
    // S at spawn rotated 180 lands the identical cells → rotating is a
    // wasted input, the optimum stays 0
    expect(optimalInputs('S', 2, 3)).toBe(0)
    expect(optimalInputs('Z', 2, 3)).toBe(0)
    expect(optimalInputs('I', 2, 3)).toBe(0)
    // vertical I: rot 3 at x is the same column as rot 1 at x-1
    expect(optimalInputs('I', 3, -1)).toBe(2)
  })

  it('rotating the O piece is never required', () => {
    for (let x = 0; x <= 8; x++) {
      expect(optimalInputs('O', 0, x)).toBeLessThanOrEqual(2)
      expect(optimalInputs('O', 1, x)).toBe(optimalInputs('O', 0, x))
    }
  })

  it('no placement of any piece needs more than 3 inputs (with a 180 key)', () => {
    // the classic finesse bound: ≤2 movement inputs + ≤1 rotation input
    for (const type of ['I', 'O', 'T', 'S', 'Z', 'J', 'L'] as PieceType[]) {
      for (const rot of [0, 1, 2, 3] as Rot[]) {
        for (let x = -3; x < BOARD_W; x++) {
          if (!validX(type, rot, x)) continue
          expect(optimalInputs(type, rot, x)).toBeLessThanOrEqual(3)
        }
      }
    }
  })

  it('grades tap distances from the (left-handed) spawn column', () => {
    // T spawns in columns 3–5, so the board mirror is NOT symmetric:
    // x=2 is one tap away while its mirror x=5 needs two
    expect(optimalInputs('T', 0, 2)).toBe(1)
    expect(optimalInputs('T', 0, 4)).toBe(1)
    expect(optimalInputs('T', 0, 5)).toBe(2)
  })

  it('the engine lock event carries the placement finesse needs', () => {
    const e = new Engine({ seed: 11, mode: 'marathon' })
    e.start()
    e.applyAction('left')
    e.applyAction('hardDrop')
    const ev = e.takeEvents().find((x) => x.kind === 'lock')
    expect(ev && ev.kind === 'lock' && ev.piece.type).toBeTruthy()
    if (ev && ev.kind === 'lock') {
      expect(optimalInputs(ev.piece.type, ev.piece.rot, ev.piece.x)).toBeGreaterThanOrEqual(1)
    }
  })
})
