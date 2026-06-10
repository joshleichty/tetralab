import type { PieceType, Rot } from './types'

/**
 * SRS wall-kick tables, expressed in *screen* coordinates (y grows downward),
 * i.e. the standard guideline tables with dy negated.
 */

type Kick = readonly [number, number]
type KickTable = Record<string, readonly Kick[]>

const JLSTZ_KICKS: KickTable = {
  '0>1': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
  '1>0': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
  '1>2': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
  '2>1': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
  '2>3': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
  '3>2': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
  '3>0': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
  '0>3': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
}

const I_KICKS: KickTable = {
  '0>1': [[0, 0], [-2, 0], [1, 0], [-2, 1], [1, -2]],
  '1>0': [[0, 0], [2, 0], [-1, 0], [2, -1], [-1, 2]],
  '1>2': [[0, 0], [-1, 0], [2, 0], [-1, -2], [2, 1]],
  '2>1': [[0, 0], [1, 0], [-2, 0], [1, 2], [-2, -1]],
  '2>3': [[0, 0], [2, 0], [-1, 0], [2, -1], [-1, 2]],
  '3>2': [[0, 0], [-2, 0], [1, 0], [-2, 1], [1, -2]],
  '3>0': [[0, 0], [1, 0], [-2, 0], [1, 2], [-2, -1]],
  '0>3': [[0, 0], [-1, 0], [2, 0], [-1, -2], [2, 1]],
}

/** 180° kicks (TETR.IO-style), screen coordinates */
const KICKS_180: KickTable = {
  '0>2': [[0, 0], [0, -1], [1, -1], [-1, -1], [1, 0], [-1, 0]],
  '2>0': [[0, 0], [0, 1], [-1, 1], [1, 1], [-1, 0], [1, 0]],
  '1>3': [[0, 0], [1, 0], [1, -2], [1, -1], [0, -2], [0, -1]],
  '3>1': [[0, 0], [-1, 0], [-1, -2], [-1, -1], [0, -2], [0, -1]],
}

const NO_KICK: readonly Kick[] = [[0, 0]]

export function kicksFor(type: PieceType, from: Rot, to: Rot): readonly Kick[] {
  if (type === 'O') return NO_KICK
  const key = `${from}>${to}`
  const is180 = (from + 2) % 4 === to
  if (is180) {
    if (type === 'I') return NO_KICK
    return KICKS_180[key] ?? NO_KICK
  }
  const table = type === 'I' ? I_KICKS : JLSTZ_KICKS
  return table[key] ?? NO_KICK
}
