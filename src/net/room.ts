import { DEFAULT_ENGINE_CONFIG } from '../engine/types'
import { LockstepSession } from './lockstep'
import type { LockstepConfig } from './lockstep'
import { NET_PROTOCOL_VERSION } from './transport'
import type { ControlMessage, NetMessage, Transport } from './transport'

/**
 * Room flow (spec Phase 4): everything between "the DataChannel opened"
 * and "lockstep packets are flowing" — identity/handling exchange, match
 * start with a synchronized countdown, the rematch loop, and leaving.
 * Control messages share the ordered channel with game packets; the
 * lockstep session ignores them, and match-id tags keep one match's tail
 * from leaking into the next.
 *
 * The transport is already connected when a RoomSession is built (the
 * invite-link / signaling dance lives one layer down), so this runs
 * headlessly over `FakeNetwork` exactly as it runs over WebRTC.
 */

export type RoomState =
  /** connected; waiting for the peer's `ready` */
  | 'lobby'
  /** `go` received/sent; both sides counting down on the same clock */
  | 'countdown'
  | 'playing'
  /** the match is decided; rematch is on the table */
  | 'ended'
  /** the room is finished: someone left, died, or versions clashed */
  | 'closed'

export interface RoomConfig {
  role: 'host' | 'guest'
  name: string
  /** local soft-drop factor — rides in `ready` so the peer simulates it */
  sdf?: number
  attackDelaySteps?: number
  hashEverySteps?: number
  countdownMs?: number
  /** host only: seed source for each match; injectable for tests */
  makeSeed?: () => number
  /** shared engine overrides (host's ruleset wins; keep defaults online) */
  engine?: LockstepConfig['engine']
}

const DEFAULT_COUNTDOWN_MS = 1400

export class RoomSession {
  state: RoomState = 'lobby'
  peerName: string | null = null
  /** the peer vanished (channel died) rather than leaving via `bye` */
  peerDisconnected = false
  /** the peer left deliberately */
  peerLeft = false
  /** protocol version clash: incompatible clients */
  versionClash = false
  session: LockstepSession | null = null
  countdownLeft = 0
  /** matches started in this room (also the current match id) */
  matchIndex = -1

  /** true once we've asked for a rematch of the next match */
  rematchRequested = false
  /** true once the peer asked */
  rematchOffered = false

  private readonly transport: Transport
  private readonly cfg: RoomConfig
  private readonly localSdf: number
  private peerSdf: number | null = null
  private peerReady = false
  /** game packets that arrive before their session exists (reorder edge) */
  private pendingGame: NetMessage[] = []
  /** a `go` that outran the peer's `ready` on an unordered transport */
  private pendingGo: { m: number; seed: number; countdownMs: number } | null = null
  /** facade handed to each LockstepSession; sends go to the real wire */
  private readonly gameEndpoint: Transport

  constructor(transport: Transport, cfg: RoomConfig) {
    this.transport = transport
    this.cfg = cfg
    this.localSdf = cfg.sdf ?? DEFAULT_ENGINE_CONFIG.sdf
    this.gameEndpoint = {
      onMessage: null,
      send: (m) => this.transport.send(m),
      close: () => {},
    }
    transport.onMessage = (m) => this.route(m)
    transport.onClose = () => {
      this.peerDisconnected = true
      this.toClosed()
    }
    this.transport.send({
      t: 'ready',
      v: NET_PROTOCOL_VERSION,
      name: cfg.name,
      sdf: this.localSdf,
    })
  }

  /** drive everything: countdown, the live match, post-match catch-up */
  tick(dtMs: number, onStep?: (step: number) => void) {
    if (this.state === 'countdown') {
      this.countdownLeft -= dtMs
      if (this.countdownLeft <= 0) {
        this.countdownLeft = 0
        this.state = 'playing'
      }
      return
    }
    if (this.state === 'playing' && this.session) {
      this.session.tick(dtMs, onStep)
      if (this.session.status !== 'playing') this.state = 'ended'
      return
    }
    if (this.state === 'ended') {
      // keep ticking: final re-flushes + the remote board catching up
      this.session?.tick(dtMs)
    }
  }

