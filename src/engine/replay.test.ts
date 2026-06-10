/**
 * Replay recording (D5): replaying a recorded `{seed, config, stamped
 * actions}` log reproduces the identical final state. The drivers below
 * mirror the controller's fixed-step loop (STEP_MS grid).
 */
import { describe, expect, it } from 'vitest'
import { Engine } from './engine'
import { REPLAY_VERSION, ReplayRecorder, STEP_MS, simulateReplay, type Replay } from './replay'
import { createRng } from './rng'
import type { Action, EngineConfig, Mode } from './types'

const ACTIONS: Action[] = [
  'left',
  'right',
  'cw',
  'ccw',
  'r180',
  'softDropOn',
  'softDropOff',
  'hardDrop',
  'hold',
]

/**
 * Play a seeded pseudo-random game on the fixed-step grid while recording,
 * exactly as the controller does.
 */
function playRecorded(
  cfg: Partial<EngineConfig> & { seed: number; mode: Mode },
  opts: { steps: number; actionChance: number; driverSeed: number },
): { live: Engine; replay: Replay } {
  const live = new Engine(cfg)
  live.start()
  const recorder = new ReplayRecorder(live.cfg)
  const rng = createRng(opts.driverSeed)
  let step = 0
  for (; step < opts.steps && live.status === 'playing'; step++) {
    if (rng() < opts.actionChance) {
      const action = ACTIONS[Math.floor(rng() * ACTIONS.length)]
      recorder.record(step, action)
      live.applyAction(action)
    }
    live.tick(STEP_MS)
  }
  return { live, replay: recorder.finish(live, step) }
}

function expectIdenticalState(a: Engine, b: Engine) {
  expect(Array.from(b.board)).toEqual(Array.from(a.board))
  expect(b.status).toBe(a.status)
  expect(b.score).toBe(a.score)
  expect(b.lines).toBe(a.lines)
  expect(b.level).toBe(a.level)
  expect(b.combo).toBe(a.combo)
  expect(b.b2b).toBe(a.b2b)
  expect(b.piecesPlaced).toBe(a.piecesPlaced)
  expect(b.elapsed).toBe(a.elapsed)
  expect(b.hold).toBe(a.hold)
  expect(b.holdUsed).toBe(a.holdUsed)
  expect(b.queue).toEqual(a.queue)
  expect(b.active).toEqual(a.active)
}

describe('replay round-trip (D5)', () => {
  it('reproduces a marathon game exactly', () => {
    const { live, replay } = playRecorded(
      { seed: 1234, mode: 'marathon' },
      { steps: 12_000, actionChance: 0.05, driverSeed: 7 },
    )
    expect(replay.actions.length).toBeGreaterThan(50)
    expectIdenticalState(live, simulateReplay(replay))
  })

  it('reproduces a frantic high-input game exactly (action spam, top-out path)', () => {
    const { live, replay } = playRecorded(
      { seed: 99, mode: 'marathon' },
      { steps: 30_000, actionChance: 0.3, driverSeed: 41 },
    )
    expectIdenticalState(live, simulateReplay(replay))
  })

  it('reproduces survival rises exactly (timer-driven garbage)', () => {
    const { live, replay } = playRecorded(
      { seed: 5, mode: 'survival', riseStartMs: 900, riseMinMs: 300, riseDecayMs: 150 },
      { steps: 20_000, actionChance: 0.04, driverSeed: 13 },
    )
    expectIdenticalState(live, simulateReplay(replay))
  })

  it('reproduces cheese games exactly (seeded garbage holes + refills)', () => {
    const { live, replay } = playRecorded(
      { seed: 77, mode: 'cheese', cheeseTotal: 18 },
      { steps: 15_000, actionChance: 0.08, driverSeed: 3 },
    )
    expectIdenticalState(live, simulateReplay(replay))
  })

  it('honors mid-game SDF changes recorded in the log', () => {
    const cfg = { seed: 808, mode: 'marathon' as Mode }
    const live = new Engine(cfg)
    live.start()
    const recorder = new ReplayRecorder(live.cfg)
    live.applyAction('softDropOn')
    recorder.record(0, 'softDropOn')
    for (let step = 0; step < 2000; step++) {
      if (step === 400) {
        live.cfg.sdf = 41 // settings edit while paused: instant soft drop
        recorder.recordSdf(step, 41)
      }
      live.tick(STEP_MS)
    }
    const replay = recorder.finish(live, 2000)
    expect(live.piecesPlaced).toBeGreaterThan(0)
    expectIdenticalState(live, simulateReplay(replay))
  })

  it('records the config snapshot, not a live reference', () => {
    const live = new Engine({ seed: 1, mode: 'marathon' })
    live.start()
    const recorder = new ReplayRecorder(live.cfg)
    live.cfg.sdf = 41 // un-recorded mutation must not leak into the replay
    const replay = recorder.finish(live, 0)
    expect(replay.config.sdf).toBe(20)
    expect(replay.config.seed).toBe(1)
  })

  it('refuses to play a replay from a different engine version', () => {
    const { replay } = playRecorded(
      { seed: 2, mode: 'marathon' },
      { steps: 100, actionChance: 0.1, driverSeed: 1 },
    )
    const stale = { ...replay, version: REPLAY_VERSION + 1 }
    expect(() => simulateReplay(stale)).toThrow(/version/)
  })
})
