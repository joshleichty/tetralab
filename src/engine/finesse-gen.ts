import { BOARD_W, CELLS, PIECE_TYPES, spawnX } from './pieces.ts'
import { kicksFor } from './srs.ts'
import type { PieceType, Rot } from './types.ts'

/**
 * Finesse sequence table generator (spec training-core §5): for every
 * reachable (rotation, column) placement on an empty board, the minimal
 * input sequence(s) from spawn. BFS over (rot, x) with the real SRS+ kick
 * tables, 0G assumed.
 *
 * Input alphabet (community standard, no 180 — flag a 180 variant later):
 *   L/R  tap left/right          DL/DR  DAS to the wall (one input)
 *   CW/CCW  rotate               (the final drop is implicit, not counted)
 *
 * This module is import-extension-clean so `node` can run the artifact
 * generator script directly (scripts/generate-finesse-table.ts). The
 * artifact, not this generator, is what runtime consumers load — see
 * finesse-table.ts. The existing `finesse.ts` optimum (`optimalInputs`)
 * differs: it counts a 180 key. Cross-checks live in finesse-table.test.ts.
 */

export type FinesseInput = 'L' | 'R' | 'DL' | 'DR' | 'CW' | 'CCW'

export interface FinesseEntry {
  /** minimal number of inputs (movement + rotation, drop excluded) */
  count: number
  /** every minimal input sequence, lexicographically sorted */
  sequences: FinesseInput[][]
}

export interface FinesseTable {
  version: number
  /** entries keyed `${rot}:${x}` (bounding-box x); placements that lock
   *  identical cells (e.g. S spawn vs S 180) share one entry */
  pieces: Record<PieceType, Record<string, FinesseEntry>>
}

export const FINESSE_TABLE_VERSION = 1

const X_MIN = -3 // I rot1 reaches x = -2; pad one beyond every legal state

function cellsValid(type: PieceType, rot: Rot, x: number): boolean {
  for (const [dx] of CELLS[type][rot]) {
    const cx = x + dx
    if (cx < 0 || cx >= BOARD_W) return false
  }
  return true
}

/** placement identity: absolute columns + vertical shape, drop-invariant */
export function placementId(type: PieceType, rot: Rot, x: number): string {
  const cells = CELLS[type][rot]
  const minDy = Math.min(...cells.map(([, dy]) => dy))
  return cells
    .map(([dx, dy]) => `${x + dx},${dy - minDy}`)
    .sort()
    .join(';')
}

type State = { rot: Rot; x: number }
type Edge = { to: State; input: FinesseInput }

function wallX(type: PieceType, rot: Rot, dir: -1 | 1): number {
  let x = dir === -1 ? X_MIN : BOARD_W
  while (!cellsValid(type, rot, x)) x -= dir
  return x
}

/** outgoing edges from a state; kicks apply (empty board: walls only block) */
function edges(type: PieceType, s: State): Edge[] {
  const out: Edge[] = []
  if (cellsValid(type, s.rot, s.x - 1)) out.push({ to: { rot: s.rot, x: s.x - 1 }, input: 'L' })
  if (cellsValid(type, s.rot, s.x + 1)) out.push({ to: { rot: s.rot, x: s.x + 1 }, input: 'R' })
  const wl = wallX(type, s.rot, -1)
  if (wl !== s.x) out.push({ to: { rot: s.rot, x: wl }, input: 'DL' })
  const wr = wallX(type, s.rot, 1)
  if (wr !== s.x) out.push({ to: { rot: s.rot, x: wr }, input: 'DR' })
  for (const [turns, input] of [
    [1, 'CW'],
    [3, 'CCW'],
  ] as Array<[1 | 3, FinesseInput]>) {
    const to = ((s.rot + turns) % 4) as Rot
    for (const [kx] of kicksFor(type, s.rot, to)) {
      if (cellsValid(type, to, s.x + kx)) {
        out.push({ to: { rot: to, x: s.x + kx }, input })
        break
      }
    }
  }
  return out
}

const key = (s: State) => `${s.rot}:${s.x}`

const INPUT_ORDER: FinesseInput[] = ['L', 'R', 'DL', 'DR', 'CW', 'CCW']

function compareSequences(a: FinesseInput[], b: FinesseInput[]): number {
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    const d = INPUT_ORDER.indexOf(a[i]) - INPUT_ORDER.indexOf(b[i])
    if (d !== 0) return d
  }
  return a.length - b.length
}

