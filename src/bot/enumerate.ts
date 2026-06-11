import { CELLS, SPAWN_Y, fits, spawnX } from '../engine/pieces.ts'
import { detectTSpin } from '../engine/spin.ts'
import { kicksFor } from '../engine/srs.ts'
import type { PieceType, Rot } from '../engine/types.ts'
import type { InputPlan, Placement, PlanStep, Position, Spin } from './types.ts'

/**
 * L1: the placement enumerator (specs/bot-core.md). BFS over piece states
 * (rot, x, y) using the engine's exact spawn rules, kick tables, and spin
 * detection — every transition mirrors what `applyAction` would do, so
 * every claimed placement is executable by its own plan (proven by the
 * round-trip tests against a real Engine).
 *
 * Assumes inputs are fast relative to gravity (the executor steps at
 * STEP_MS; level-1 gravity is ~1000ms/row and descent is explicit via
 * 'sonicDrop'). High-gravity live driving is an L6 concern.
 */

export interface Candidate {
  placement: Placement
  plan: InputPlan
}

export function cellsKeyOf(cells: Array<[number, number]>): string {
  return cells
    .map(([x, y]) => `${x},${y}`)
    .sort()
    .join(';')
}

/** dedup identity: same cells + same spin label = same candidate */
export function candidateKey(cells: Array<[number, number]>, spin: Spin): string {
  return `${cellsKeyOf(cells)}|${spin}`
}

/** the engine's spawn, replicated: D2 two-row lift + guideline initial drop */
function spawnStateFor(board: Uint8Array, type: PieceType): { x: number; y: number } | null {
  const x = spawnX(type)
  for (let lift = 0; lift <= 2; lift++) {
    const y = SPAWN_Y - lift
    if (fits(board, type, 0, x, y)) {
      return fits(board, type, 0, x, y + 1) ? { x, y: y + 1 } : { x, y }
    }
  }
  return null
}

const ROTATIONS: ReadonlyArray<{ action: PlanStep; turns: 1 | 2 | 3 }> = [
  { action: 'cw', turns: 1 },
  { action: 'r180', turns: 2 },
  { action: 'ccw', turns: 3 },
]

/**
 * Enumerate every reachable placement of `type` on `board`, with the
 * fewest-input plan for each (BFS order). `prefix` is prepended to every
 * plan (the 'hold' step for hold-piece searches).
 */
