import { describe, expect, it } from 'vitest'
import { Engine } from '../engine/engine'
import { DEFAULT_ATTACK_CONFIG } from '../engine/attack'
import { BOARD_H, BOARD_W, cellsAt, fits } from '../engine/pieces'
import { STEP_MS } from '../engine/replay'
import type { Action, GameEvent, Rot } from '../engine/types'
import { LockstepSession, matchReplayFrom, simulateMatchReplay } from './lockstep'
import type { LockstepConfig } from './lockstep'
import { FakeNetwork } from './transport'
import type { NetConditions } from './transport'

/**
 * Online 1v1 lockstep (specs/feature-parity.md Phase 4): full two-engine
 * matches over the in-memory transport, asserted on engine state — the
 * headless gate WebRTC must not precede. Every scenario is seeded and
 * fixed-step; there is no wall clock anywhere.
 */

const MATCH_SEED = 0xc0ffee
/** singles send 2 so greedy downstacking generates real cross pressure */
const AGGRO_ATTACK = {
  ...DEFAULT_ATTACK_CONFIG,
  clear: [0, 2, 3, 4, 6] as [number, number, number, number, number],
  messiness: 0.4,
}
const BASE_CFG: Omit<LockstepConfig, 'localSdf' | 'remoteSdf'> = {
  seed: MATCH_SEED,
  engine: { attack: AGGRO_ATTACK },
  attackDelaySteps: 80,
  hashEverySteps: 50,
  flushEveryMs: 5,
}

// ── deterministic test players ───────────────────────────────────

/** column heights + covered holes — enough signal to downstack and clear */
function evalBoard(board: Uint8Array): number {
  let holes = 0
  let aggregate = 0
  for (let x = 0; x < BOARD_W; x++) {
    let roof = false
    for (let y = 0; y < BOARD_H; y++) {
      const filled = board[y * BOARD_W + x] !== 0
      if (filled && !roof) {
        roof = true
        aggregate += BOARD_H - y
      } else if (!filled && roof) {
        holes++
      }
    }
  }
  return -(holes * 100 + aggregate)
}

/** greedy one-piece lookahead: pick (rot, x), emit rotate/move/hardDrop */
function planFor(e: Engine): Action[] {
  const p = e.active
  if (!p) return []
  let best: { score: number; rot: Rot; x: number } | null = null
  for (let r = 0; r < 4; r++) {
    const rot = r as Rot
    for (let x = -2; x < BOARD_W; x++) {
      if (!fits(e.board, p.type, rot, x, p.y)) continue
      let y = p.y
      while (fits(e.board, p.type, rot, x, y + 1)) y++
      const sim = e.board.slice()
      for (const [cx, cy] of cellsAt(p.type, rot, x, y)) sim[cy * BOARD_W + cx] = 1
      let cleared = 0
      for (let row = 0; row < BOARD_H; row++) {
        let full = true
        for (let cx = 0; cx < BOARD_W; cx++) {
          if (sim[row * BOARD_W + cx] === 0) {
            full = false
            break
          }
        }
        if (full) {
          cleared++
          sim.copyWithin(BOARD_W, 0, row * BOARD_W)
          sim.fill(0, 0, BOARD_W)
        }
      }
      const score = cleared * 1000 + evalBoard(sim)
      if (!best || score > best.score) best = { score, rot, x }
    }
  }
  if (!best) return ['hardDrop']
  const acts: Action[] = []
  if (best.rot === 1) acts.push('cw')
  else if (best.rot === 2) acts.push('r180')
  else if (best.rot === 3) acts.push('ccw')
  const dx = best.x - p.x
  for (let i = 0; i < Math.abs(dx); i++) acts.push(dx < 0 ? 'left' : 'right')
  acts.push('hardDrop')
  return acts
}

/** one greedy action every `actEvery` steps — a pure function of the step
 *  grid and the local engine, so its stream is network-independent */
function greedyBot(session: LockstepSession, actEvery: number) {
  let plan: Action[] = []
  let planKey = -1
  return (step: number) => {
    if (step % actEvery !== 0) return
    const e = session.localEngine
    if (e.status !== 'playing' || !e.active) return
    if (e.piecesPlaced !== planKey) {
      plan = planFor(e)
      planKey = e.piecesPlaced
    }
    const a = plan.shift()
    if (a) session.applyAction(a)
  }
}

