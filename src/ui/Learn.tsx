import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { LessonController } from '../game/lessonController'
import { loadLearnProgress } from '../game/learnProgress'
import type { GoalEvaluator } from '../engine/goals'
import type { Lesson, Step } from '../learn/types'
import { LESSONS } from '../lessons'
import { TRACKS } from '../lessons/tracks'
import { PreviewRenderer } from '../render/renderer'

/**
 * Learn: tracks → lessons → the player. The player is the flagship
 * surface — the board is the constant frame (same canvas as the game),
 * the card beside it carries the lesson's voice, and feedback is one
 * quiet moment at a time.
 */

export function Learn({ onExit }: { onExit: () => void }) {
  const [lessonId, setLessonId] = useState<string | null>(null)
  const lesson = LESSONS.find((l) => l.id === lessonId)

  if (lesson) {
    return (
      <LessonPlayer
        key={lesson.id}
        lesson={lesson}
        onExit={() => setLessonId(null)}
        onOpen={setLessonId}
      />
    )
  }
  return <LearnHome onExit={onExit} onOpen={setLessonId} />
}

function LearnHome({ onExit, onOpen }: { onExit: () => void; onOpen: (id: string) => void }) {
  const progress = loadLearnProgress()
  return (
    <div className="overlay menu">
      <header className="menu-brand">
        <h1 className="wordmark">learn</h1>
        <p className="tagline">lessons that build the competitive fundamentals</p>
      </header>

      <nav className="mode-list">
        {TRACKS.map((track) => {
          const lessons = LESSONS.filter((l) => l.track === track.id)
          return (
            <div key={track.id} className="learn-track">
              <span className="mode-group">
                {track.title}
                <span className="track-tally">
                  {lessons.filter((l) => progress[l.id]).length} / {lessons.length}
                </span>
              </span>
              {lessons.map((lesson, i) => (
                <button
                  key={lesson.id}
                  className="mode-row"
                  style={{ animationDelay: `${120 + i * 60}ms` }}
                  onClick={() => onOpen(lesson.id)}
                >
                  <span className="mode-name">{lesson.title}</span>
                  <span className="mode-desc">{lesson.summary}</span>
                  <span className={`mode-best${progress[lesson.id] ? ' learn-done' : ''}`}>
                    {progress[lesson.id] ? '✓' : '—'}
                  </span>
                </button>
              ))}
            </div>
          )
        })}
      </nav>

      <footer className="menu-footer">
        <button className="ghost-btn" onClick={onExit}>
          back
        </button>
        <span className="hint">lessons are 3–5 minutes · escape exits anytime</span>
      </footer>
    </div>
  )
}

// ── the player ─────────────────────────────────────────────────────

function useLessonController(lesson: Lesson, onExit: () => void): LessonController {
  const [ctrl] = useState(() => new LessonController(lesson, onExit))
  useSyncExternalStore(ctrl.subscribe, ctrl.getVersion)
  useEffect(() => () => ctrl.destroy(), [ctrl])
  return ctrl
}

function LessonPlayer({
  lesson,
  onExit,
  onOpen,
}: {
  lesson: Lesson
  onExit: () => void
  onOpen: (id: string) => void
}) {
  const ctrl = useLessonController(lesson, onExit)
  const m = ctrl.machine
  const complete = m.status === 'complete'
  const step = complete ? null : m.current()
  const track = TRACKS.find((t) => t.id === lesson.track)
  const siblings = LESSONS.filter((l) => l.track === lesson.track)
  const nextLesson = siblings[siblings.indexOf(lesson) + 1]

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && m.status === 'active' && m.canAdvance()) ctrl.next()
      else if (e.key === 'Backspace') ctrl.back()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [ctrl, m])

  const feedback = m.feedback
  const wrongMessage =
    feedback?.kind === 'wrong'
      ? (feedback.message ?? null)
      : feedback?.kind === 'goalFailed'
        ? 'not this time — retry resets the board.'
        : null

  return (
    <main className="stage learn-stage">
      <aside className="side side-left learn-rail" aria-hidden>
        {lesson.steps.map((_, i) => (
          <span
            key={i}
            className={`rail-dot${i === m.stepIndex && !complete ? ' here' : ''}${
              m.records[i].phase !== 'pending' ? ' done' : ''
            }`}
          />
        ))}
      </aside>

      <div className="field-frame lesson-frame">
        <LessonCanvas ctrl={ctrl} tappable={step?.kind === 'recognition'} />
        {feedback && <div key={feedback.id} className={`lesson-cue ${feedback.kind}`} />}
      </div>

      <aside className="side side-right lesson-card">
        <span className="lesson-kicker">
          {track?.title ?? lesson.track} · {lesson.title}
        </span>
        {complete ? (
          <CompletionCard ctrl={ctrl} nextId={nextLesson?.id} onOpen={onOpen} onExit={onExit} />
        ) : (
          step && <StepCard ctrl={ctrl} step={step} wrongMessage={wrongMessage} />
        )}
      </aside>
    </main>
  )
}