function buildPiece(type: PieceType): Record<string, FinesseEntry> {
  // BFS recording every shortest-path predecessor
  const start: State = { rot: 0, x: spawnX(type) }
  const dist = new Map<string, number>([[key(start), 0]])
  const states = new Map<string, State>([[key(start), start]])
  const preds = new Map<string, Array<{ prev: string; input: FinesseInput }>>()
  const queue: State[] = [start]

  while (queue.length > 0) {
    const s = queue.shift()!
    const d = dist.get(key(s))!
    for (const { to, input } of edges(type, s)) {
      const k = key(to)
      const known = dist.get(k)
      if (known === undefined) {
        dist.set(k, d + 1)
        states.set(k, to)
        preds.set(k, [{ prev: key(s), input }])
        queue.push(to)
      } else if (known === d + 1) {
        preds.get(k)!.push({ prev: key(s), input })
      }
    }
  }

  // enumerate all minimal sequences per state (memoized over the BFS DAG)
  const seqCache = new Map<string, FinesseInput[][]>()
  const sequencesTo = (k: string): FinesseInput[][] => {
    if (k === key(start)) return [[]]
    const cached = seqCache.get(k)
    if (cached) return cached
    const out: FinesseInput[][] = []
    for (const { prev, input } of preds.get(k)!) {
      for (const head of sequencesTo(prev)) out.push([...head, input])
    }
    seqCache.set(k, out)
    return out
  }

  // collapse states onto placement identities, keeping the cheapest
  const byPlacement = new Map<string, { count: number; stateKeys: string[] }>()
  for (const [k, s] of states) {
    const pid = placementId(type, s.rot, s.x)
    const d = dist.get(k)!
    const cur = byPlacement.get(pid)
    if (!cur || d < cur.count) byPlacement.set(pid, { count: d, stateKeys: [k] })
    else if (d === cur.count) cur.stateKeys.push(k)
  }

  const entries = new Map<string, FinesseEntry>()
  for (const [pid, { count, stateKeys }] of byPlacement) {
    const seen = new Set<string>()
    const sequences: FinesseInput[][] = []
    for (const k of stateKeys) {
      for (const seq of sequencesTo(k)) {
        const sig = seq.join(',')
        if (!seen.has(sig)) {
          seen.add(sig)
          sequences.push(seq)
        }
      }
    }
    sequences.sort(compareSequences)
    entries.set(pid, { count, sequences })
  }

  // key the table by every valid (rot, x); equivalent orientations share entries
  const table: Record<string, FinesseEntry> = {}
  for (const rot of [0, 1, 2, 3] as Rot[]) {
    for (let x = X_MIN; x < BOARD_W; x++) {
      if (!cellsValid(type, rot, x)) continue
      const entry = entries.get(placementId(type, rot, x))
      if (entry) table[`${rot}:${x}`] = entry
    }
  }
  return table
}

export function buildFinesseTable(): FinesseTable {
  const pieces = {} as FinesseTable['pieces']
  for (const type of PIECE_TYPES) pieces[type] = buildPiece(type)
  return { version: FINESSE_TABLE_VERSION, pieces }
}

/**
 * Movement-press optimum with rotations free — FinesseTrainer's metric
 * (its moveCount only increments on directional presses), used to
 * cross-validate the BFS state graph against the reference table.
 */
export function movementOptimal(type: PieceType, rot: Rot, x: number): number {
  let table = movementTables.get(type)
  if (!table) {
    table = buildMovementTable(type)
    movementTables.set(type, table)
  }
  const v = table.get(placementId(type, rot, x))
  if (v === undefined) throw new Error(`unreachable placement ${type} ${rot}:${x}`)
  return v
}

const movementTables = new Map<PieceType, Map<string, number>>()

function buildMovementTable(type: PieceType): Map<string, number> {
  // 0-1 BFS: rotations cost 0, movement inputs cost 1
  const start: State = { rot: 0, x: spawnX(type) }
  const dist = new Map<string, number>([[key(start), 0]])
  const states = new Map<string, State>([[key(start), start]])
  const deque: State[] = [start]

  while (deque.length > 0) {
    const s = deque.shift()!
    const d = dist.get(key(s))!
    for (const { to, input } of edges(type, s)) {
      const cost = input === 'CW' || input === 'CCW' ? 0 : 1
      const k = key(to)
      const known = dist.get(k)
      if (known === undefined || known > d + cost) {
        dist.set(k, d + cost)
        states.set(k, to)
        if (cost === 0) deque.unshift(to)
        else deque.push(to)
      }
    }
  }

  const best = new Map<string, number>()
  for (const [k, s] of states) {
    const pid = placementId(type, s.rot, s.x)
    const d = dist.get(k)!
    const prev = best.get(pid)
    if (prev === undefined || d < prev) best.set(pid, d)
  }
  return best
}