/** no stacking decisions at all: instant-drop pieces straight down */
function instantDropBot(session: LockstepSession) {
  return (step: number) => {
    if (step === 0) session.applyAction('softDropOn')
  }
}

// ── headless match harness ───────────────────────────────────────

interface RunOpts {
  net?: Partial<NetConditions> & { seed?: number }
  cfg?: Partial<LockstepConfig>
  /** greedy act cadence per player; null = instant-drop no-op player */
  rateA?: number | null
  rateB?: number | null
  maxSlices?: number
  /** per-slice hook; return true to stop early */
  onSlice?: (run: MatchRun, slice: number, evA: GameEvent[], evB: GameEvent[]) => boolean | void
}

interface MatchRun {
  a: LockstepSession
  b: LockstepSession
  net: FakeNetwork
  slices: number
}

function runMatch(opts: RunOpts = {}): MatchRun {
  const net = new FakeNetwork({ seed: 42, ...opts.net })
  const cfg = { ...BASE_CFG, ...opts.cfg }
  const sdfFor = (rate: number | null | undefined) => (rate === null ? 41 : undefined)
  const a = new LockstepSession(net.ends[0], {
    ...cfg,
    localSdf: sdfFor(opts.rateA),
    remoteSdf: sdfFor(opts.rateB),
  })
  const b = new LockstepSession(net.ends[1], {
    ...cfg,
    localSdf: sdfFor(opts.rateB),
    remoteSdf: sdfFor(opts.rateA),
  })
  a.start()
  b.start()
  const onA = opts.rateA === null ? instantDropBot(a) : greedyBot(a, opts.rateA ?? 6)
  const onB = opts.rateB === null ? instantDropBot(b) : greedyBot(b, opts.rateB ?? 12)
  const run: MatchRun = { a, b, net, slices: 0 }
  const maxSlices = opts.maxSlices ?? 120_000
  for (let i = 0; i < maxSlices; i++) {
    a.tick(STEP_MS, onA)
    b.tick(STEP_MS, onB)
    net.tick(STEP_MS)
    run.slices = i + 1
    const evA = a.takeEvents()
    const evB = b.takeEvents()
    a.takeRemoteEvents()
    b.takeRemoteEvents()
    if (opts.onSlice?.(run, i, evA, evB)) break
    if (a.status !== 'playing' && b.status !== 'playing') break
  }
  return run
}

const decided = ['won', 'lost', 'draw']

function expectComplementary(run: MatchRun) {
  expect(decided).toContain(run.a.status)
  expect(decided).toContain(run.b.status)
  if (run.a.status === 'draw') expect(run.b.status).toBe('draw')
  if (run.a.status === 'won') expect(run.b.status).toBe('lost')
  if (run.a.status === 'lost') expect(run.b.status).toBe('won')
  // both clients agree on every death step
  expect(run.b.remoteDeadStep).toBe(run.a.localDeadStep)
  expect(run.a.remoteDeadStep).toBe(run.b.localDeadStep)
}

// ── tests ────────────────────────────────────────────────────────