export function searchPiece(
  board: Uint8Array,
  type: PieceType,
  usedHold: boolean,
  prefix: PlanStep[],
): Candidate[] {
  const start = spawnStateFor(board, type)
  if (!start) return []

  // state key: x in [-4, 27] is far wider than any kick can reach
  const keyOf = (rot: Rot, x: number, y: number) => rot + ((x + 4) << 2) + (y << 8)

  interface Node {
    rot: Rot
    x: number
    y: number
    parent: number
    action: PlanStep
  }
  const nodes = new Map<number, Node>()
  const found = new Map<string, Candidate>()

  const pathTo = (k: number): PlanStep[] => {
    const steps: PlanStep[] = []
    for (let n = nodes.get(k)!; n.parent !== -1; n = nodes.get(n.parent)!) steps.push(n.action)
    return steps.reverse()
  }

  const ghostYOf = (rot: Rot, x: number, y: number): number => {
    while (fits(board, type, rot, x, y + 1)) y++
    return y
  }

  /** record the lock outcome of `steps` + hardDrop from state (rot, x, y) */
  const emit = (
    rot: Rot,
    x: number,
    y: number,
    steps: PlanStep[],
    viaRotation: boolean,
    kickIndex: number,
  ) => {
    const gy = ghostYOf(rot, x, y)
    // a hard drop that moves clears rotation state, exactly like the engine
    const spin: Spin =
      type === 'T' && gy === y && viaRotation
        ? detectTSpin(board, { rot, x, y }, true, kickIndex)
        : 'none'
    const cells = CELLS[type][rot].map(([dx, dy]) => [x + dx, gy + dy] as [number, number])
    const dk = candidateKey(cells, spin)
    if (found.has(dk)) return
    found.set(dk, {
      placement: {
        type,
        rot,
        x,
        y: gy,
        cells,
        spin,
        usedHold,
        hardDropOnly: !steps.includes('sonicDrop'),
      },
      plan: { steps: [...prefix, ...steps, 'hardDrop'] },
    })
  }

  const startKey = keyOf(0, start.x, start.y)
  nodes.set(startKey, { rot: 0, x: start.x, y: start.y, parent: -1, action: 'hardDrop' })
  const queue: number[] = [startKey]
  emit(0, start.x, start.y, [], false, 0)

  while (queue.length > 0) {
    const k = queue.shift()!
    const n = nodes.get(k)!

    const visit = (
      rot: Rot,
      x: number,
      y: number,
      action: PlanStep,
      viaRotation: boolean,
      kickIndex: number,
    ) => {
      const tk = keyOf(rot, x, y)
      if (!nodes.has(tk)) {
        nodes.set(tk, { rot, x, y, parent: k, action })
        queue.push(tk)
        emit(rot, x, y, pathTo(tk), viaRotation, kickIndex)
      } else if (viaRotation && type === 'T' && !fits(board, type, rot, x, y + 1)) {
        // revisiting a grounded state by rotation can carry a different
        // spin label (slide-in 'none' vs rotate-in 'full' are distinct
        // candidates with identical cells)
        emit(rot, x, y, [...pathTo(k), action], true, kickIndex)
      }
    }

    // taps
    if (fits(board, type, n.rot, n.x - 1, n.y)) visit(n.rot, n.x - 1, n.y, 'left', false, 0)
    if (fits(board, type, n.rot, n.x + 1, n.y)) visit(n.rot, n.x + 1, n.y, 'right', false, 0)
    // rotations: the engine's exact kick loop (first fitting kick wins)
    for (const { action, turns } of ROTATIONS) {
      const to = ((n.rot + turns) % 4) as Rot
      const kicks = kicksFor(type, n.rot, to)
      for (let i = 0; i < kicks.length; i++) {
        const [kx, ky] = kicks[i]
        if (fits(board, type, to, n.x + kx, n.y + ky)) {
          visit(to, n.x + kx, n.y + ky, action, true, i)
          break
        }
      }
    }
    // sonic drop (explicit descent; enables tucks and spins under overhangs)
    const gy = ghostYOf(n.rot, n.x, n.y)
    if (gy !== n.y) visit(n.rot, n.x, gy, 'sonicDrop', false, 0)
  }

  return [...found.values()]
}

function comparePlacements(a: Placement, b: Placement): number {
  return (
    Number(a.usedHold) - Number(b.usedHold) ||
    a.rot - b.rot ||
    a.x - b.x ||
    a.y - b.y ||
    a.spin.localeCompare(b.spin)
  )
}

/**
 * Like `enumerate`, but keeps each placement's plan — for consumers (the
 * CLI, future eval/policy layers) that act on candidates without
 * re-searching.
 */
export function enumerateCandidates(pos: Position): Candidate[] {
  const candidates = searchPiece(pos.board, pos.piece, false, [])
  if (!pos.holdUsed) {
    const holdPiece = pos.hold ?? pos.queue[0]
    if (holdPiece && holdPiece !== pos.piece) {
      candidates.push(...searchPiece(pos.board, holdPiece, true, ['hold']))
    }
  }
  candidates.sort((a, b) => comparePlacements(a.placement, b.placement))
  return candidates
}

/**
 * All reachable placements for the position's piece, plus (if hold is
 * available and yields a different piece) the hold piece's placements
 * flagged `usedHold`. Canonical order: (usedHold, rot, x, y, spin).
 */
export function enumerate(pos: Position): Placement[] {
  return enumerateCandidates(pos).map((c) => c.placement)
}
