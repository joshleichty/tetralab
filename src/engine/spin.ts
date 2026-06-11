import { BOARD_H, BOARD_W } from './pieces.ts'
import type { Rot } from './types.ts'

export type TSpin = 'none' | 'mini' | 'full'

/**
 * 3-corner T-spin rule, pure (docs/parity.md §4). The engine delegates
 * here and the bot layer's enumerator labels candidates with it — one
 * implementation, two callers, zero drift.
 *
 * The caller guarantees the piece is a T; `piece` is its bounding-box
 * origin and rotation at rest. Mini unless both front corners (relative
 * to the T's point) are filled, or the rotation used the final (1,2)
 * SRS kick. Out-of-bounds counts as occupied.
 */
export function detectTSpin(
  board: Uint8Array,
  piece: { rot: Rot; x: number; y: number },
  lastMoveWasRotation: boolean,
  lastKickIndex: number,
): TSpin {
  if (!lastMoveWasRotation) return 'none'
  const occupied = (x: number, y: number) =>
    x < 0 || x >= BOARD_W || y < 0 || y >= BOARD_H || board[y * BOARD_W + x] !== 0

  const corners = [
    occupied(piece.x, piece.y), // top-left
    occupied(piece.x + 2, piece.y), // top-right
    occupied(piece.x + 2, piece.y + 2), // bottom-right
    occupied(piece.x, piece.y + 2), // bottom-left
  ]
  const filled = corners.filter(Boolean).length
  if (filled < 3) return 'none'

  // front corner pairs by rotation: 0=top, 1=right, 2=bottom, 3=left
  const FRONT: Record<Rot, [number, number]> = {
    0: [0, 1],
    1: [1, 2],
    2: [2, 3],
    3: [3, 0],
  }
  const [a, b] = FRONT[piece.rot]
  if ((corners[a] && corners[b]) || lastKickIndex === 4) return 'full'
  return 'mini'
}
