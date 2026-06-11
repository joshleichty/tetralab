import { candidateKey, searchPiece } from './enumerate.ts'
import type { InputPlan, Placement, Position } from './types.ts'

/**
 * L2: placement → keypress plan. Readback from the same BFS that
 * enumerated the placement; null if the target isn't reachable from
 * this position.
 */
export function planFor(pos: Position, target: Placement): InputPlan | null {
  let candidates
  if (target.usedHold) {
    if (pos.holdUsed) return null
    const holdPiece = pos.hold ?? pos.queue[0]
    if (!holdPiece || holdPiece !== target.type) return null
    candidates = searchPiece(pos.board, holdPiece, true, ['hold'])
  } else {
    if (target.type !== pos.piece) return null
    candidates = searchPiece(pos.board, pos.piece, false, [])
  }
  const want = candidateKey(target.cells, target.spin)
  for (const c of candidates) {
    if (candidateKey(c.placement.cells, c.placement.spin) === want) return c.plan
  }
  return null
}
