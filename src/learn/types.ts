import type { GoalSpec } from '../engine/goals.ts'
import type { Action, PieceType, Rot } from '../engine/types.ts'

/**
 * The lesson vocabulary (spec training-core §2): six step primitives, a
 * tiny annotation language, typed TS data all the way down. Adding a
 * lesson never means new UI — if a lesson can't be expressed here, the
 * vocabulary grows deliberately, not the lesson's markup.
 *
 * Conventions:
 * - Boards are bottom-aligned row strings (engine board.ts `parseRows`):
 *   `'XXXXXXXXX_'`, `_`/`.` empty, piece letters, `X`/`G` garbage.
 * - Annotation/answer coordinates are (column, rowsFromBottom):
 *   x 0–9 left→right, y 0 = the bottom row — heights, like stacks grow.
 * - Placements use engine bounding-box coords (`{ type, rot, x }`), and
 *   two placements match when they lock the same cells (S spawn ≡ S 180).
 */

/** bottom-aligned row strings, the lesson-authoring board format */
export type BoardSpec = string[]

export interface Placement {
  type: PieceType
  rot: Rot
  x: number
}

/** a demo move: a straight-drop placement, or — for placements `place()`
 *  can't express (kicks, tucks, spins) — a raw action script ending with
 *  the drop that locks the piece */
export type DemoMove = Placement | { piece: PieceType; actions: Action[] }

export type Annotation =
  | { kind: 'cells'; cells: Array<[x: number, y: number]>; tone?: 'good' | 'bad' | 'focus' }
  /** outline where a piece would lock — the teaching ghost */
  | { kind: 'ghost'; placement: Placement; tone?: 'good' | 'bad' | 'focus' }
  | { kind: 'column'; column: number; tone?: 'good' | 'bad' | 'focus' }
  | { kind: 'arrow'; from: [x: number, y: number]; to: [x: number, y: number] }

/** what a recognition step accepts as the correct answer */
export type RecognitionAnswer =
  | { kind: 'cell'; at: [x: number, y: number] }
  | { kind: 'column'; column: number }
  /** multiple choice; the UI shuffles, `correct` indexes this array */
  | { kind: 'choice'; choices: string[]; correct: number }

/** what the player submits to a recognition step */
export type RecognitionInput =
  | { cell: [x: number, y: number] }
  | { column: number }
  | { choice: number }

export type Step =
  /** a board and one idea; advances on Continue */
  | { kind: 'prose'; board: BoardSpec; caption: string; shapes?: Annotation[] }
  /** scripted placements auto-play on the board; advances on Continue */
  | { kind: 'demo'; board: BoardSpec; script: DemoMove[]; caption: string; shapes?: Annotation[] }
  /** the board accepts only the scripted placement(s); wrong locks bounce
   *  (optionally with a per-mistake message) and the board resets to the
   *  last correct position */
  | {
      kind: 'guidedMove'
      board: BoardSpec
      solution: Placement[]
      caption: string
      hint?: string
      mistakes?: Array<{ match: Placement; message: string }>
      /** defaults to the solution pieces in order */
      queue?: PieceType[]
      shapes?: Annotation[]
    }
  /** free play, the engine judges via GoalSpec; `solution` must pass the
   *  goal (the harness enforces it) and powers reveal */
  | {
      kind: 'challenge'
      board: BoardSpec
      goal: GoalSpec
      caption: string
      solution: Placement[]
      hint?: string
      /** defaults to the solution pieces in order */
      queue?: PieceType[]
      shapes?: Annotation[]
    }
  /** the chunk-recognition quiz: tap a cell/column or pick a choice */
  | {
      kind: 'recognition'
      board: BoardSpec
      prompt: string
      answer: RecognitionAnswer
      hint?: string
      shapes?: Annotation[]
    }
  /** free experimentation, no goal; advances on Continue */
  | { kind: 'sandbox'; board: BoardSpec; caption?: string; overlay?: 'roughness' | 'wellDepth' }

export type StepKind = Step['kind']

export interface Lesson {
  /** stable id, also the progress-persistence key (`<track>/<lesson>`) */
  id: string
  track: string
  title: string
  /** one-line promise shown in the track list */
  summary?: string
  /** drives the bag for steps without a scripted queue (default 1) */
  seed?: number
  steps: Step[]
}
