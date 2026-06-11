import { Engine } from '../engine/engine'
import { REPLAY_VERSION, STEP_MS } from '../engine/replay'
import { DEFAULT_ENGINE_CONFIG } from '../engine/types'
import type { Action, EngineConfig, GameEvent } from '../engine/types'
import type { NetMessage, Transport } from './transport'

/**
 * Deterministic lockstep 1v1 (spec Phase 4).
 *
 * Each client simulates BOTH engines on the shared `STEP_MS` grid and only
 * actions cross the wire — the seeded engine guarantees both clients
 * compute identical worlds from the two action streams.
 *
 * The keystone is the attack-delay rule: an attack emitted by one board
 * during its step `s` enters the other board's pending meter at step
 * `s + attackDelaySteps`. That single rule makes the coupled two-engine
 * system a pure function of the action streams, and doubles as the
 * lockstep horizon: the local board may simulate ahead of the confirmed
 * remote stream by at most the delay, so the local player's inputs always
 * apply instantly (no input lag) while only the remote *view* lags by
 * network latency. If the peer's stream stalls past the horizon the local
 * game freezes (`stalled`) and resumes when data arrives; under sustained
 * latency above the horizon the match degrades to slow motion rather than
 * desyncing. No rollback is needed because the boards never interact
 * inside the horizon.
 *
 * Per-step execution order is canonical on both sides — (1) scheduled
 * garbage queues, (2) that step's actions apply in order, (3) the engine
 * ticks one step, (4) emitted attacks are scheduled — so re-simulation is
 * exact. Every `hashEverySteps` each side fingerprints its own engine
 * (`Engine.stateHash`) and the peer verifies it against its simulation:
 * any divergence ends the match as `desynced` on both ends.
 *
 * Trust model (invite-link play): lockstep means a modified client can
 * fabricate inputs — that is indistinguishable from skill — but it cannot
 * silently diverge the simulation; hashes catch that.
 */

export interface LockstepConfig {
  /** shared match seed — both players deal the same bags */
  seed: number
  /** engine overrides shared by both sides (attack table, lock delay…) */
  engine?: Partial<Omit<EngineConfig, 'seed' | 'mode' | 'sdf'>>
  /**
   * soft drop factor affects simulation, so it is per-player, exchanged at
   * handshake, and fixed for the whole match (no mid-match edits online)
   */
  localSdf?: number
  remoteSdf?: number
  /** steps between an attack leaving one board and entering the other */
  attackDelaySteps?: number
  /** how often (in steps) each side fingerprints its state for the peer */
  hashEverySteps?: number
  /** how often (ms of tick time) the outgoing packet flushes */
  flushEveryMs?: number
}

export type LockstepStatus = 'playing' | 'won' | 'lost' | 'draw' | 'desynced'

export type LockstepEvent =
  | { kind: 'end'; status: 'won' | 'lost' | 'draw' }
  | { kind: 'desync'; step: number }

export const DEFAULT_ATTACK_DELAY_STEPS = 100 // 500 ms at STEP_MS = 5
const DEFAULT_HASH_EVERY = 100
const DEFAULT_FLUSH_MS = 15
/** terminal packets keep flushing this many times so the peer can decide */
const FIN_FLUSHES = 8
/** cap on banked catch-up after a stall; surplus game time is dropped */
const MAX_BANKED_MS = 250

export class LockstepSession {
  readonly localEngine: Engine
  readonly remoteEngine: Engine
  readonly cfg: Required<Omit<LockstepConfig, 'engine'>> & {
    engine?: LockstepConfig['engine']
  }
  status: LockstepStatus = 'playing'
  /** local simulation is frozen waiting on the peer's stream (lag spike) */
  stalled = false

  /** complete local action log (steps non-decreasing) — the replay source */
  readonly localActions: Array<[step: number, action: Action]> = []
  /** complete remote action log, merged in step order — the replay source */
  readonly remoteLog: Array<[step: number, action: Action]> = []

  private readonly transport: Transport
  private readonly delay: number
  private readonly hashEvery: number