function LessonCanvas({ ctrl, tappable }: { ctrl: LessonController; tappable: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    ctrl.attachBoard(ref.current)
    return () => ctrl.attachBoard(null)
  }, [ctrl])
  return (
    <canvas
      ref={ref}
      className={tappable ? 'tappable' : undefined}
      onClick={(e) => {
        const r = (e.target as HTMLCanvasElement).getBoundingClientRect()
        ctrl.clickBoard(e.clientX - r.left, e.clientY - r.top)
      }}
    />
  )
}

function StepCard({
  ctrl,
  step,
  wrongMessage,
}: {
  ctrl: LessonController
  step: Step
  wrongMessage: string | null
}) {
  const m = ctrl.machine
  const phase = m.record().phase
  const settled = phase === 'solved' || phase === 'revealed'
  const gated = step.kind === 'guidedMove' || step.kind === 'challenge' || step.kind === 'recognition'
  const caption = step.kind === 'recognition' ? step.prompt : (step.caption ?? '')
  const hint = 'hint' in step ? step.hint : undefined
  const last = m.stepIndex === m.lesson.steps.length - 1

  return (
    <>
      <p className="lesson-caption">{caption}</p>

      {step.kind === 'challenge' && m.goal && !settled && (
        <span className="lesson-goal">{describeGoal(m.goal)}</span>
      )}
      {(step.kind === 'guidedMove' || step.kind === 'challenge') && <QueueStrip ctrl={ctrl} />}
      {step.kind === 'recognition' && step.answer.kind === 'choice' && (
        <Choices ctrl={ctrl} choices={step.answer.choices} settled={settled} />
      )}

      {wrongMessage && !settled && <p className="lesson-note wrong">{wrongMessage}</p>}
      {ctrl.hintText && !settled && <p className="lesson-note hint-note">{ctrl.hintText}</p>}
      {phase === 'revealed' && <p className="lesson-note">revealed — worth replaying later.</p>}

      <div className="lesson-actions">
        {gated && !settled && hint && !ctrl.hintText && (
          <button className="ghost-btn" onClick={() => ctrl.showHint()}>
            hint
          </button>
        )}
        {gated && !settled && (ctrl.hintText || !hint) && (
          <button className="ghost-btn" onClick={() => ctrl.reveal()}>
            reveal
          </button>
        )}
        {step.kind === 'demo' && m.demoDone() && (
          <button className="ghost-btn" onClick={() => ctrl.retry()}>
            replay
          </button>
        )}
        {(step.kind === 'challenge' || step.kind === 'sandbox') && (
          <button className="ghost-btn" onClick={() => ctrl.retry()}>
            reset
          </button>
        )}
        {m.stepIndex > 0 && (
          <button className="ghost-btn" onClick={() => ctrl.back()}>
            back
          </button>
        )}
        <button
          className={`solid-btn continue${m.canAdvance() ? ' armed' : ''}`}
          disabled={!m.canAdvance()}
          onClick={() => ctrl.next()}
        >
          {last ? 'finish' : 'continue'}
        </button>
      </div>

      <span className="hint lesson-keys">
        {step.kind === 'guidedMove' || step.kind === 'challenge' || step.kind === 'sandbox'
          ? 'arrows move · z x rotate · space drop'
          : step.kind === 'recognition' && step.answer.kind !== 'choice'
            ? 'click the board'
            : 'enter continues'}
      </span>
    </>
  )
}

