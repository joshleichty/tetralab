import { describe, expect, it } from 'vitest'
import { connectPeer } from './webrtc'
import type {
  DataChannelLike,
  HandshakeSignal,
  IceCandidateLike,
  PeerConnectionLike,
  SessionDescriptionLike,
} from './webrtc'
import type { InputPacket } from './transport'

/**
 * WebRTC handshake glue, headless: fake peer connections that enforce the
 * real API's ordering rules (ICE before a remote description throws, like
 * the browser's InvalidStateError) so the buffering logic is genuinely
 * exercised — not just happy-pathed.
 */

class FakeDataChannel implements DataChannelLike {
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

interface FakeWorld {
  hostChannel: FakeDataChannel | null
  pcs: FakePeerConnection[]
  iceAdds: number
  connected: boolean
  maybeConnect?: () => void
}

class FakePeerConnection implements PeerConnectionLike {
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

function fakePcPair(): { host: FakePeerConnection; guest: FakePeerConnection; world: FakeWorld } {
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

/** immediate loopback signal pair (microtask delivery) */
function signalPair(): [HandshakeSignal, HandshakeSignal] {
  const a: HandshakeSignal = { send: (m) => queueMicrotask(() => b.onMessage?.(m)), onMessage: null }
  const b: HandshakeSignal = { send: (m) => queueMicrotask(() => a.onMessage?.(m)), onMessage: null }
  return [a, b]
}

const settle = async (turns = 20) => {
  for (let i = 0; i < turns; i++) await Promise.resolve()
}

const ping = (n: number): InputPacket => ({
  t: 'input',
  doneThrough: n,
  windowStart: 0,
  ack: -1,
  actions: [],
  hashes: [],
  over: false,
})

describe('connectPeer', () => {
  it('host and guest connect; the Transport round-trips NetMessages', async () => {
    const { host, guest, world } = fakePcPair()
    const [hostSignal, guestSignal] = signalPair()
    const [ht, gt] = await Promise.all([
      connectPeer({ role: 'host', signal: hostSignal, pc: host }),
      connectPeer({ role: 'guest', signal: guestSignal, pc: guest }),
    ])
    expect(world.iceAdds).toBeGreaterThan(0) // candidates actually flowed

    const atHost: unknown[] = []
    const atGuest: unknown[] = []
    ht.onMessage = (m) => atHost.push(m)
    gt.onMessage = (m) => atGuest.push(m)
    ht.send(ping(1))
    gt.send(ping(2))
    await settle()
    expect(atGuest).toEqual([ping(1)])
    expect(atHost).toEqual([ping(2)])
  })

  it('buffers ICE that arrives before the remote description', async () => {
    const { host, guest, world } = fakePcPair()
    // manual delivery: collect host→guest traffic, deliver ICE first
    const toGuest: unknown[] = []
    const hostSignal: HandshakeSignal = { send: (m) => toGuest.push(m), onMessage: null }
    const guestSignal: HandshakeSignal = {
      send: (m) => queueMicrotask(() => hostSignal.onMessage?.(m)),
      onMessage: null,
    }
    const hostP = connectPeer({ role: 'host', signal: hostSignal, pc: host })
    const guestP = connectPeer({ role: 'guest', signal: guestSignal, pc: guest })
    await settle()
    // host has emitted offer + 2 candidates; replay them ICE-first
    expect(toGuest.length).toBeGreaterThanOrEqual(3)
    const offers = toGuest.filter((m) => (m as { t: string }).t === 'offer')
    const ice = toGuest.filter((m) => (m as { t: string }).t === 'ice')
    expect(offers).toHaveLength(1)
    for (const m of ice) guestSignal.onMessage?.(m)
    for (const m of offers) guestSignal.onMessage?.(m)
    const [ht, gt] = await Promise.all([hostP, guestP])
    expect(world.iceAdds).toBeGreaterThanOrEqual(2) // buffered ones were applied
    ht.close()
    gt.close()
  })

  it('a channel that dies mid-handshake rejects instead of hanging', async () => {
    const { host, world } = fakePcPair()
    const [hostSignal] = signalPair()
    const p = connectPeer({ role: 'host', signal: hostSignal, pc: host })
    await settle()
    const expectation = expect(p).rejects.toThrow(/closed during handshake/)
    // no guest ever arrives; the pending channel dies (tab closed, etc.)
    world.hostChannel!.close()
    await expectation
    expect(host.closed).toBe(true)
  })

  it('connection death after open surfaces through Transport.onClose', async () => {
    const { host, guest } = fakePcPair()
    const [hostSignal, guestSignal] = signalPair()
    const [ht, gt] = await Promise.all([
      connectPeer({ role: 'host', signal: hostSignal, pc: host }),
      connectPeer({ role: 'guest', signal: guestSignal, pc: guest }),
    ])
    let hostClosed = 0
    let guestClosed = 0
    ht.onClose = () => hostClosed++
    gt.onClose = () => guestClosed++
    gt.close() // guest leaves: its channel close propagates to the host
    await settle()
    expect(hostClosed).toBe(1)
    expect(guestClosed).toBe(0) // deliberate local close is not a death event
  })
})
