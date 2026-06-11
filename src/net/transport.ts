import { createRng } from '../engine/rng'
import type { Action } from '../engine/types'

/**
 * Net layer (spec Phase 4) — pure and headless. Online play goes through
 * `Transport`; the in-memory `FakeNetwork` (scriptable latency / jitter /
 * drop on injectable time) is the test harness, WebRTC DataChannel is the
 * swappable production edge.
 */

/**
 * One side's input-stream packet. The protocol is drop- and
 * reorder-tolerant by redundancy: every packet carries the whole unacked
 * window, so any single delivery heals all earlier losses.
 */
export interface InputPacket {
  t: 'input'
  /** sender's action stream is complete through this step */
  doneThrough: number
  /** first step this packet's window covers (= last ack received + 1) */
  windowStart: number
  /** acks the peer's stream: highest step the sender has received through */
  ack: number
  /** actions in [windowStart, doneThrough], in execution order */
  actions: Array<[step: number, action: Action]>
  /** unacked state fingerprints of the sender's engine: [step, hash] */
  hashes: Array<[step: number, hash: number]>
  /** the sender's engine is over; its stream is complete forever */
  over: boolean
}

/** a session detected divergent simulations; both sides must end */
export interface DesyncPacket {
  t: 'desync'
  step: number
}

export type NetMessage = InputPacket | DesyncPacket

export interface Transport {
  send(msg: NetMessage): void
  /** delivery callback; assign exactly one consumer */
  onMessage: ((msg: NetMessage) => void) | null
  close(): void
}

export interface NetConditions {
  /** base one-way delivery delay, ms */
  latencyMs: number
  /** extra uniform [0, jitterMs) per message — high jitter reorders */
  jitterMs: number
  /** probability [0, 1] a message is silently lost */
  dropRate: number
}

interface InFlight {
  at: number
  seq: number
  to: 0 | 1
  msg: NetMessage
}

/**
 * In-memory transport pair on injectable time: nothing is delivered until
 * `tick()` advances the network clock past a message's delivery moment.
 * Conditions are scriptable mid-flight (lag spikes, loss bursts) and all
 * randomness is seeded. Messages are JSON round-tripped on send so
 * anything non-serializable fails here, not on the real wire.
 */
export class FakeNetwork {
  readonly ends: [Transport, Transport]

  private now = 0
  private seq = 0
  private queue: InFlight[] = []
  private readonly conditions: NetConditions
  private readonly rng: () => number
  private readonly closed = [false, false]

  constructor(opts: Partial<NetConditions> & { seed?: number } = {}) {
    this.conditions = {
      latencyMs: opts.latencyMs ?? 0,
      jitterMs: opts.jitterMs ?? 0,
      dropRate: opts.dropRate ?? 0,
    }
    this.rng = createRng(opts.seed ?? 1)
    this.ends = [this.makeEnd(0), this.makeEnd(1)]
  }

  private makeEnd(side: 0 | 1): Transport {
    const to: 0 | 1 = side === 0 ? 1 : 0
    return {
      onMessage: null,
      send: (msg: NetMessage) => {
        if (this.closed[side]) return
        const wire = JSON.parse(JSON.stringify(msg)) as NetMessage
        if (this.rng() < this.conditions.dropRate) return
        const delay = this.conditions.latencyMs + this.rng() * this.conditions.jitterMs
        this.queue.push({ at: this.now + delay, seq: this.seq++, to, msg: wire })
      },
      close: () => {
        this.closed[side] = true
      },
    }
  }

  setConditions(patch: Partial<NetConditions>) {
    Object.assign(this.conditions, patch)
  }

  /** advance network time, delivering everything now due */
  tick(dtMs: number) {
    this.now += dtMs
    const due: InFlight[] = []
    const rest: InFlight[] = []
    for (const q of this.queue) (q.at <= this.now ? due : rest).push(q)
    if (due.length === 0) return
    this.queue = rest
    due.sort((a, b) => a.at - b.at || a.seq - b.seq)
    for (const q of due) {
      if (this.closed[q.to]) continue
      this.ends[q.to].onMessage?.(q.msg)
    }
  }

  /** messages currently in flight (test introspection) */
  inFlight(): number {
    return this.queue.length
  }
}
