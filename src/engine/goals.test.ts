/**
 * GoalSpec compiler (spec training-core §2): declarative challenge goals
 * evaluated over engine state + events, driven through real lesson-mode
 * games — the same path the M2 lesson harness will use.
 */
import { describe, expect, it } from 'vitest'
import { Engine } from './engine'
import { compileGoal } from './goals'
import type { PieceType } from './types'

function lessonEngine(rows?: string[], queue?: PieceType[]): Engine {
  const e = new Engine({ seed: 2, mode: 'lesson' })
  if (rows) e.setBoard(rows)
  if (queue) e.setQueue(queue)
  e.start()
  return e
}

describe('noNewHoles', () => {
  it('passes after N clean placements', () => {
    const e = lessonEngine(undefined, ['I', 'I'])
    const goal = compileGoal({ kind: 'noNewHoles', pieces: 2 }, e)
    e.place({ type: 'I', rot: 0, x: 0 })
    expect(goal.observe(e.takeEvents())).toBe('pending')
    e.place({ type: 'I', rot: 0, x: 4 })
    expect(goal.observe(e.takeEvents())).toBe('passed')
    expect(goal.piecesUsed).toBe(2)
  })

  it('fails the moment a placement covers an empty cell', () => {
    const e = lessonEngine(['X_XXXXXXXX'], ['I'])
    const goal = compileGoal({ kind: 'noNewHoles', pieces: 5 }, e)
    e.place({ type: 'I', rot: 0, x: 0 }) // bridges the open cell at col 1
    expect(goal.observe(e.takeEvents())).toBe('failed')
  })

  it('tolerates pre-existing holes (baseline, not zero)', () => {
    const e = lessonEngine(['X_________', 'X_________', '_XXXXXXXXX'], ['O'])
    const goal = compileGoal({ kind: 'noNewHoles', pieces: 1 }, e)
    e.place({ type: 'O', rot: 0, x: 4 }) // flat ground far from the hole
    expect(goal.observe(e.takeEvents())).toBe('passed')
  })
})

describe('clearLines', () => {
  it('accumulates lines until n', () => {
    const e = lessonEngine(['XXXXXXXXX_', 'XXXXXXXXX_'], ['I'])
    const goal = compileGoal({ kind: 'clearLines', n: 2 }, e)
    e.place({ type: 'I', rot: 1, x: 7 }) // vertical I down the column-9 well
    expect(goal.observe(e.takeEvents())).toBe('passed')
  })

  it('with a label, only matching clears count', () => {
    const e = lessonEngine(
      ['XXXXXXXXX_', 'XXXXXXXXX_', 'XXXXXXXXX_', 'XXXXXXXXX_'],
      ['O', 'I'],
    )
    const goal = compileGoal({ kind: 'clearLines', n: 4, label: 'QUAD' }, e)
    e.place({ type: 'O', rot: 0, x: 8 }) // a double — wrong label
    expect(goal.observe(e.takeEvents())).toBe('pending')
    e.setBoard(['XXXXXXXXX_', 'XXXXXXXXX_', 'XXXXXXXXX_', 'XXXXXXXXX_'])
    e.place({ type: 'I', rot: 1, x: 7 }) // vertical I: QUAD
    expect(goal.observe(e.takeEvents())).toBe('passed')
  })
})

describe('maxBumpiness', () => {
  it('passes once the surface is flat enough', () => {
    // a 4-wide 1-deep notch: the flat I fills it exactly
    const e = lessonEngine(['XXX____XXX', 'XXXXXXXXXX'], ['I'])
    const goal = compileGoal({ kind: 'maxBumpiness', value: 0 }, e)
    e.place({ type: 'I', rot: 0, x: 3 })
    expect(goal.observe(e.takeEvents())).toBe('passed')
  })

  it('with a pieces budget, fails when the budget runs out', () => {
    const e = lessonEngine(undefined, ['S'])
    const goal = compileGoal({ kind: 'maxBumpiness', value: 0, pieces: 1 }, e)
    e.place({ type: 'S', rot: 0, x: 3 }) // an S on flat ground is never flat
    expect(goal.observe(e.takeEvents())).toBe('failed')
  })

  it('ignoring the well column excludes it from the surface', () => {
    const e = lessonEngine(['XXXXXXXXX_', 'XXXXXXXXX_'], ['I'])
    const withWell = compileGoal({ kind: 'maxBumpiness', value: 0, ignoreColumn: 9 }, e)
    const without = compileGoal({ kind: 'maxBumpiness', value: 0 }, e)
    // vertical I down the well clears 2; its remnant sticks up in column 9
    e.place({ type: 'I', rot: 1, x: 7 })
    const events = e.takeEvents()
    expect(withWell.observe(events)).toBe('passed')
    expect(without.observe(events)).toBe('pending')
  })
})

describe('wellPure', () => {
  it('passes after N pieces with the well untouched', () => {
    const e = lessonEngine(undefined, ['I', 'I'])
    const goal = compileGoal({ kind: 'wellPure', column: 9, pieces: 2 }, e)
    e.place({ type: 'I', rot: 0, x: 0 })
    e.place({ type: 'I', rot: 0, x: 4 })
    expect(goal.observe(e.takeEvents())).toBe('passed')
  })

  it('fails as soon as a cell lands in the well', () => {
    const e = lessonEngine(undefined, ['I'])
    const goal = compileGoal({ kind: 'wellPure', column: 9, pieces: 3 }, e)
    e.place({ type: 'I', rot: 0, x: 6 }) // covers columns 6–9
    expect(goal.observe(e.takeEvents())).toBe('failed')
  })
})

describe('terminal events', () => {
  it('a gameover fails any pending goal', () => {
    const e = lessonEngine(undefined, ['I'])
    const goal = compileGoal({ kind: 'noNewHoles', pieces: 10 }, e)
    expect(goal.observe([{ kind: 'gameover' }])).toBe('failed')
  })

  it('settled goals stay settled', () => {
    const e = lessonEngine(undefined, ['I'])
    const goal = compileGoal({ kind: 'wellPure', column: 9, pieces: 1 }, e)
    e.place({ type: 'I', rot: 0, x: 0 })
    expect(goal.observe(e.takeEvents())).toBe('passed')
    expect(goal.observe([{ kind: 'gameover' }])).toBe('passed')
  })
})
