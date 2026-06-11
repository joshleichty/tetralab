/**
 * LessonMachine semantics (spec training-core §2): interaction gating,
 * soft-bounce mistakes, hint→reveal escalation, free back-navigation.
 */
import { describe, expect, it } from 'vitest'
import { LessonMachine } from './machine'
import type { Lesson, Step } from './types'

function lessonOf(steps: Step[], seed = 1): Lesson {
  return { id: 'test/lesson', track: 'test', title: 'test', seed, steps }
}

const GUIDED: Step = {
  kind: 'guidedMove',
  board: ['XXXXXX__XX', 'XXXXXX__XX'],
  solution: [{ type: 'O', rot: 0, x: 6 }],
  caption: 'fill the gap',
  hint: 'two wide, two deep',
  mistakes: [{ match: { type: 'O', rot: 0, x: 0 }, message: 'fill it instead' }],
}

const CHALLENGE: Step = {
  kind: 'challenge',
  board: ['XXXXXXXX__', 'XXXXXXXX__'],
  goal: { kind: 'noNewHoles', pieces: 2 },
  caption: 'no holes',
  solution: [
    { type: 'O', rot: 0, x: 8 },
    { type: 'I', rot: 0, x: 0 },
  ],
}

const PROSE: Step = { kind: 'prose', board: [], caption: 'words' }

describe('gating', () => {
  it('prose advances freely; gated steps refuse until solved', () => {
    const m = new LessonMachine(lessonOf([PROSE, GUIDED]))
    expect(m.canAdvance()).toBe(true)
    expect(m.next()).toBe(true)
    expect(m.canAdvance()).toBe(false)
    expect(m.next()).toBe(false)
    m.place({ type: 'O', rot: 0, x: 6 })
    expect(m.record().phase).toBe('solved')
    expect(m.next()).toBe(true)
    expect(m.status).toBe('complete')
  })

  it('a wrong guided move bounces: mistake counted, message found, board reset', () => {
    const m = new LessonMachine(lessonOf([GUIDED]))
    expect(m.place({ type: 'O', rot: 0, x: 0 })).toBe(true) // applies, but is wrong
    expect(m.record().phase).toBe('pending')
    expect(m.record().mistakes).toBe(1)
    expect(m.feedback).toMatchObject({ kind: 'wrong', message: 'fill it instead' })
    expect(m.engine!.piecesPlaced).toBe(0) // soft bounce: the board reset
    m.place({ type: 'O', rot: 0, x: 6 })
    expect(m.record().phase).toBe('solved')
    expect(m.feedback).toMatchObject({ kind: 'correct' })
  })

  it('equivalent rotations count as the scripted placement (S spawn ≡ S 180)', () => {
    const step: Step = {
      kind: 'guidedMove',
      board: [],
      solution: [{ type: 'S', rot: 0, x: 3 }],
      caption: 's',
    }
    const m = new LessonMachine(lessonOf([step]))
    m.place({ type: 'S', rot: 2, x: 3 }) // same cells, different rot label
    expect(m.record().phase).toBe('solved')
  })

  it('challenge: goal failure is feedback + retry, not a dead end', () => {
    const step: Step = {
      kind: 'challenge',
      board: ['X_XXXXXXXX'],
      goal: { kind: 'noNewHoles', pieces: 2 },
      caption: 'no holes',
      solution: [
        { type: 'I', rot: 1, x: -1 }, // vertical I down column 1 — no cover
        { type: 'O', rot: 0, x: 2 },
      ],
    }
    const m = new LessonMachine(lessonOf([step]))
    m.place({ type: 'I', rot: 0, x: 0 }) // bridges the open cell: new hole
    expect(m.goal!.state).toBe('failed')
    expect(m.feedback).toMatchObject({ kind: 'goalFailed' })
    expect(m.canAdvance()).toBe(false)
    m.retry()
    expect(m.goal!.state).toBe('pending')
    expect(m.engine!.piecesPlaced).toBe(0)
  })
})

describe('hint → reveal', () => {
  it('showHint returns the hint and marks the record', () => {
    const m = new LessonMachine(lessonOf([GUIDED]))
    expect(m.showHint()).toBe('two wide, two deep')
    expect(m.record().hintUsed).toBe(true)
  })

  it('reveal plays the solution and advances as revealed, not solved', () => {
    const m = new LessonMachine(lessonOf([CHALLENGE, PROSE]))
    m.place({ type: 'O', rot: 0, x: 0 }) // a stray attempt first
    m.reveal()
    expect(m.record().phase).toBe('revealed')
    expect(m.goal!.state).toBe('passed') // the revealed solve really ran
    expect(m.canAdvance()).toBe(true)
    expect(m.next()).toBe(true)
  })

  it('reveal on a partially-solved guidedMove finishes the remainder', () => {
    const two: Step = {
      kind: 'guidedMove',
      board: [],
      solution: [
        { type: 'I', rot: 0, x: 0 },
        { type: 'I', rot: 0, x: 4 },
      ],
      caption: 'two flats',
    }
    const m = new LessonMachine(lessonOf([two]))
    m.place({ type: 'I', rot: 0, x: 0 })
    expect(m.record().phase).toBe('pending')
    m.reveal()
    expect(m.record().phase).toBe('revealed')
    expect(m.engine!.piecesPlaced).toBe(2)
  })
})

describe('navigation', () => {
  it('back is free and an earned gate stays earned', () => {
    const m = new LessonMachine(lessonOf([GUIDED, PROSE]))
    m.place({ type: 'O', rot: 0, x: 6 })
    m.next()
    expect(m.stepIndex).toBe(1)
    expect(m.back()).toBe(true)
    expect(m.stepIndex).toBe(0)
    expect(m.canAdvance()).toBe(true) // solved once, open forever
    expect(m.records[0].phase).toBe('solved')
  })

  it('recognition answers: wrong bounces, right opens the gate', () => {
    const step: Step = {
      kind: 'recognition',
      board: ['X_XXXXXXXX', 'X_XXXXXXXX'],
      prompt: 'tap',
      answer: { kind: 'choice', choices: ['a well', 'a hole'], correct: 1 },
    }
    const m = new LessonMachine(lessonOf([step]))
    expect(m.answer({ choice: 0 })).toBe(false)
    expect(m.record().mistakes).toBe(1)
    expect(m.canAdvance()).toBe(false)
    expect(m.answer({ choice: 1 })).toBe(true)
    expect(m.canAdvance()).toBe(true)
  })

  it('demo action scripts drive the engine (the kick/tuck escape hatch)', () => {
    const step: Step = {
      kind: 'demo',
      board: [],
      script: [
        { type: 'I', rot: 0, x: 0 },
        { piece: 'I', actions: ['right', 'hardDrop'] },
      ],
      caption: 'demo',
    }
    const m = new LessonMachine(lessonOf([step]))
    expect(m.runDemoMove()).toBe(true)
    expect(m.runDemoMove()).toBe(true)
    expect(m.runDemoMove()).toBe(false) // exhausted
    expect(m.demoDone()).toBe(true)
    expect(m.engine!.piecesPlaced).toBe(2)
  })
})