describe('LockstepSession', () => {
  it('perfect network: a full match decides complementarily with no desync', () => {
    const run = runMatch({ rateA: 6, rateB: 12 })
    expectComplementary(run)
    // hash surveillance ran clean the whole match
    expect(run.a.status).not.toBe('desynced')
    expect(run.b.status).not.toBe('desynced')
    // pressure actually crossed the wire in both directions
    expect(run.a.localEngine.lines).toBeGreaterThan(0)
    expect(run.b.localEngine.lines).toBeGreaterThan(0)
  })

  it('latency, jitter and drops change nothing about the outcome', () => {
    const perfect = runMatch({ rateA: 6, rateB: 12 })
    const lossy = runMatch({
      rateA: 6,
      rateB: 12,
      net: { latencyMs: 60, jitterMs: 40, dropRate: 0.25, seed: 7 },
    })
    expectComplementary(lossy)
    expect(lossy.a.status).toBe(perfect.a.status)
    expect(lossy.b.status).toBe(perfect.b.status)
    expect(lossy.a.localDeadStep).toBe(perfect.a.localDeadStep)
    expect(lossy.b.localDeadStep).toBe(perfect.b.localDeadStep)
    // the loser's engine froze at its death step — a network-independent
    // state (the winner's frontier legitimately varies with timing, since
    // it keeps simulating while the decision packet is in flight)
    const loserOf = (run: MatchRun) => (run.a.status === 'lost' ? run.a : run.b).localEngine
    expect(loserOf(lossy).stateHash()).toBe(loserOf(perfect).stateHash())
  })

  it('heavy packet loss still converges via the redundancy window', () => {
    const run = runMatch({
      rateA: 6,
      rateB: 12,
      net: { latencyMs: 20, jitterMs: 30, dropRate: 0.5, seed: 11 },
    })
    expectComplementary(run)
  })

  it('an attack enters the receiving board exactly attackDelaySteps later', () => {
    let attackStep = -1
    let attackLines = 0
    let seenAt = -1
    const run = runMatch({
      rateA: 6,
      rateB: null, // no clears, no cancels: B passively receives
      onSlice: (r, _i, evA) => {
        if (attackStep < 0) {
          const atk = evA.find((ev) => ev.kind === 'attack')
          if (atk && atk.kind === 'attack') {
            attackStep = r.a.localStep - 1 // the step that just executed
            attackLines = atk.lines
          }
        } else if (seenAt < 0 && r.b.localEngine.pendingGarbage() > 0) {
          seenAt = r.b.localStep
          expect(r.b.localEngine.pendingGarbage()).toBe(attackLines)
          return true
        }
      },
    })
    expect(attackStep).toBeGreaterThan(0)
    expect(seenAt).toBe(attackStep + BASE_CFG.attackDelaySteps!)
    expect(run.a.status).toBe('playing') // stopped early, by the hook
  })

  it('a passive receiver eventually dies of pressure; both sides agree', () => {
    const run = runMatch({ rateA: 6, rateB: null })
    expect(run.a.status).toBe('won')
    expect(run.b.status).toBe('lost')
    expect(run.b.localDeadStep).not.toBeNull()
    expect(run.a.remoteDeadStep).toBe(run.b.localDeadStep)
    // the loser's board really was buried by entered garbage
    expect(run.b.localEngine.cheeseRows()).toBeGreaterThan(0)
  })

  it('identical idle players die on the same step: a draw on both ends', () => {
    const run = runMatch({ rateA: null, rateB: null })
    expect(run.a.status).toBe('draw')
    expect(run.b.status).toBe('draw')
    expect(run.a.localDeadStep).toBe(run.b.localDeadStep)
    expect(run.a.localDeadStep).not.toBeNull()
  })

  it('lockstep ratchet: local sim freezes at the horizon and resumes on data', () => {
    const net = new FakeNetwork()
    const a = new LockstepSession(net.ends[0], { ...BASE_CFG })
    const b = new LockstepSession(net.ends[1], { ...BASE_CFG })
    a.start()
    b.start()
    // b's client goes silent (never ticked): a runs to the horizon, freezes
    for (let i = 0; i < 200; i++) {
      a.tick(STEP_MS)
      net.tick(STEP_MS)
    }
    expect(a.stalled).toBe(true)
    expect(a.localStep).toBe(BASE_CFG.attackDelaySteps!)
    expect(a.status).toBe('playing') // a stall is not a desync or a loss
    // b comes back: a unfreezes and ratchets forward on b's stream
    for (let i = 0; i < 100; i++) {
      a.tick(STEP_MS)
      b.tick(STEP_MS)
      net.tick(STEP_MS)
    }
    expect(a.stalled).toBe(false)
    expect(a.localStep).toBeGreaterThan(BASE_CFG.attackDelaySteps! + 50)
    expect(a.status).toBe('playing')
    expect(b.status).toBe('playing')
  })

  it('input is frozen while stalled: applyAction during a stall records nothing', () => {
    const net = new FakeNetwork()
    const a = new LockstepSession(net.ends[0], { ...BASE_CFG })
    const b = new LockstepSession(net.ends[1], { ...BASE_CFG })
    a.start()
    b.start()
    // b never flushes (we never tick it), so a hits the horizon and stalls
    for (let i = 0; i < BASE_CFG.attackDelaySteps! + 50; i++) a.tick(STEP_MS)
    expect(a.stalled).toBe(true)
    expect(a.localStep).toBe(BASE_CFG.attackDelaySteps!)
    const before = a.localActions.length
    a.applyAction('left')
    a.applyAction('hardDrop')
    expect(a.localActions.length).toBe(before)
    expect(a.localEngine.piecesPlaced).toBe(0)
  })

  it('a corrupted simulation is caught by hash exchange and ends both sides', () => {
    let corrupted = false
    const run = runMatch({
      rateA: 6,
      rateB: 12,
      cfg: { hashEverySteps: 10 },
      maxSlices: 30_000,
      onSlice: (r, i) => {
        if (i === 300 && r.b.localEngine.status === 'playing') {
          r.b.localEngine.board[2 * BOARD_W + 4] = 8 // bit flip in B's world
          corrupted = true
        }
        return r.a.status === 'desynced' && r.b.status === 'desynced'
      },
    })
    expect(corrupted).toBe(true)
    // A's clean re-simulation of B disagrees with B's self-fingerprint;
    // the desync packet then ends B too
    expect(run.a.status).toBe('desynced')
    expect(run.b.status).toBe('desynced')
    expect(run.slices).toBeLessThan(300 + 200) // caught within ~2 hash periods
  })

  it('the winner keeps simulating the loser to its final board', () => {
    const run = runMatch({ rateA: 6, rateB: null })
    // a (winner) has fully caught up with b's stream: same executed frontier
    expect(run.a.remoteStep).toBe(run.b.localStep)
    expect(run.a.remoteEngine.stateHash()).toBe(run.b.localEngine.stateHash())
  })
})

