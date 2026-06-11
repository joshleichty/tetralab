import { parseRows } from '../engine/board.ts'
import { Engine } from '../engine/engine.ts'
import { placementId } from '../engine/finesse-gen.ts'
import { compileGoal } from '../engine/goals.ts'
import type { GoalEvaluator } from '../engine/goals.ts'
import type { Action, PieceType } from '../engine/types.ts'
import type {
  DemoMove,
  Lesson,
  Placement,
  RecognitionInput,
  Step,
} from './types.ts'

/**
 * The lesson state machine (spec training-core §2): card-by-card,
 * interaction-gated, hint→reveal escalation. Headless — the UI renders
 * `engine`/`boardView()` and routes input through `applyAction`/`tick`/
 * `answer`; the vitest harness drives the same surface.
 *
 * Gating: prose/demo/sandbox advance on Continue; guidedMove/challenge/
 * recognition gate `next()` until solved or revealed. Back is always
 * free, and a step once earned stays earned.
 *
 * Feedback discipline (the instrument calibration): one `feedback` value
 * at a time, replaced not queued — correct is one quiet moment, wrong is
 * a soft bounce. The UI reads `feedback` when `feedback.id` changes.
 */

export type StepPhase = 'pending' | 'seen' | 'solved' | 'revealed'

export interface StepRecord {
  phase: StepPhase
  hintUsed: boolean
  mistakes: number
}

type FeedbackBody =
  | { kind: 'correct' }
  | { kind: 'wrong'; message?: string }
  | { kind: 'goalFailed' }

export type Feedback = FeedbackBody & { id: number }

export class LessonMachine {
  readonly lesson: Lesson
  stepIndex = 0
  status: 'active' | 'complete' = 'active'
  /** live engine for interactive steps; null for prose/recognition */
  engine: Engine | null = null
  /** challenge goal evaluator for the current step */
  goal: GoalEvaluator | null = null
  /** guidedMove: how many solution placements are locked in */
  progress = 0
  /** demo: next script move to play */
  demoIndex = 0
  records: StepRecord[]
  feedback: Feedback | null = null

  private feedbackId = 0
  private revealing = false
  private staticBoard: Uint8Array | null = null

  constructor(lesson: Lesson) {
    if (lesson.steps.length === 0) throw new Error(`lesson ${lesson.id} has no steps`)
    this.lesson = lesson
    this.records = lesson.steps.map(() => ({ phase: 'pending', hintUsed: false, mistakes: 0 }))
    this.enterStep(0)
  }

  current(): Step {
    return this.lesson.steps[this.stepIndex]
  }

  record(): StepRecord {
    return this.records[this.stepIndex]
  }

  /** what the UI draws: the live board, or the step's static one */
  boardView(): Uint8Array {
    if (this.engine) return this.engine.board
    this.staticBoard ??= parseRows(this.current().board)
    return this.staticBoard
  }

  // ── navigation ─────────────────────────────────────────────────

  /** forward is earned: gated steps need solved/revealed */
  canAdvance(): boolean {
    if (this.status === 'complete') return false
    const step = this.current()
    if (step.kind === 'prose' || step.kind === 'demo' || step.kind === 'sandbox') return true
    const phase = this.record().phase
    return phase === 'solved' || phase === 'revealed'
  }

  next(): boolean {
    if (!this.canAdvance()) return false
    const r = this.record()
    if (r.phase === 'pending') r.phase = 'seen'
    if (this.stepIndex === this.lesson.steps.length - 1) {
      this.status = 'complete'
      this.engine = null
      this.goal = null
      return true
    }
    this.enterStep(this.stepIndex + 1)
    return true
  }

  /** back is always free */
  back(): boolean {
    if (this.stepIndex === 0) return false
    this.status = 'active'
    this.enterStep(this.stepIndex - 1)
    return true
  }

  /** rebuild the current step from scratch (after a failed challenge,
   *  or "try again" anywhere); the record's history is kept */
  retry() {
    this.enterStep(this.stepIndex)
  }

  // ── hint → reveal escalation ───────────────────────────────────

  /** returns the hint (marking it used) or null if the step has none */
  showHint(): string | null {
    const step = this.current()
    const hint = 'hint' in step ? (step.hint ?? null) : null
    if (hint) this.record().hintUsed = true
    return hint
  }

  /**
   * Give the answer: auto-plays the remaining solution (guidedMove), a
   * clean full solve (challenge), or just unlocks (recognition). The
   * step advances but is recorded `revealed`, not solved.
   */
  reveal() {
    const step = this.current()
    this.revealing = true
    try {
      if (step.kind === 'guidedMove') {
        for (let i = this.progress; i < step.solution.length; i++) this.place(step.solution[i])
      } else if (step.kind === 'challenge') {
        this.retry() // the user's attempt may have spoiled the board
        for (const p of step.solution) this.place(p)
      } else if (step.kind !== 'recognition') {
        return // nothing to reveal on ungated steps
      }
      this.record().phase = 'revealed'
    } finally {
      this.revealing = false
    }
  }

  // ── driving the board ──────────────────────────────────────────

  /** user input path; no-op on steps without a live engine */
  applyAction(action: Action) {
    if (!this.engine) return
    this.engine.applyAction(action)
    this.observe()
  }

  tick(dtMs: number) {
    if (!this.engine) return
    this.engine.tick(dtMs)
    this.observe()
  }

