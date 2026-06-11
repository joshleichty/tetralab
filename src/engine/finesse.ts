import { BOARD_W, CELLS, spawnX } from './pieces.ts'
import { kicksFor } from './srs.ts'
import type { PieceType, Rot } from './types.ts'

/**
 * Finesse: the minimal number of keypresses to reach a placement from
 * spawn, Hard Drop wiki definition (docs/parity.md §8, [HD-Finesse]):
 * taps, DAS-to-wall (one press), and rotations (CW/CCW/180 each one
 * press) all cost 1; soft/hard drop and hold are not counted.
 *
 * Computed by BFS over (rotation, x) on an empty board using the real
 * kick tables, so kick displacement near walls is exact. Placements that
 * land identical cell sets (e.g. S spawn vs S 180) share one optimum —
 * rotating an O is correctly a wasted input.
 */

const X_MIN = -3 // I rot1 reaches x = -2; pad one beyond every legal state

type DistMap = Map<string, number>
const tables = new Map<PieceType, DistMap>()

function cellsValid(type: PieceType, rot: Rot, x: number): boolean {
  for (const [dx] of CELLS[type][rot]) {
    const cx = x + dx
    if (cx < 0 || cx >= BOARD_W) return false
  }
  return true
}

/** placement identity: absolute columns + vertical shape, drop-invariant */
function placementKey(type: PieceType, rot: Rot, x: number): string {
  const cells = CELLS[type][rot]
  const minDy = Math.min(...cells.map(([, dy]) => dy))
  return cells
    .map(([dx, dy]) => `${x + dx},${dy - minDy}`)
    .sort()
    .join(';')
}

function buildTable(type: PieceType): DistMap {
  // BFS over states (rot, x); every input costs 1
  const dist = new Map<string, number>()
  const stateKey = (rot: Rot, x: number) => `${rot}:${x}`
  const start: [Rot, number] = [0, spawnX(type)]
  dist.set(stateKey(...start), 0)
  const queue: Array<[Rot, number]> = [start]

  const wallX = (rot: Rot, dir: -1 | 1): number => {
    let x = dir === -1 ? X_MIN : BOARD_W
    if (dir === -1) {
      while (!cellsValid(type, rot, x)) x++
    } else {
      while (!cellsValid(type, rot, x)) x--
    }
    return x
  }

  while (queue.length > 0) {
    const [rot, x] = queue.shift()!
    const d = dist.get(stateKey(rot, x))!
    const push = (nr: Rot, nx: number) => {
      const k = stateKey(nr, nx)
      if (!dist.has(k)) {
        dist.set(k, d + 1)
        queue.push([nr, nx])
      }
    }
    // taps
    if (cellsValid(type, rot, x - 1)) push(rot, x - 1)
    if (cellsValid(type, rot, x + 1)) push(rot, x + 1)
    // DAS to either wall (one input)
    push(rot, wallX(rot, -1))
    push(rot, wallX(rot, 1))
    // rotations through the real kick tables (empty board: only walls block)
    for (const turns of [1, 2, 3] as const) {
      const to = ((rot + turns) % 4) as Rot
      for (const [kx] of kicksFor(type, rot, to)) {
        if (cellsValid(type, to, x + kx)) {
          push(to, x + kx)
          break
        }
      }
    }
  }

  // collapse states onto placement identities, keeping the cheapest
  const best = new Map<string, number>()
  for (const [key, d] of dist) {
    const [rot, x] = key.split(':').map(Number) as [Rot, number]
    const pk = placementKey(type, rot, x)
    const prev = best.get(pk)
    if (prev === undefined || d < prev) best.set(pk, d)
  }
  return best
}

/**
 * Minimal keypresses (movement + rotation) to place `type` so it locks at
 * horizontal position `x` in orientation `rot`.
 */
export function optimalInputs(type: PieceType, rot: Rot, x: number): number {
  let table = tables.get(type)
  if (!table) {
    table = buildTable(type)
    tables.set(type, table)
  }
  return table.get(placementKey(type, rot, x)) ?? 0
}
