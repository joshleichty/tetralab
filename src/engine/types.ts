/**
 * Core engine types. The engine is pure TypeScript with zero DOM
 * dependencies so it can be driven headlessly (RL training, replays, tests).
 */

export type PieceType = 'I' | 'O' | 'T' | 'S' | 'Z' | 'J' | 'L'

/** 0 = spawn, 1 = CW, 2 = 180, 3 = CCW */
export type Rot = 0 | 1 | 2 | 3

export interface ActivePiece {
  type: PieceType
  rot: Rot
  /** top-left of the piece's bounding box, in board coords (y grows downward) */
  x: number
  y: number
}

/** Board cell values. 0 = empty, 1–7 = piece colors, 8 = garbage. */
export const CELL_EMPTY = 0
export const CELL_GARBAGE = 8

export type Mode = 'marathon' | 'sprint' | 'blitz' | 'cheese' | 'survival'

export type GameStatus = 'ready' | 'playing' | 'over' | 'won'

export interface ClearInfo {
  lines: number
  /** e.g. "T-SPIN DOUBLE", "QUAD", null for plain 1–3 line clears */
  label: string | null
  b2b: boolean
  combo: number
  perfectClear: boolean
  /** board row indices that were cleared (before collapse) */
  rows: number[]
  points: number
}

export type GameEvent =
  | { kind: 'move' }
  | { kind: 'rotate'; spin: boolean }
  | { kind: 'softdrop' }
  | { kind: 'harddrop'; distance: number; cells: Array<[number, number]> }
  | { kind: 'lock'; cells: Array<[number, number]> }
  | { kind: 'clear'; info: ClearInfo }
  | { kind: 'hold' }
  | { kind: 'levelup'; level: number }
  | { kind: 'garbage'; rows: number }
  | { kind: 'gameover' }
  | { kind: 'win' }

export interface EngineConfig {
  seed: number
  mode: Mode
  /** ms a grounded piece waits before locking */
  lockDelay: number
  /** how many move/rotate lock-delay resets are allowed per altitude */
  maxLockResets: number
  /** visible preview length */
  queueSize: number
  /** soft drop gravity multiplier; >= INSTANT_SDF means teleport to floor */
  sdf: number
  startLevel: number
  /** cheese mode: total cheese lines in the race */
  cheeseTotal: number
  /** cheese mode: max cheese rows on the board at once */
  cheeseHeight: number
  /** survival mode: ms between garbage rises at the start */
  riseStartMs: number
  /** survival mode: each rise shortens the interval by this much */
  riseDecayMs: number
  /** survival mode: fastest rise interval */
  riseMinMs: number
}

export const INSTANT_SDF = 41

export const DEFAULT_ENGINE_CONFIG: Omit<EngineConfig, 'seed' | 'mode'> = {
  lockDelay: 500,
  maxLockResets: 15,
  queueSize: 5,
  sdf: 20,
  startLevel: 1,
  cheeseTotal: 18,
  cheeseHeight: 9,
  riseStartMs: 6000,
  riseDecayMs: 120,
  riseMinMs: 1800,
}

/** Discrete actions — the exact surface an RL agent will use. */
export type Action =
  | 'left'
  | 'right'
  | 'cw'
  | 'ccw'
  | 'r180'
  | 'softDropOn'
  | 'softDropOff'
  | 'hardDrop'
  | 'hold'