  /** local steps fully executed; also the stamp for incoming actions */
  private L = 0
  /** remote steps fully executed by our simulation of the peer */
  private M = 0
  /** pre-step garbage entry for step L has run; actions may apply */
  private entered = false
  private acc = 0
  private flushAcc = 0
  private finFlushes = FIN_FLUSHES

  private localDeadAt: number | null = null
  private remoteDeadAt: number | null = null

  /** localActions index of the first entry the peer has not acked */
  private sendFrom = 0
  private localHashes: Array<[number, number]> = []
  private peerAck = -1

  private inbox: NetMessage[] = []
  private remoteActions = new Map<number, Action[]>()
  /** peer's stream is complete through this step */
  private R = -1
  private peerOver = false
  private remoteHashes = new Map<number, number>()

  /** cross-board attacks scheduled by target step */
  private toLocal = new Map<number, number[]>()
  private toRemote = new Map<number, number[]>()

  private events: GameEvent[] = []
  private remoteEvents: GameEvent[] = []
  private sessionEvents: LockstepEvent[] = []

  constructor(transport: Transport, cfg: LockstepConfig) {
    this.transport = transport
    this.cfg = {
      seed: cfg.seed,
      engine: cfg.engine,
      localSdf: cfg.localSdf ?? DEFAULT_ENGINE_CONFIG.sdf,
      remoteSdf: cfg.remoteSdf ?? DEFAULT_ENGINE_CONFIG.sdf,
      attackDelaySteps: cfg.attackDelaySteps ?? DEFAULT_ATTACK_DELAY_STEPS,
      hashEverySteps: cfg.hashEverySteps ?? DEFAULT_HASH_EVERY,
      flushEveryMs: cfg.flushEveryMs ?? DEFAULT_FLUSH_MS,
    }
    this.delay = this.cfg.attackDelaySteps
    this.hashEvery = this.cfg.hashEverySteps
    const base = { seed: cfg.seed, mode: 'battle' as const, ...cfg.engine }
    this.localEngine = new Engine({ ...base, sdf: this.cfg.localSdf })
    this.remoteEngine = new Engine({ ...base, sdf: this.cfg.remoteSdf })
    transport.onMessage = (m) => this.inbox.push(m)
  }

  /** local steps executed so far (the local board's clock) */
  get localStep(): number {
    return this.L
  }

  /** remote steps simulated so far (how far the remote view has caught up) */
  get remoteStep(): number {
    return this.M
  }

  /** step the local board died at, if it has */
  get localDeadStep(): number | null {
    return this.localDeadAt
  }

  get remoteDeadStep(): number | null {
    return this.remoteDeadAt
  }

  start() {
    this.localEngine.start()
    this.remoteEngine.start()
    this.tryEnterLocal()
  }

  /**
   * Apply a local player action. Ignored while the simulation is stalled
   * (classic lockstep input freeze) or the match is decided. No-op wall
   * shoves are filtered from the log exactly like `GameController` does,
   * to keep packets lean under instant ARR.
   */
  applyAction(a: Action) {
    if (this.status !== 'playing' || !this.entered || this.localDeadAt !== null) return
    const e = this.localEngine
    if (a === 'left' || a === 'right') {
      const p = e.active
      const x = p?.x
      e.applyAction(a)
      if (e.active === p && p && p.x === x) return
    } else {
      e.applyAction(a)
    }
    this.localActions.push([this.L, a])
  }

