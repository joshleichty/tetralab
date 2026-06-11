/**
 * Finesse sequence table (spec training-core §5).
 *
 * Three layers of validation:
 * 1. Artifact contract — the checked-in JSON matches the generator, so a
 *    kick-table change that shifts finesse fails CI until regenerated.
 * 2. Cross-validation against FinesseTrainer (research §3): its per-drill
 *    "correct move counts" (movement presses only; rotations free; DAS =
 *    one press) transcribed below from finesseTrainer.js, mapped from its
 *    (piece, junkPattern, junkX) space onto our (rot, x) bounding-box
 *    coordinates via its checkDrop().
 * 3. Executability — every sequence in the table, replayed through the
 *    real engine in lesson mode, locks exactly the placement it claims.
 */
import { describe, expect, it } from 'vitest'
import { Engine } from './engine'
import { optimalInputs } from './finesse'
import { buildFinesseTable, movementOptimal, placementId } from './finesse-gen'
import type { FinesseInput } from './finesse-gen'
import { finesseEntry, finesseTable } from './finesse-table'
import { PIECE_TYPES } from './pieces'
import type { PieceType, Rot } from './types'

describe('artifact contract', () => {
  it('the checked-in JSON matches the generator (run npm run gen:finesse)', () => {
    // finesseTable IS the imported artifact; a kick-table or generator
    // change that shifts finesse fails here until regenerated
    expect(finesseTable).toEqual(buildFinesseTable())
  })
})

describe('table sanity', () => {
  it('spawn placements cost zero and the empty sequence', () => {
    expect(finesseEntry('T', 0, 3)).toEqual({ count: 0, sequences: [[]] })
  })

  it('equivalent orientations share an entry (S spawn ≡ S 180)', () => {
    expect(finesseEntry('S', 2, 3)).toEqual(finesseEntry('S', 0, 3))
    expect(finesseEntry('S', 2, 3)!.count).toBe(0)
  })

  it('no placement needs more than 4 inputs without a 180 key', () => {
    for (const type of PIECE_TYPES) {
      for (const entry of Object.values(finesseTable.pieces[type])) {
        expect(entry.count).toBeLessThanOrEqual(4)
        for (const seq of entry.sequences) expect(seq.length).toBe(entry.count)
      }
    }
  })

  it('is never cheaper than the 180-enabled optimum', () => {
    for (const type of PIECE_TYPES) {
      for (const [key, entry] of Object.entries(finesseTable.pieces[type])) {
        const [rot, x] = key.split(':').map(Number)
        expect(entry.count).toBeGreaterThanOrEqual(optimalInputs(type, rot as Rot, x))
      }
    }
  })

  it('never tap 3×: DAS + tap-back beats a triple tap everywhere', () => {
    // T one short of the right wall: 3 taps from spawn, but the table says 2
    expect(finesseEntry('T', 0, 6)!.count).toBe(2)
    expect(finesseEntry('T', 0, 6)!.sequences).toContainEqual(['DR', 'L'])
    for (const type of PIECE_TYPES) {
      for (const entry of Object.values(finesseTable.pieces[type])) {
        for (const seq of entry.sequences) {
          const taps = seq.join(',')
          expect(taps.includes('L,L,L') || taps.includes('R,R,R')).toBe(false)
        }
      }
    }
  })
})

/**
 * FinesseTrainer reference data (github.com/alexjohnson0123/FinesseTrainer,
 * finesseTrainer.js). `targets` lists checkDrop's accepted placements as
 * [rot, dxc]: piece center column = junkX + dxc. Our bounding-box x =
 * center − 1 (center − 0 for O). `counts[junkX]` is the expected movement
 * press count for junkX in [min, max]; targets that fall off the board are
 * skipped (their RNG never asks for them).
 */
const FT: Record<
  PieceType,
  Array<{ targets: Array<[Rot, number]>; range: [number, number]; counts: number[] }>
