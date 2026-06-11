import { parseRows } from '../engine/board.ts'
import { BOARD_W } from '../engine/pieces.ts'
import { LessonMachine } from './machine.ts'
import type { Lesson, RecognitionInput, Step } from './types.ts'

/**
 * The lesson-validation harness (spec training-core §2, the headless-first
 * invariant): every lesson must be machine-verifiable with no DOM. The
 * vitest suite runs both checks over the whole registry — a lesson that
 * can't pass its own solutions fails CI, not a learner.
 *
 * Errors are thrown with `<lesson>/<step>` context so a failing lesson
 * reads like a review note, not a stack trace.
 */

/** static checks: boards parse, solutions/answers are well-formed */
export function validateLesson(lesson: Lesson): void {
  const fail = (msg: string, step?: number): never => {
    throw new Error(`lesson ${lesson.id}${step !== undefined ? ` step ${step}` : ''}: ${msg}`)
  }
  if (!lesson.id) fail('missing id')
  if (!lesson.track) fail('missing track')
  if (!lesson.title) fail('missing title')
  if (lesson.steps.length === 0) fail('has no steps')
  if (lesson.steps.length > 16) fail(`${lesson.steps.length} steps — lessons are 6–12, cut it`)

  lesson.steps.forEach((step, i) => {
    try {
      parseRows(step.board)
    } catch (e) {
      fail(`board does not parse — ${(e as Error).message}`, i)
    }
    if (step.kind === 'demo' && step.script.length === 0) fail('demo with empty script', i)
    if (step.kind === 'guidedMove' && step.solution.length === 0) {
      fail('guidedMove with empty solution', i)
    }
    if (step.kind === 'challenge' && step.solution.length === 0) {
      fail('challenge without a solution — reveal and the harness both need one', i)
    }
    if (step.kind === 'recognition') {
      const a = step.answer
      if (a.kind === 'cell' && (a.at[0] < 0 || a.at[0] >= BOARD_W || a.at[1] < 0)) {
        fail(`cell answer out of bounds: ${a.at}`, i)
      }
      if (a.kind === 'column' && (a.column < 0 || a.column >= BOARD_W)) {
        fail(`column answer out of bounds: ${a.column}`, i)
      }
      if (a.kind === 'choice' && (a.correct < 0 || a.correct >= a.choices.length)) {
        fail(`correct index ${a.correct} outside ${a.choices.length} choices`, i)
      }
      if (a.kind === 'choice' && a.choices.length < 2) fail('fewer than 2 choices', i)
    }
  })
}

/**
 * Dynamic check: drive a machine through the whole lesson using the
 * authored solutions, asserting every gate opens. Returns the completed
 * machine so tests can inspect records.
 */
export function completeLesson(lesson: Lesson): LessonMachine {
  const m = new LessonMachine(lesson)
  const fail = (msg: string): never => {
    throw new Error(`lesson ${lesson.id} step ${m.stepIndex} (${m.current().kind}): ${msg}`)
  }

  while (m.status !== 'complete') {
    const step = m.current()
    solveStep(m, step, fail)
    if (!m.canAdvance()) fail('gate did not open after the authored solution')
    if (!m.next()) fail('next() refused with an open gate')
  }
  return m
}

function solveStep(m: LessonMachine, step: Step, fail: (msg: string) => never) {
  switch (step.kind) {
    case 'prose':
    case 'sandbox':
      return
    case 'demo':
      while (!m.demoDone()) m.runDemoMove() // throws with context itself
      return
    case 'guidedMove':
    case 'challenge': {
      for (const [i, p] of step.solution.entries()) {
        if (!m.place(p)) {
          fail(`solution placement ${i} (${p.type} rot=${p.rot} x=${p.x}) does not apply`)
        }
      }
      const phase = m.record().phase
      if (phase !== 'solved') {
        fail(
          step.kind === 'guidedMove'
            ? 'solution played but the step is not solved'
            : `solution played but the goal is '${m.goal?.state}', not passed`,
        )
      }
      return
    }
    case 'recognition': {
      if (!m.answer(correctInput(step))) fail('the authored answer is judged wrong')
      return
    }
  }
}

function correctInput(step: Extract<Step, { kind: 'recognition' }>): RecognitionInput {
  const a = step.answer
  if (a.kind === 'cell') return { cell: a.at }
  if (a.kind === 'column') return { column: a.column }
  return { choice: a.correct }
}