describe('match replays (M6 design: both action streams + match config)', () => {
  it('round trip: playback reproduces both engines bit-exactly', () => {
    const run = runMatch({ rateA: 6, rateB: 12 })
    expectComplementary(run)
    const replay = matchReplayFrom(run.a)
    const sim = simulateMatchReplay(replay)
    expect(sim.status).toBe(run.a.status)
    expect(sim.local.stateHash()).toBe(run.a.localEngine.stateHash())
    expect(sim.remote.stateHash()).toBe(run.a.remoteEngine.stateHash())
    expect(sim.local.board).toEqual(run.a.localEngine.board)
    expect(sim.remote.board).toEqual(run.a.remoteEngine.board)
  })

  it('both players capture equivalent matches (mirrored views)', () => {
    const run = runMatch({ rateA: 6, rateB: 12 })
    const fromB = simulateMatchReplay(matchReplayFrom(run.b))
    expect(fromB.status).toBe(run.b.status)
    expect(fromB.local.stateHash()).toBe(run.b.localEngine.stateHash())
  })

  it('refuses a replay from another engine version', () => {
    const run = runMatch({ rateA: 6, rateB: 12, maxSlices: 1000 })
    const replay = matchReplayFrom(run.a)
    replay.version = 999
    expect(() => simulateMatchReplay(replay)).toThrow(/version/)
  })
})

describe('Engine.stateHash (the desync-detection primitive)', () => {
  it('identical histories hash identically; any extra action diverges', () => {
    const mk = () => {
      const e = new Engine({ seed: 5, mode: 'battle' })
      e.start()
      for (let i = 0; i < 300; i++) {
        if (i % 40 === 0) e.applyAction('hardDrop')
        if (i % 90 === 0) e.applyAction('left')
        e.tick(STEP_MS)
      }
      return e
    }
    const a = mk()
    const b = mk()
    expect(a.stateHash()).toBe(b.stateHash())
    b.applyAction('right')
    expect(a.stateHash()).not.toBe(b.stateHash())
  })

  it('sees hidden timer state, not just the visible board', () => {
    const a = new Engine({ seed: 5, mode: 'battle' })
    const b = new Engine({ seed: 5, mode: 'battle' })
    a.start()
    b.start()
    a.tick(STEP_MS) // same board/piece, different gravity accumulator
    expect(a.stateHash()).not.toBe(b.stateHash())
  })

  it('distinguishes how pending garbage is split into attacks', () => {
    const a = new Engine({ seed: 5, mode: 'battle' })
    const b = new Engine({ seed: 5, mode: 'battle' })
    a.start()
    b.start()
    a.queueGarbage(2)
    a.queueGarbage(1)
    b.queueGarbage(3)
    expect(a.pendingGarbage()).toBe(b.pendingGarbage())
    expect(a.stateHash()).not.toBe(b.stateHash()) // [2,1] enters ≠ [3] enters
  })

  it('a single flipped cell changes the hash', () => {
    const e = new Engine({ seed: 5, mode: 'battle' })
    e.start()
    const before = e.stateHash()
    e.board[7] = 8
    expect(e.stateHash()).not.toBe(before)
  })
})