  /**
   * Advance the session by `dtMs` of real time: drains the inbox, advances
   * the remote simulation as far as the received stream allows, runs local
   * fixed steps inside the lockstep horizon, and flushes the outgoing
   * packet on its own clock (flushing must not depend on step progress, or
   * two mutually stalled peers could deadlock).
   *
   * `onStep` fires before each local step ticks — the input layer's hook
   * for dispatching DAS/ARR-timed actions on the simulation grid.
   */
  tick(dtMs: number, onStep?: (step: number) => void) {
    this.processInbox()
    this.advanceRemote()
    if (this.status === 'playing') {
      this.acc = Math.min(this.acc + dtMs, MAX_BANKED_MS)
      let executed = 0
      while (this.acc >= STEP_MS && this.status === 'playing') {
        if (this.localDeadAt !== null) {
          this.acc = 0
          break
        }
        if (!this.tryEnterLocal()) {
          // stalled = zero progress despite budget; merely touching the
          // horizon with banked catch-up time is normal ratcheting
          if (executed === 0) this.stalled = true
          break
        }
        this.stalled = false
        executed++
        this.acc -= STEP_MS
        onStep?.(this.L)
        this.localEngine.tick(STEP_MS)
        this.afterLocalStep()
        this.L++
        this.entered = false
        if (this.L % this.hashEvery === 0) {
          this.localHashes.push([this.L, this.localEngine.stateHash()])
        }
        this.advanceRemote()
        this.maybeDecide()
        if (this.status === 'playing' && this.localDeadAt === null) this.tryEnterLocal()
      }
      this.maybeDecide()
    }
    this.flush(dtMs)
  }

  /** local engine's events since the last call (sfx/fx/metrics feed) */
  takeEvents(): GameEvent[] {
    const out = this.events
    this.events = []
    return out
  }

  /** simulated remote engine's events since the last call (duel view feed) */
  takeRemoteEvents(): GameEvent[] {
    const out = this.remoteEvents
    this.remoteEvents = []
    return out
  }

  takeSessionEvents(): LockstepEvent[] {
    const out = this.sessionEvents
    this.sessionEvents = []
    return out
  }

  // ── local stepping ─────────────────────────────────────────────

  /**
   * Enter step L: commit the garbage scheduled to arrive at L, after which
   * actions for L may apply. Gated on the remote simulation having reached
   * `L - delay` — every attack that can target a step ≤ L is then known.
   */
  private tryEnterLocal(): boolean {
    if (this.entered) return true
    if (this.M + this.delay <= this.L && this.remoteDeadAt === null) return false
    const due = this.toLocal.get(this.L)
    if (due) {
      for (const lines of due) this.localEngine.queueGarbage(lines)
      this.toLocal.delete(this.L)
    }
    this.entered = true
    return true
  }

  private afterLocalStep() {
    for (const ev of this.localEngine.takeEvents()) {
      this.events.push(ev)
      if (ev.kind === 'attack') {
        this.schedule(this.toRemote, this.L + this.delay, ev.lines)
      } else if (ev.kind === 'gameover') {
        this.localDeadAt = this.L
      }
    }
  }

  private schedule(book: Map<number, number[]>, target: number, lines: number) {
    const list = book.get(target)
    if (list) list.push(lines)
    else book.set(target, [lines])
  }

  // ── remote simulation ──────────────────────────────────────────

  /**
   * Re-simulate the peer as far as its confirmed stream allows. Mirrors
   * the local execution order exactly; gated on the local board having
   * reached `M - delay` so every cross attack into the remote board is
   * known before its target step enters.
   */
  private advanceRemote() {
    this.verifyRemoteHash()
    // keeps simulating after the match is decided — the remote view should
    // finish catching up (final board, full replay log); only desync halts
    while (this.status !== 'desynced' && this.remoteDeadAt === null) {
      if (!this.peerOver && this.M > this.R) break
      if (this.M >= this.L + this.delay && this.localDeadAt === null) break
      const due = this.toRemote.get(this.M)
      if (due) {
        for (const lines of due) this.remoteEngine.queueGarbage(lines)
        this.toRemote.delete(this.M)
      }
      const actions = this.remoteActions.get(this.M)
      if (actions) {
        for (const a of actions) this.remoteEngine.applyAction(a)
        this.remoteActions.delete(this.M)
      }
      this.remoteEngine.tick(STEP_MS)
      for (const ev of this.remoteEngine.takeEvents()) {
        this.remoteEvents.push(ev)
        if (ev.kind === 'attack') {
          this.schedule(this.toLocal, this.M + this.delay, ev.lines)
        } else if (ev.kind === 'gameover') {
          this.remoteDeadAt = this.M
        }
      }
      this.M++
      if (!this.verifyRemoteHash()) return
    }
    this.maybeDecide()
  }