> = {
  I: [
    { targets: [[0, 1]], range: [0, 6], counts: [1, 2, 1, 0, 1, 2, 1, 0, 0, 0] },
    { targets: [[1, -1], [3, 0]], range: [0, 9], counts: [1, 1, 1, 1, 0, 0, 1, 1, 1, 1] },
  ],
  J: [
    { targets: [[2, -1]], range: [2, 9], counts: [0, 0, 1, 2, 1, 0, 1, 2, 2, 1] },
    { targets: [[3, 1]], range: [0, 8], counts: [1, 2, 1, 0, 1, 2, 2, 1, 1, 0] },
    { targets: [[0, 1]], range: [0, 7], counts: [1, 2, 1, 0, 1, 2, 2, 1, 0, 0] },
    { targets: [[1, 0]], range: [0, 8], counts: [1, 1, 2, 1, 0, 1, 2, 2, 1, 0] },
  ],
  L: [
    { targets: [[2, 1]], range: [0, 7], counts: [1, 2, 1, 0, 1, 2, 2, 1, 0, 0] },
    { targets: [[1, 0]], range: [0, 8], counts: [1, 1, 2, 1, 0, 1, 2, 2, 1, 0] },
    { targets: [[0, 1]], range: [0, 7], counts: [1, 2, 1, 0, 1, 2, 2, 1, 0, 0] },
    { targets: [[3, 0]], range: [1, 9], counts: [0, 1, 2, 1, 0, 1, 2, 2, 1, 1] },
  ],
  O: [{ targets: [[0, 0]], range: [0, 8], counts: [1, 2, 2, 1, 0, 1, 2, 2, 1, 0] }],
  S: [
    { targets: [[0, 1]], range: [0, 7], counts: [1, 2, 1, 0, 1, 2, 2, 1, 0, 0] },
    { targets: [[1, -1], [3, 0]], range: [1, 9], counts: [0, 1, 1, 1, 0, 0, 1, 2, 1, 1] },
  ],
  T: [
    { targets: [[0, 1]], range: [0, 7], counts: [1, 2, 1, 0, 1, 2, 2, 1, 0, 0] },
    { targets: [[1, 0]], range: [0, 8], counts: [1, 1, 2, 1, 0, 1, 2, 2, 1, 0] },
    { targets: [[3, 0]], range: [1, 9], counts: [0, 1, 2, 1, 0, 1, 2, 2, 1, 1] },
    { targets: [[2, 0]], range: [1, 9], counts: [0, 1, 2, 1, 0, 1, 2, 2, 1, 0] },
  ],
  Z: [
    { targets: [[0, 0]], range: [1, 8], counts: [0, 1, 2, 1, 0, 1, 2, 2, 1, 0] },
    { targets: [[1, 0], [3, 1]], range: [0, 8], counts: [1, 1, 1, 0, 0, 1, 2, 1, 1, 0] },
  ],
}

describe('FinesseTrainer cross-validation', () => {
  it('movement-press optimums match the reference table', () => {
    let checked = 0
    for (const type of PIECE_TYPES) {
      for (const drill of FT[type]) {
        for (let junkX = drill.range[0]; junkX <= drill.range[1]; junkX++) {
          const centerOffset = type === 'O' ? 0 : 1
          const candidates = drill.targets
            .map(([rot, dxc]) => [rot, junkX + dxc - centerOffset] as [Rot, number])
            .filter(([rot, x]) => finesseTable.pieces[type][`${rot}:${x}`] !== undefined)
          if (candidates.length === 0) continue // off-board target their RNG never asks for
          const ours = Math.min(...candidates.map(([rot, x]) => movementOptimal(type, rot, x)))
          expect(
            ours,
            `${type} junkX=${junkX} targets=${JSON.stringify(drill.targets)}`,
          ).toBe(drill.counts[junkX])
          checked++
        }
      }
    }
    expect(checked).toBeGreaterThan(150) // pieces × rotations × columns coverage
  })
})

describe('executability', () => {
  it('every sequence locks exactly the placement it claims', () => {
    const done = new Set<string>()
    for (const type of PIECE_TYPES) {
      for (const [key, entry] of Object.entries(finesseTable.pieces[type])) {
        const [rot, x] = key.split(':').map(Number) as [Rot, number]
        const target = placementId(type, rot, x)
        if (done.has(`${type}|${target}`)) continue
        done.add(`${type}|${target}`)
        for (const seq of entry.sequences) {
          const e = new Engine({ seed: 5, mode: 'lesson' })
          e.setQueue([type])
          e.start()
          for (const input of seq) apply(e, input)
          e.applyAction('hardDrop')
          const lock = e.takeEvents().find((ev) => ev.kind === 'lock')!
          expect(
            lock.kind === 'lock' && placementId(type, lock.piece.rot, lock.piece.x),
            `${type} ${key} via ${seq.join(',')}`,
          ).toBe(target)
        }
      }
    }
  })
})

function apply(e: Engine, input: FinesseInput) {
  switch (input) {
    case 'L':
      e.applyAction('left')
      break
    case 'R':
      e.applyAction('right')
      break
    case 'CW':
      e.applyAction('cw')
      break
    case 'CCW':
      e.applyAction('ccw')
      break
    case 'DL':
    case 'DR': {
      // DAS: hold the direction to the wall
      for (let last = -99; e.active && e.active.x !== last; ) {
        last = e.active.x
        e.applyAction(input === 'DL' ? 'left' : 'right')
      }
      break
    }
  }
}