  /** placement path (reveal, demos, the harness); same rules as play */
  place(p: Placement): boolean {
    if (!this.engine) return false
    const ok = this.engine.place(p)
    this.observe()
    return ok
  }

  /** play the next demo move; false once the script is exhausted */
  runDemoMove(): boolean {
    const step = this.current()
    if (step.kind !== 'demo' || this.demoIndex >= step.script.length) return false
    const move = step.script[this.demoIndex++]
    if (!this.applyDemoMove(move)) {
      throw new Error(
        `lesson ${this.lesson.id} step ${this.stepIndex}: demo move ${this.demoIndex - 1} does not apply`,
      )
    }
    return true
  }

  demoDone(): boolean {
    const step = this.current()
    return step.kind !== 'demo' || this.demoIndex >= step.script.length
  }

  /** answer a recognition step; true = correct (and the gate opens) */
  answer(input: RecognitionInput): boolean {
    const step = this.current()
    if (step.kind !== 'recognition') return false
    const a = step.answer
    const correct =
      a.kind === 'cell' && 'cell' in input
        ? input.cell[0] === a.at[0] && input.cell[1] === a.at[1]
        : a.kind === 'column' && 'column' in input
          ? input.column === a.column
          : a.kind === 'choice' && 'choice' in input
            ? input.choice === a.correct
            : false
    if (correct) {
      if (this.record().phase !== 'revealed') this.record().phase = 'solved'
      this.pushFeedback({ kind: 'correct' })
    } else {
      this.record().mistakes++
      this.pushFeedback({ kind: 'wrong' })
    }
    return correct
  }

  // ── internals ──────────────────────────────────────────────────

  private enterStep(index: number) {
    this.stepIndex = index
    this.progress = 0
    this.demoIndex = 0
    this.goal = null
    this.engine = null
    this.staticBoard = null
    this.feedback = null

    const step = this.lesson.steps[index]
    if (step.kind === 'prose' || step.kind === 'recognition') return

    const engine = new Engine({ seed: this.lesson.seed ?? 1, mode: 'lesson' })
    if (step.board.length > 0) engine.setBoard(step.board)
    const queue = this.queueFor(step)
    if (queue.length > 0) engine.setQueue(queue)
    engine.start()
    engine.takeEvents() // discard spawn-time noise
    this.engine = engine

    if (step.kind === 'challenge') this.goal = compileGoal(step.goal, engine)
  }

  private queueFor(step: Step): PieceType[] {
    switch (step.kind) {
      case 'demo':
        return step.script.map((m: DemoMove) => ('actions' in m ? m.piece : m.type))
      case 'guidedMove':
      case 'challenge':
        return step.queue ?? step.solution.map((p) => p.type)
      default:
        return []
    }
  }

  private applyDemoMove(move: DemoMove): boolean {
    if (!this.engine) return false
    if ('actions' in move) {
      const before = this.engine.piecesPlaced
      for (const a of move.actions) this.engine.applyAction(a)
      this.observe()
      return this.engine.piecesPlaced > before
    }
    return this.place(move)
  }

  /** drain events and apply step semantics (solution tracking, goals) */
  private observe() {
    if (!this.engine) return
    const events = this.engine.takeEvents()
    const step = this.current()
    const r = this.record()

    if (step.kind === 'guidedMove') {
      for (const ev of events) {
        if (ev.kind !== 'lock') continue
        const locked = placementId(ev.piece.type, ev.piece.rot, ev.piece.x)
        const expected = step.solution[this.progress]
        if (expected && locked === placementId(expected.type, expected.rot, expected.x)) {
          this.progress++
          if (this.progress === step.solution.length) {
            if (r.phase !== 'revealed') r.phase = 'solved'
            if (!this.revealing) this.pushFeedback({ kind: 'correct' })
          }
        } else {
          r.mistakes++
          const message = this.mistakeMessage(step, ev.piece)
          this.resetGuidedBoard(step) // before pushFeedback: enterStep clears feedback
          this.pushFeedback({ kind: 'wrong', message })
          return // engine was rebuilt; stale events are gone
        }
      }
    } else if (step.kind === 'challenge' && this.goal) {
      const state = this.goal.observe(events)
      if (state === 'passed') {
        if (r.phase !== 'revealed') r.phase = 'solved'
        if (!this.revealing) this.pushFeedback({ kind: 'correct' })
      } else if (state === 'failed' && r.phase === 'pending') {
        r.mistakes++
        this.pushFeedback({ kind: 'goalFailed' })
      }
    }
  }

  private mistakeMessage(
    step: Extract<Step, { kind: 'guidedMove' }>,
    piece: Placement,
  ): string | undefined {
    const locked = placementId(piece.type, piece.rot, piece.x)
    return step.mistakes?.find(
      (m) => placementId(m.match.type, m.match.rot, m.match.x) === locked,
    )?.message
  }

  /** wrong guided move: soft bounce — rebuild and replay the earned prefix */
  private resetGuidedBoard(step: Extract<Step, { kind: 'guidedMove' }>) {
    const progress = this.progress
    this.enterStep(this.stepIndex)
    for (let i = 0; i < progress; i++) this.engine!.place(step.solution[i])
    this.engine!.takeEvents()
    this.progress = progress
  }

  private pushFeedback(f: FeedbackBody) {
    this.feedback = { ...f, id: ++this.feedbackId }
  }
}
