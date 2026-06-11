import raw from './data/finesse-table.json'
import type { FinesseEntry, FinesseTable } from './finesse-gen'

/**
 * Loader for the generated finesse sequence table (no-180 community
 * standard; see finesse-gen.ts for semantics and `npm run gen:finesse`
 * to regenerate). Consumers: Track B guided moves (show the optimal
 * sequence), replay fault analysis, the Progress finesse test.
 *
 * Note the existing `finesse.ts` `optimalInputs` counts a 180 key and can
 * be 1 lower on 180° placements; this table is the teaching standard.
 */

import type { PieceType, Rot } from './types'

export const finesseTable = raw as FinesseTable

/** minimal inputs + every minimal sequence for a placement, or undefined
 *  if (rot, x) is not a legal on-board position for the piece */
export function finesseEntry(type: PieceType, rot: Rot, x: number): FinesseEntry | undefined {
  return finesseTable.pieces[type][`${rot}:${x}`]
}
