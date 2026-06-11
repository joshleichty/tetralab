import { STEP_MS } from '../engine/replay'
import type { GameEvent } from '../engine/types'
import { InputHandler } from '../input/keyboard'
import { LessonMachine } from '../learn/machine'
import type { Lesson, RecognitionInput } from '../learn/types'
import { LessonRenderer } from '../render/lessonRenderer'
import { sfx } from '../audio/sfx'
import { saveLessonResult } from './learnProgress'
import { loadSettings } from './settings'

/** demo pacing: one scripted move per beat — readable, never sluggish */
const DEMO_BEAT_MS = 750
const DEMO_LEAD_MS = 450

/**
 * DOM shell around a LessonMachine: owns the input handler, the fixed-
 * step loop, the renderer, sounds, and persistence — the same division
 * of labor as GameController, so the lesson board *feels* like the game
 * (same handling settings, same piece sounds, same step grid). React
 * subscribes via useSyncExternalStore and reads fields directly.
 */
export class LessonController {
  readonly machine: LessonMachine
  readonly lesson: Lesson
  /** hint text once consulted (sticky for the step) */
  hintText: string | null = null
  version = 0
  private readonly onExit: () => void

  private input: InputHandler
  private renderer: LessonRenderer | null = null
  private listeners = new Set<() => void>()
  private raf = 0
  private lastT = 0
  private stepAcc = 0
  private demoTimer = DEMO_LEAD_MS
  private lastFeedbackId = 0
  private lastStepIndex = 0
  private completed = false
  private destroyed = false
  private readonly ghost: boolean

  constructor(lesson: Lesson, onExit: () => void = () => {}) {
    this.lesson = lesson
    this.onExit = onExit
    this.machine = new LessonMachine(lesson)
    this.machine.onEvents = (events) => this.soundEvents(events)

    const settings = loadSettings()
    this.ghost = settings.ghost
    sfx.enabled = settings.sound
    sfx.setVolume(settings.volume / 100)
    this.input = new InputHandler(
      { das: settings.das, arr: settings.arr, dcd: settings.dcd },
      settings.bindings,
    )
    this.input.dispatch = (a) => {
      if (this.interactive()) this.machine.applyAction(a)
    }
    this.input.onPause = () => this.onExit()
    this.input.onRestart = () => this.retry()
    this.input.attach(window)
    window.addEventListener('blur', this.onBlur)

    this.lastT = performance.now()
    this.raf = requestAnimationFrame(this.frame)
    // in-page scripting/debugging handle, the window.__tetra convention
    ;(window as unknown as { __tetraLesson: LessonController }).__tetraLesson = this
  }

  destroy() {
    this.destroyed = true
    cancelAnimationFrame(this.raf)
    this.input.detach(window)
    window.removeEventListener('blur', this.onBlur)
  }

  private onBlur = () => this.input.reset()

  // ── React bridge (GameController pattern) ──────────────────────

  subscribe = (fn: () => void) => {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  getVersion = () => this.version

  private emit() {
    this.version++
    for (const fn of this.listeners) fn()
  }

  attachBoard(canvas: HTMLCanvasElement | null) {
    this.renderer = canvas ? new LessonRenderer(canvas) : null
  }

  // ── the loop ───────────────────────────────────────────────────

  private frame = (t: number) => {
    if (this.destroyed) return
    const dt = Math.min(t - this.lastT, 100)
    this.lastT = t

    this.stepAcc += dt
    while (this.stepAcc >= STEP_MS) {
      this.stepAcc -= STEP_MS
      this.input.update(STEP_MS)
      this.machine.tick(STEP_MS)
    }

    // demos play themselves, one move per beat
    const step = this.machine.status === 'active' ? this.machine.current() : null
    if (step?.kind === 'demo' && !this.machine.demoDone()) {
      this.demoTimer -= dt
      if (this.demoTimer <= 0) {
        this.machine.runDemoMove()
        this.demoTimer = DEMO_BEAT_MS
      }
    }

    this.watchTransitions()
    this.renderer?.draw(this.machine, t, this.ghost)
    this.emit()
    this.raf = requestAnimationFrame(this.frame)
  }

  /** feedback sounds + step-entry housekeeping, driven off machine state */
  private watchTransitions() {
    const f = this.machine.feedback
    if (f && f.id !== this.lastFeedbackId) {
      this.lastFeedbackId = f.id
      sfx.ensure()
      sfx.play(f.kind === 'correct' ? 'clear' : 'lock')
    }
    if (this.machine.stepIndex !== this.lastStepIndex) {
      this.lastStepIndex = this.machine.stepIndex
      this.hintText = null
      this.demoTimer = DEMO_LEAD_MS
    }
    if (this.machine.status === 'complete' && !this.completed) {
      this.completed = true
      sfx.play('win')
      saveLessonResult(this.lesson.id, {
        completedAt: Date.now(),
        mistakes: this.machine.records.reduce((n, r) => n + r.mistakes, 0),
        revealed: this.machine.records.filter((r) => r.phase === 'revealed').length,
        hints: this.machine.records.filter((r) => r.hintUsed).length,
      })
    }
  }

  /** keyboard drives the board only on steps that take play input */
  private interactive(): boolean {
    if (this.machine.status !== 'active') return false
    const kind = this.machine.current().kind
    return kind === 'guidedMove' || kind === 'challenge' || kind === 'sandbox'
  }

  private soundEvents(events: GameEvent[]) {
    for (const ev of events) {
      if (ev.kind === 'move') sfx.play('move')
      else if (ev.kind === 'rotate') sfx.play(ev.spin ? 'spin' : 'rotate')
      else if (ev.kind === 'harddrop') sfx.play('harddrop')
      else if (ev.kind === 'lock') sfx.play('lock')
      else if (ev.kind === 'hold') sfx.play('hold')
      else if (ev.kind === 'clear' && ev.info.lines > 0) {
        sfx.play(ev.info.lines === 4 ? 'quad' : 'clear')
      }
    }
  }

  // ── card actions (UI calls these) ──────────────────────────────

  next() {
    sfx.ensure()
    if (this.machine.next()) this.emit()
  }

  back() {
    if (this.machine.back()) this.emit()
  }

  retry() {
    if (this.machine.status !== 'active') return
    this.machine.retry()
    this.demoTimer = DEMO_LEAD_MS
    this.emit()
  }

  showHint() {
    this.hintText = this.machine.showHint()
    this.emit()
  }

  reveal() {
    this.machine.reveal()
    this.emit()
  }

  answer(input: RecognitionInput) {
    sfx.ensure()
    this.machine.answer(input)
    this.emit()
  }

  /** canvas click → recognition answer (cell or column kinds) */
  clickBoard(px: number, py: number) {
    if (this.machine.status !== 'active') return
    const step = this.machine.current()
    if (step.kind !== 'recognition') return
    const phase = this.machine.record().phase
    if (phase === 'solved' || phase === 'revealed') return
    const cell = this.renderer?.cellAt(px, py)
    if (!cell) return
    if (step.answer.kind === 'cell') this.answer({ cell })
    else if (step.answer.kind === 'column') this.answer({ column: cell[0] })
  }
}