  /** ask to play again; the host fires `go` once both sides have asked */
  requestRematch() {
    if (this.state !== 'ended' || this.rematchRequested) return
    if (this.session?.status === 'desynced' || this.peerDisconnected || this.peerLeft) return
    this.rematchRequested = true
    this.transport.send({ t: 'rematch', m: this.matchIndex + 1 })
    this.maybeGo()
  }

  /** leave the room deliberately */
  close() {
    if (this.state === 'closed') return
    this.transport.send({ t: 'bye' })
    this.toClosed()
    this.transport.close()
  }

  // ── internals ──────────────────────────────────────────────────

  private route(m: NetMessage) {
    if (m.t === 'input' || m.t === 'desync') {
      if (this.gameEndpoint.onMessage) this.gameEndpoint.onMessage(m)
      else this.pendingGame.push(m)
      return
    }
    const ctrl = m as ControlMessage
    switch (ctrl.t) {
      case 'ready':
        if (ctrl.v !== NET_PROTOCOL_VERSION) {
          this.versionClash = true
          this.toClosed()
          return
        }
        this.peerName = ctrl.name
        this.peerSdf = ctrl.sdf
        this.peerReady = true
        if (this.pendingGo) {
          const go = this.pendingGo
          this.pendingGo = null
          this.startMatch(go.m, go.seed, go.countdownMs)
        } else {
          this.maybeGo()
        }
        break
      case 'go':
        if (this.cfg.role === 'guest') {
          if (this.peerSdf === null) {
            this.pendingGo = { m: ctrl.m, seed: ctrl.seed, countdownMs: ctrl.countdownMs }
          } else {
            this.startMatch(ctrl.m, ctrl.seed, ctrl.countdownMs)
          }
        }
        break
      case 'rematch':
        if (ctrl.m === this.matchIndex + 1) {
          this.rematchOffered = true
          this.maybeGo()
        }
        break
      case 'bye':
        this.peerLeft = true
        this.toClosed()
        break
    }
  }

  /** host: start whenever both sides have signalled intent */
  private maybeGo() {
    if (this.cfg.role !== 'host' || !this.peerReady || this.state === 'closed') return
    const firstMatch = this.matchIndex === -1 && this.state === 'lobby'
    const rematch = this.state === 'ended' && this.rematchRequested && this.rematchOffered
    if (!firstMatch && !rematch) return
    const seed = (this.cfg.makeSeed ?? (() => (Math.random() * 0xffffffff) >>> 0))()
    const countdownMs = this.cfg.countdownMs ?? DEFAULT_COUNTDOWN_MS
    const matchId = this.matchIndex + 1
    this.transport.send({ t: 'go', m: matchId, seed, countdownMs })
    this.startMatch(matchId, seed, countdownMs)
  }

  private startMatch(matchId: number, seed: number, countdownMs: number) {
    if (this.state === 'closed' || matchId !== this.matchIndex + 1 || this.peerSdf === null) return
    this.matchIndex = matchId
    this.rematchRequested = false
    this.rematchOffered = false
    this.session = new LockstepSession(this.gameEndpoint, {
      seed,
      matchId,
      engine: this.cfg.engine,
      localSdf: this.localSdf,
      remoteSdf: this.peerSdf,
      attackDelaySteps: this.cfg.attackDelaySteps,
      hashEverySteps: this.cfg.hashEverySteps,
    })
    this.session.start()
    // anything that raced ahead of `go` belongs to the new session
    for (const m of this.pendingGame.splice(0)) this.gameEndpoint.onMessage?.(m)
    this.state = 'countdown'
    this.countdownLeft = countdownMs
  }

  private toClosed() {
    if (this.state === 'closed') return
    this.state = 'closed'
  }
}
