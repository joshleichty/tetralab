import type { Action, PieceType, Position, Rot } from '../engine/types.ts'

/**
 * Bot-layer types (specs/bot-core.md). The bot's native unit is the
 * placement; exactly one component (path.ts) translates down to the
 * engine's keypress Actions. Everything here is plain data.
 */

export type { Position }

export type Spin = 'none' | 'mini' | 'full'

export interface Placement {
  type: PieceType
  rot: Rot
  /** bounding-box origin at lock, engine coords (y grows downward) */
  x: number
  y: number
  /** absolute board cells at lock */
  cells: Array<[number, number]>
  /** T pieces only; labeled by the engine's exact 3-corner rule (spin.ts) */
  spin: Spin
  usedHold: boolean
  /** reachable without soft drop: move/rotate at spawn altitude, then drop */
  hardDropOnly: boolean
}

/** 'sonicDrop' = softDropOn → tick to the floor → softDropOff */
export type PlanStep = Action | 'sonicDrop'

/** A keypress plan; always ends with 'hardDrop' (the lock). */
export interface InputPlan {
  steps: PlanStep[]
}
