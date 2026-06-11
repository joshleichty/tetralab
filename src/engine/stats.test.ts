/**
 * Derived replay stats (spec training-core §4). Replays are recorded
 * through the real InputHandler exactly as GameController wires it (same
 * dispatch filter, same press hook), so DAS/ARR repeats land in `actions`
 * while `presses` holds only physical keydowns — the distinction the
 * stats layer exists to exploit.
 */
import { describe, expect, it } from 'vitest'
import { Engine } from './engine'
import { ReplayRecorder, STEP_MS, simulateReplay } from './replay'
import type { Replay } from './replay'
import { analyzeReplay } from './stats'
import { InputHandler, DEFAULT_BINDINGS } from '../input/keyboard'
import type { EngineConfig, Mode } from './types'

interface Harness {
  engine: Engine
  input: InputHandler
  tap(code: string): void
  press(code: string): void
  release(code: string): void
  run(steps: number): void
  finish(): Replay
}

function harness(config: Partial<EngineConfig> & { seed: number; mode: Mode }): Harness {
  const engine = new Engine(config)
  const recorder = new ReplayRecorder(engine.cfg)
  const input = new InputHandler({ das: 100, arr: 0, dcd: 0 }, DEFAULT_BINDINGS)
  let step = 0
  input.dispatch = (a) => {
    // GameController's filter: skip no-op wall shoves to keep logs lean
    if (a === 'left' || a === 'right') {
      const p = engine.active
      const x = p?.x
      engine.applyAction(a)
      if (engine.active === p && p && p.x === x) return
    } else {
      engine.applyAction(a)
    }
    recorder.record(step, a)
  }
  input.onPress = (a) => recorder.recordPress(step, a)
  engine.start()
  return {
    engine,
    input,
    tap(code) {
      input.press(code)
      input.release(code)
    },
    press: (code) => input.press(code),
    release: (code) => input.release(code),
    run(steps) {
      for (let i = 0; i < steps; i++) {
        input.update(STEP_MS)
        engine.tick(STEP_MS)
        step++
      }
    },
    finish: () => recorder.finish(engine, step),
  }
}

/** seed 11 sprint: S first, queue L J T Z O I (probed; bag is seed-fixed) */
function recordSampleGame(): { replay: Replay; h: Harness } {
  const h = harness({ seed: 11, mode: 'sprint' })
  expect(h.engine.active!.type).toBe('S')

  // piece 1 — S: three taps left (never optimal; DAS-to-wall is 1) + a
  // flat S on flat ground always buries one cell → 1 player hole
  h.tap('ArrowLeft')
  h.run(2)
  h.tap('ArrowLeft')
  h.run(2)
  h.tap('ArrowLeft')
  h.run(2)
  h.tap('Space')
  h.run(2)

  // piece 2 — L: clean spawn drop, zero movement presses
  h.tap('Space')
  h.run(2)

  // piece 3 — J: soft drop involved ⇒ not finesse-graded; DAS to the
  // right wall (one press, several dispatched actions)
  h.press('ArrowDown')
  h.press('ArrowRight')
  h.run(25) // DAS (100ms) charges and shoves to the wall
  h.release('ArrowRight')
  h.release('ArrowDown')
  h.tap('Space')
  h.run(2)

  return { replay: h.finish(), h }
}

describe('analyzeReplay', () => {
  it('grades finesse from physical presses, not DAS/ARR repeats', () => {
    const { replay, h } = recordSampleGame()

    // the raw action log contains the DAS shove; the press log does not
    const rights = (kind: 'actions' | 'presses') =>
      (replay[kind] ?? []).filter(([, a]) => a === 'right').length
    expect(rights('actions')).toBe(4) // J from x=3 to the wall at x=7
    expect(rights('presses')).toBe(1)
    // the press log and the live KPP counter agree by construction
    expect(replay.presses!.length).toBe(h.input.keypresses)

    const stats = analyzeReplay(replay)
    expect(stats.verified).toBe(true)
    expect(stats.pieces).toBe(3)
    expect(stats.kpp).toBeCloseTo(replay.presses!.length / 3)

    const [s, l, j] = stats.perPiece
    expect(s).toMatchObject({ type: 'S', presses: 3, optimal: 1, fault: true, holesDelta: 1 })
    expect(l).toMatchObject({ type: 'L', presses: 0, fault: false, holesDelta: 0 })
    expect(j).toMatchObject({ type: 'J', fault: null }) // soft drop ⇒ ungraded
    expect(stats.finesseFaults).toBe(1)
    expect(stats.faultRate).toBe(0.5)
    expect(stats.holesCreated).toBe(1)
    expect(stats.roughness.timeline).toHaveLength(3)
    expect(stats.downstack).toBeNull()
  })

  it('press-less replays (pre-M1) analyze with degraded fidelity', () => {
    const { replay } = recordSampleGame()
    delete replay.presses
    const stats = analyzeReplay(replay)
    expect(stats.kpp).toBeNull()
    expect(stats.finesseFaults).toBeNull()
    expect(stats.perPiece[0].fault).toBeNull()
    expect(stats.holesCreated).toBe(1) // board-derived stats are unaffected
    expect(stats.verified).toBe(true)
  })

  it('flags summary drift instead of trusting the recording', () => {
    const { replay } = recordSampleGame()
    replay.summary.score += 1
    expect(analyzeReplay(replay).verified).toBe(false)
  })

  it('agrees with simulateReplay on the final state', () => {
    const { replay } = recordSampleGame()
    const sim = simulateReplay(replay)
    const stats = analyzeReplay(replay)
    expect(stats.final.score).toBe(sim.score)
    expect(stats.final.lines).toBe(sim.lines)
    expect(stats.final.pieces).toBe(sim.piecesPlaced)
  })

  it('computes the downstack metric on cheese replays', () => {
    // adaptive digger: dump non-I pieces at the wall away from the hole,
    // drop the bag's I down the hole column (cheeseHeight 1 ⇒ it clears)
    const h = harness({ seed: 21, mode: 'cheese', cheeseTotal: 18, cheeseHeight: 1 })
    const holeColumn = () => {
      for (let x = 0; x < 10; x++) if (h.engine.cellAt(x, 39) === 0) return x
      return -1
    }
    const moveTo = (target: number) => {
      for (let guard = 0; guard < 12 && h.engine.active!.x !== target; guard++) {
        h.tap(h.engine.active!.x > target ? 'ArrowLeft' : 'ArrowRight')
        h.run(1)
      }
    }
    let cleared = 0
    for (let piece = 0; piece < 14 && cleared === 0; piece++) {
      const hole = holeColumn()
      if (h.engine.active!.type === 'I') {
        h.tap('ArrowUp') // vertical I occupies column x+2
        h.run(2)
        moveTo(hole - 2)
        const before = h.engine.lines
        h.tap('Space')
        h.run(2)
        cleared = h.engine.lines - before
      } else {
        // dump at whichever wall is far from the hole
        if (hole >= 5) {
          h.press('ArrowLeft')
          h.run(25)
          h.release('ArrowLeft')
        } else {
          h.press('ArrowRight')
          h.run(25)
          h.release('ArrowRight')
        }
        h.tap('Space')
        h.run(2)
      }
    }
    expect(cleared).toBeGreaterThan(0)

    const stats = analyzeReplay(h.finish())
    expect(stats.verified).toBe(true)
    expect(stats.downstack).not.toBeNull()
    expect(stats.downstack!.cheeseCleared).toBeGreaterThan(0)
    expect(stats.downstack!.blocksPer100).toBeCloseTo(
      (stats.pieces / stats.downstack!.cheeseCleared) * 100,
    )
  })
})