function Choices({
  ctrl,
  choices,
  settled,
}: {
  ctrl: LessonController
  choices: string[]
  settled: boolean
}) {
  const m = ctrl.machine
  // deterministic shuffle so the correct answer isn't always first
  const order = useMemo(() => {
    const idx = choices.map((_, i) => i)
    let s = (m.lesson.seed ?? 1) * 31 + m.stepIndex * 7 + choices.length
    for (let i = idx.length - 1; i > 0; i--) {
      s = (s * 1103515245 + 12345) & 0x7fffffff
      const j = s % (i + 1)
      ;[idx[i], idx[j]] = [idx[j], idx[i]]
    }
    return idx
  }, [choices, m.lesson.seed, m.stepIndex])

  return (
    <div className="lesson-choices">
      {order.map((original) => (
        <button
          key={original}
          className="choice-btn"
          disabled={settled}
          onClick={() => ctrl.answer({ choice: original })}
        >
          {choices[original]}
        </button>
      ))}
    </div>
  )
}

function QueueStrip({ ctrl }: { ctrl: LessonController }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const rendererRef = useRef<PreviewRenderer | null>(null)
  // only the step's remaining scripted pieces — the bag tail behind a
  // script is real but irrelevant to the exercise
  const m = ctrl.machine
  const step = m.status === 'active' ? m.current() : null
  let remaining = 0
  if (step && (step.kind === 'guidedMove' || step.kind === 'challenge')) {
    const scripted = (step.queue ?? step.solution).length
    remaining = Math.max(0, Math.min(3, scripted - (m.engine?.piecesPlaced ?? 0) - 1))
  }
  const pieces = remaining > 0 ? (m.engine?.queue.slice(0, remaining) ?? []) : []

  useEffect(() => {
    if (canvasRef.current && !rendererRef.current) {
      rendererRef.current = new PreviewRenderer(canvasRef.current, 56, 96)
    }
    rendererRef.current?.draw(pieces.length > 0 ? pieces : [null], { cell: 11 })
  })

  if (pieces.length === 0) return null
  return (
    <div className="lesson-queue">
      <span className="box-label">next</span>
      <canvas ref={canvasRef} />
    </div>
  )
}

function CompletionCard({
  ctrl,
  nextId,
  onOpen,
  onExit,
}: {
  ctrl: LessonController
  nextId?: string
  onOpen: (id: string) => void
  onExit: () => void
}) {
  const records = ctrl.machine.records
  const mistakes = records.reduce((n, r) => n + r.mistakes, 0)
  const revealed = records.filter((r) => r.phase === 'revealed').length
  return (
    <>
      <p className="lesson-caption complete-title">lesson complete</p>
      <p className="lesson-note">
        {mistakes === 0 && revealed === 0
          ? 'clean run — nothing bounced, nothing revealed.'
          : [
              mistakes > 0 ? `${mistakes} bounce${mistakes === 1 ? '' : 's'}` : null,
              revealed > 0 ? `${revealed} revealed` : null,
            ]
              .filter(Boolean)
              .join(' · ')}
      </p>
      <div className="lesson-actions">
        {nextId && (
          <button className="solid-btn" onClick={() => onOpen(nextId)}>
            next lesson
          </button>
        )}
        <button className="ghost-btn" onClick={onExit}>
          all lessons
        </button>
      </div>
    </>
  )
}

function describeGoal(goal: GoalEvaluator): string {
  const spec = goal.spec
  switch (spec.kind) {
    case 'noNewHoles':
      return `no new holes · ${goal.piecesUsed} / ${spec.pieces} pieces`
    case 'wellPure':
      return `column ${spec.column} stays empty · ${goal.piecesUsed} / ${spec.pieces} pieces`
    case 'maxBumpiness':
      return spec.value === 0 ? 'level the surface' : `bumpiness ≤ ${spec.value}`
    case 'clearLines':
      return spec.label ? spec.label.toLowerCase() : `clear ${spec.n} lines`
  }
}
