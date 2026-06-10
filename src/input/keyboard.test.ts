/**
 * Headless input-pipeline tests: DAS/ARR semantics, DCD ([FAQ] "pauses
 * ongoing DAS movement after dropping or rotating"), safelock ([TIO]
 * "prevent accidental hard drops"), and the finesse/KPP counters.
 * No DOM — press/release/update drive everything (CLAUDE.md invariant).
 */
import { beforeEach, describe, expect, it } from 'vitest'
import type { Action } from '../engine/types'
import { DEFAULT_BINDINGS, InputHandler } from './keyboard'

let input: InputHandler
let out: Action[]

function make(handling = { das: 100, arr: 20, dcd: 0 }) {
  input = new InputHandler(handling, structuredClone(DEFAULT_BINDINGS))
  out = []
  input.dispatch = (a) => out.push(a)
}

beforeEach(() => make())

describe('DAS/ARR', () => {
  it('dispatches one move on press, then repeats at ARR after DAS', () => {
    input.press('ArrowLeft')
    expect(out).toEqual(['left'])
    input.update(99) // DAS not yet charged
    expect(out).toEqual(['left'])
    input.update(1) // charged; no repeat until ARR accumulates
    input.update(20)
    expect(out).toEqual(['left', 'left'])
    input.update(40)
    expect(out).toEqual(['left', 'left', 'left', 'left'])
  })

  it('ARR 0 shoves to the wall once DAS fires', () => {
    make({ das: 100, arr: 0, dcd: 0 })
    input.press('ArrowRight')
    input.update(100)
    expect(out.filter((a) => a === 'right').length).toBeGreaterThanOrEqual(10)
  })

  it('most recent direction wins; DAS charge survives a release (Jstris model)', () => {
    input.press('ArrowLeft')
    input.press('ArrowRight') // overrides left; charge resets on a new press
    expect(out[out.length - 1]).toBe('right')
    input.update(100) // right charges fully
    input.release('ArrowRight') // left still held: the full charge is kept
    out = []
    input.update(20) // still charged → left repeats immediately at ARR
    expect(out).toContain('left')
    expect(out).not.toContain('right')
  })
})

describe('DCD (DAS cut delay)', () => {
  it('pauses auto-repeat after a rotation, then resumes', () => {
    make({ das: 100, arr: 10, dcd: 30 })
    input.press('ArrowLeft')
    input.update(100) // charged (DAS overshoot feeds ARR: repeats begin)
    expect(out.filter((a) => a === 'left').length).toBeGreaterThan(1)
    input.press('KeyZ') // rotate → DCD arms
    out = []
    input.update(10)
    input.update(10)
    input.update(10) // 30 ms of pause: no repeats
    expect(out.filter((a) => a === 'left').length).toBe(0)
    input.update(10) // DCD elapsed → repeats resume (charge was preserved)
    expect(out.filter((a) => a === 'left').length).toBe(1)
  })

  it('also arms on hard drop', () => {
    make({ das: 100, arr: 10, dcd: 30 })
    input.press('ArrowLeft')
    input.update(110)
    input.press('Space')
    out = []
    input.update(10)
    expect(out.filter((a) => a === 'left').length).toBe(0)
  })

  it('is off at 0 (default)', () => {
    input.press('ArrowLeft')
    input.update(100)
    input.press('KeyZ')
    out = []
    input.update(20)
    expect(out.filter((a) => a === 'left').length).toBe(1)
  })
})

describe('safelock', () => {
  it('swallows hard drops while armed, then re-allows them', () => {
    input.safelockMs = 100
    input.press('Space')
    expect(out).toEqual([])
    input.release('Space')
    input.update(101)
    input.press('Space')
    expect(out).toEqual(['hardDrop'])
  })
})

describe('stuck-input protection', () => {
  it('reset clears held keys and releases soft drop', () => {
    input.press('ArrowDown')
    input.press('ArrowLeft')
    expect(out).toEqual(['softDropOn', 'left'])
    input.reset() // window blur
    expect(out[out.length - 1]).toBe('softDropOff')
    out = []
    input.update(500) // nothing held anymore → no DAS repeats
    expect(out).toEqual([])
    input.press('ArrowLeft') // keys work again after re-press
    expect(out).toEqual(['left'])
  })
})

describe('finesse/KPP counters', () => {
  it('counts gameplay keypresses, not repeats or pause/restart', () => {
    input.press('ArrowLeft')
    input.update(200) // DAS repeats are not presses
    input.press('KeyZ')
    input.press('Space')
    input.press('Escape')
    input.press('KeyR')
    expect(input.keypresses).toBe(3)
  })

  it('tracks per-piece movement inputs and soft-drop usage', () => {
    input.press('ArrowLeft')
    input.release('ArrowLeft')
    input.press('KeyZ')
    expect(input.takePieceInputs()).toEqual({ moves: 2, usedSoftDrop: false })
    // counters reset after take
    input.press('ArrowDown')
    expect(input.takePieceInputs()).toEqual({ moves: 0, usedSoftDrop: true })
  })
})
