import { parseRows } from '../engine/board.ts'
import type { PieceType, Position } from '../engine/types.ts'

/**
 * Build a Position (the L0 value) from bottom-aligned row strings —
 * the fixture/authoring surface, same format as engine/board.ts.
 * Live positions come from `Engine.snapshot()` instead.
 */
export function positionFromRows(
  rows: string[],
  piece: PieceType,
  opts: { queue?: PieceType[]; hold?: PieceType | null; holdUsed?: boolean } = {},
): Position {
  return {
    board: parseRows(rows),
    piece,
    queue: opts.queue ?? [],
    hold: opts.hold ?? null,
    holdUsed: opts.holdUsed ?? false,
  }
}