  /** compare the peer's fingerprint at M (if any) against our simulation */
  private verifyRemoteHash(): boolean {
    const expect = this.remoteHashes.get(this.M)
    if (expect === undefined) return true
    this.remoteHashes.delete(this.M)
    if (this.remoteEngine.stateHash() === expect) return true
    this.declareDesync(this.M)
    return false
  }

  // ── outcome ────────────────────────────────────────────────────

  private maybeDecide() {
    if (this.status !== 'playing') return
    const l = this.localDeadAt
    const r = this.remoteDeadAt
    if (l !== null && r !== null) {
      this.end(l === r ? 'draw' : r < l ? 'won' : 'lost')
    } else if (l !== null && this.M > l) {
      this.end('lost') // the peer demonstrably survived past our death
    } else if (r !== null && l === null && this.L > r) {
      this.end('won') // we demonstrably survived past the peer's death
    }
  }

  private end(status: 'won' | 'lost' | 'draw') {
    this.status = status
    this.stalled = false
    this.sessionEvents.push({ kind: 'end', status })
  }

  private declareDesync(step: number) {
    if (this.status === 'desynced') return
    this.status = 'desynced'
    this.stalled = false
    this.sessionEvents.push({ kind: 'desync', step })
    this.transport.send({ t: 'desync', step })
  }

  // ── wire protocol ──────────────────────────────────────────────

  private processInbox() {
    for (const m of this.inbox) {
      if (m.t === 'desync') {
        if (this.status !== 'desynced') {
          this.status = 'desynced'
          this.stalled = false
          this.sessionEvents.push({ kind: 'desync', step: m.step })
        }
        continue
      }
      // defensive: a window starting past our frontier can't be merged
      // safely; redundancy means a later packet will cover the gap
      if (m.windowStart > this.R + 1) continue
      if (m.doneThrough > this.R) {
        for (const [s, a] of m.actions) {
          if (s <= this.R) continue
          const list = this.remoteActions.get(s)
          if (list) list.push(a)
          else this.remoteActions.set(s, [a])
          this.remoteLog.push([s, a])
        }
        this.R = m.doneThrough
      }
      if (m.over) this.peerOver = true
      for (const [s, h] of m.hashes) {
        if (s >= this.M) this.remoteHashes.set(s, h)
      }
      if (m.ack > this.peerAck) {
        this.peerAck = m.ack
        while (
          this.sendFrom < this.localActions.length &&
          this.localActions[this.sendFrom][0] <= this.peerAck
        ) {
          this.sendFrom++
        }
        while (this.localHashes.length > 0 && this.localHashes[0][0] <= this.peerAck) {
          this.localHashes.shift()
        }
      }
    }
    this.inbox.length = 0
  }

  private flush(dtMs: number) {
    this.flushAcc += dtMs
    if (this.flushAcc < this.cfg.flushEveryMs) return
    this.flushAcc = 0
    if (this.status !== 'playing') {
      if (this.finFlushes <= 0) return
      this.finFlushes--
    }
    const doneThrough = this.L - 1
    const actions: Array<[number, Action]> = []
    for (let i = this.sendFrom; i < this.localActions.length; i++) {
      if (this.localActions[i][0] <= doneThrough) actions.push(this.localActions[i])
    }
    this.transport.send({
      t: 'input',
      doneThrough,
      windowStart: this.peerAck + 1,
      ack: this.R,
      actions,
      hashes: [...this.localHashes],
      over: this.localDeadAt !== null,
    })
  }
}

// ── match replays ────────────────────────────────────────────────

/**
 * An online match replay is both action streams plus the match config —
 * the whole coupled simulation re-derives from them (this is the design
 * battle replays were waiting on; scripted battles only need the opponent
 * config, see `Replay.opponent`).
 */
