import type {
  DataChannelLike,
  IceCandidateLike,
  PeerConnectionLike,
  SessionDescriptionLike,
} from './webrtc'

/**
 * Test fakes for the WebRTC seam — imported only by vitest suites
 * (webrtc.test.ts, online.test.ts), never by production code. The fakes
 * enforce the real API's ordering rules (ICE before a remote description
 * throws) so handshake logic can't pass by accident.
 */

export class FakeDataChannel implements DataChannelLike {
  readyState = 'connecting'
  onopen: (() => void) | null = null
  onmessage: ((ev: { data: unknown }) => void) | null = null
  onclose: (() => void) | null = null
  peer: FakeDataChannel | null = null

  send(data: string) {
    if (this.readyState !== 'open') throw new Error('send on non-open channel')
    const peer = this.peer
    if (peer?.readyState === 'open') queueMicrotask(() => peer.onmessage?.({ data }))
  }

  open() {
    this.readyState = 'open'
    this.onopen?.()
  }

  close() {
    if (this.readyState === 'closed') return
    this.readyState = 'closed'
    this.onclose?.()
    this.peer?.close()
  }
}

export interface FakeWorld {
  hostChannel: FakeDataChannel | null
  pcs: FakePeerConnection[]
  iceAdds: number
  connected: boolean
  maybeConnect?: () => void
}

export class FakePeerConnection implements PeerConnectionLike {
  onicecandidate: ((ev: { candidate: IceCandidateLike | null }) => void) | null = null
  ondatachannel: ((ev: { channel: DataChannelLike }) => void) | null = null
  local: SessionDescriptionLike | null = null
  remote: SessionDescriptionLike | null = null
  closed = false

  private readonly world: FakeWorld
  private readonly side: string

  constructor(world: FakeWorld, side: string) {
    this.world = world
    this.side = side
    world.pcs.push(this)
  }

  createDataChannel(): DataChannelLike {
    const ch = new FakeDataChannel()
    this.world.hostChannel = ch
    return ch
  }

  async createOffer(): Promise<SessionDescriptionLike> {
    return { type: 'offer', sdp: `sdp-offer-${this.side}` }
  }

  async createAnswer(): Promise<SessionDescriptionLike> {
    if (!this.remote) throw new Error('createAnswer before remote description')
    return { type: 'answer', sdp: `sdp-answer-${this.side}` }
  }

  async setLocalDescription(desc: SessionDescriptionLike): Promise<void> {
    this.local = desc
    // trickle two candidates after the local description, like the real API
    for (let i = 0; i < 2; i++) {
      queueMicrotask(() =>
        this.onicecandidate?.({ candidate: { candidate: `cand-${this.side}-${i}` } }),
      )
    }
    queueMicrotask(() => this.world.maybeConnect?.())
  }

  async setRemoteDescription(desc: SessionDescriptionLike): Promise<void> {
    this.remote = desc
    queueMicrotask(() => this.world.maybeConnect?.())
  }

  async addIceCandidate(candidate: IceCandidateLike): Promise<void> {
    if (!this.remote) throw new Error('InvalidStateError: ICE before remote description')
    void candidate
    this.world.iceAdds++
  }

  close() {
    this.closed = true
  }
}

/** a linked host/guest pair: the channel opens once both sides have both
 *  descriptions, mirroring a successful real handshake */
export function fakePcPair(): {
  host: FakePeerConnection
  guest: FakePeerConnection
  world: FakeWorld
} {
  const world: FakeWorld = { hostChannel: null, pcs: [], iceAdds: 0, connected: false }
  const host = new FakePeerConnection(world, 'host')
  const guest = new FakePeerConnection(world, 'guest')
  world.maybeConnect = () => {
    if (world.connected || !world.hostChannel) return
    if (!host.local || !host.remote || !guest.local || !guest.remote) return
    world.connected = true
    const guestCh = new FakeDataChannel()
    guestCh.peer = world.hostChannel
    world.hostChannel.peer = guestCh
    guest.ondatachannel?.({ channel: guestCh })
    queueMicrotask(() => {
      guestCh.open()
      world.hostChannel!.open()
    })
  }
  return { host, guest, world }
}

/** drain a few microtask turns so promise chains settle deterministically */
export async function settleMicrotasks(turns = 20): Promise<void> {
  for (let i = 0; i < turns; i++) await Promise.resolve()
}
