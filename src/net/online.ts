import { RoomSession } from './room'
import type { RoomConfig } from './room'
import { PollingSignalChannel, SignalApi, SignalError } from './signalClient'
import type { SignalTransport } from './signalClient'
import { connectPeer } from './webrtc'
import type { PeerConnectionLike } from './webrtc'

/**
 * The whole client-side online flow, one object: create/join a room over
 * signaling, run the WebRTC handshake, hand the open transport to a
 * `RoomSession`. Pure orchestration with injected seams (signal transport,
 * peer-connection factory), so the entire flow — both ends — runs
 * headlessly in vitest; the UI drives exactly what the tests drive.
 *
 * Lifecycle: `host()` or `join()` → phase walks through
 * `creating/joining → waiting/connecting → room` (or `error`). The caller
 * ticks the connector every frame; once `room` is reached the signaling
 * channel is closed (its job is done) and ticking forwards to the
 * `RoomSession`.
 */

export type OnlinePhase =
  | { t: 'idle' }
  /** host: allocating the room id */
  | { t: 'creating' }
  /** host: room is live — share the link; handshake runs when the guest arrives */
  | { t: 'waiting'; room: string }
  /** guest: claiming the room's guest slot */
  | { t: 'joining'; room: string }
  /** guest: slot claimed, WebRTC handshake in flight */
  | { t: 'connecting'; room: string; hostName: string }
  /** connected: the RoomSession is live (ready/go/match/rematch) */
  | { t: 'room'; room: string; session: RoomSession }
  | { t: 'error'; message: string }

export interface OnlineDeps {
  transport: SignalTransport
  makePc: () => PeerConnectionLike
  pollEveryMs?: number
}

/** room config minus what the connector owns (role comes from host/join) */
export type OnlineRoomConfig = Omit<RoomConfig, 'role'>

export class OnlineConnector {
  phase: OnlinePhase = { t: 'idle' }

  private readonly api: SignalApi
  private readonly deps: OnlineDeps
  private channel: PollingSignalChannel | null = null
  private pc: PeerConnectionLike | null = null
  private cancelled = false

  constructor(deps: OnlineDeps) {
    this.deps = deps
    this.api = new SignalApi(deps.transport)
  }

  /** create a room and wait for a guest; the invite code is `phase.room` */
  host(cfg: OnlineRoomConfig) {
    if (this.phase.t !== 'idle') return
    this.phase = { t: 'creating' }
    void this.run(async () => {
      const { room } = await this.api.create(cfg.name)
      if (this.cancelled) return
      this.phase = { t: 'waiting', room }
      await this.connect(room, 'host', cfg)
    })
  }

  /** join somebody's room by invite code */
  join(room: string, cfg: OnlineRoomConfig) {
    if (this.phase.t !== 'idle') return
    this.phase = { t: 'joining', room }
    void this.run(async () => {
      const { hostName } = await this.api.join(room, cfg.name)
      if (this.cancelled) return
      this.phase = { t: 'connecting', room, hostName }
      await this.connect(room, 'guest', cfg)
    })
  }

  /**
   * Drive the flow: signaling polls while handshaking, the room session
   * once connected. `onStep` reaches the live lockstep session.
   */
  tick(dtMs: number, onStep?: (step: number) => void) {
    this.channel?.tick(dtMs)
    if (this.phase.t === 'room') this.phase.session.tick(dtMs, onStep)
  }

  /** back out of whatever is in flight (or leave the room) */
  cancel() {
    this.cancelled = true
    if (this.phase.t === 'room') this.phase.session.close()
    this.channel?.close()
    this.channel = null
    this.pc?.close()
    this.pc = null
    this.phase = { t: 'idle' }
  }

  // ── internals ──────────────────────────────────────────────────

  private async connect(room: string, role: 'host' | 'guest', cfg: OnlineRoomConfig) {
    const channel = new PollingSignalChannel(this.api, {
      room,
      box: role,
      pollEveryMs: this.deps.pollEveryMs,
    })
    this.channel = channel
    channel.onError = (err) => {
      if (!this.cancelled) this.phase = { t: 'error', message: friendly(err) }
    }
    const pc = this.deps.makePc()
    this.pc = pc
    const transport = await connectPeer({ role, signal: channel, pc })
    if (this.cancelled) {
      transport.close()
      return
    }
    // handshake done: signaling has served its purpose
    channel.close()
    this.channel = null
    const session = new RoomSession(transport, { role, ...cfg })
    this.phase = { t: 'room', room, session }
  }

  private async run(fn: () => Promise<void>) {
    try {
      await fn()
    } catch (err) {
      if (this.cancelled) return
      this.phase = { t: 'error', message: friendly(err) }
      this.channel?.close()
      this.channel = null
      this.pc?.close()
      this.pc = null
    }
  }
}

function friendly(err: unknown): string {
  if (err instanceof SignalError) {
    if (err.status === 404) return 'That room does not exist (or has expired).'
    if (err.status === 409) return 'That room is already full.'
  }
  return err instanceof Error ? err.message : 'Connection failed.'
}