export interface MatchReplay {
  version: number
  stepMs: number
  seed: number
  attackDelaySteps: number
  engine?: LockstepConfig['engine']
  /** [0] is the recording player's stream, [1] the opponent's */
  players: [MatchReplayPlayer, MatchReplayPlayer]
}

export interface MatchReplayPlayer {
  sdf: number
  actions: Array<[step: number, action: Action]>
  /** steps this player executed; the stream is complete through here */
  endStep: number
}

/** capture a (finished) session's match from the recording side's view */
export function matchReplayFrom(session: LockstepSession): MatchReplay {
  return {
    version: REPLAY_VERSION,
    stepMs: STEP_MS,
    seed: session.cfg.seed,
    attackDelaySteps: session.cfg.attackDelaySteps,
    engine: session.cfg.engine,
    players: [
      { sdf: session.cfg.localSdf, actions: [...session.localActions], endStep: session.localStep },
      { sdf: session.cfg.remoteSdf, actions: [...session.remoteLog], endStep: session.remoteStep },
    ],
  }
}

/**
 * Re-simulate a match replay on the pure synchronous core: both engines
 * step together on the shared grid, coupled only through the attack-delay
 * schedule. This is the determinism theorem the live session implements
 * asynchronously — each engine's state after `s` steps is a pure function
 * of the two action streams — so playback reproduces the live per-engine
 * states exactly, whatever the live network timing was.
 */
export function simulateMatchReplay(replay: MatchReplay): {
  local: Engine
  remote: Engine
  status: LockstepStatus
} {
  if (replay.version !== REPLAY_VERSION) {
    throw new Error(
      `match replay version ${replay.version} does not match engine version ${REPLAY_VERSION}`,
    )
  }
  const [p0, p1] = replay.players
  const mk = (sdf: number) =>
    new Engine({ seed: replay.seed, mode: 'battle', ...replay.engine, sdf })
  const local = mk(p0.sdf)
  const remote = mk(p1.sdf)
  local.start()
  remote.start()
  const toLocal = new Map<number, number[]>()
  const toRemote = new Map<number, number[]>()
  const ptr0 = { i: 0 }
  const ptr1 = { i: 0 }
  let localDead: number | null = null
  let remoteDead: number | null = null

  const step = (
    e: Engine,
    s: number,
    p: MatchReplayPlayer,
    ptr: { i: number },
    incoming: Map<number, number[]>,
    outgoing: Map<number, number[]>,
  ): boolean => {
    if (s >= p.endStep) return false
    const due = incoming.get(s)
    if (due) {
      for (const lines of due) e.queueGarbage(lines)
      incoming.delete(s)
    }
    while (ptr.i < p.actions.length && p.actions[ptr.i][0] === s) {
      e.applyAction(p.actions[ptr.i][1])
      ptr.i++
    }
    e.tick(replay.stepMs)
    let died = false
    for (const ev of e.takeEvents()) {
      if (ev.kind === 'attack') {
        const target = s + replay.attackDelaySteps
        const list = outgoing.get(target)
        if (list) list.push(ev.lines)
        else outgoing.set(target, [ev.lines])
      } else if (ev.kind === 'gameover') {
        died = true
      }
    }
    return died
  }

  const end = Math.max(p0.endStep, p1.endStep)
  for (let s = 0; s < end; s++) {
    if (step(local, s, p0, ptr0, toLocal, toRemote)) localDead = s
    if (step(remote, s, p1, ptr1, toRemote, toLocal)) remoteDead = s
  }

  let status: LockstepStatus
  if (localDead !== null && remoteDead !== null) {
    status = localDead === remoteDead ? 'draw' : remoteDead < localDead ? 'won' : 'lost'
  } else if (localDead !== null) {
    status = p1.endStep > localDead ? 'lost' : 'playing'
  } else if (remoteDead !== null) {
    status = p0.endStep > remoteDead ? 'won' : 'playing'
  } else {
    status = 'playing'
  }
  return { local, remote, status }
}
