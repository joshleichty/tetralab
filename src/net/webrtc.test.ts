import { describe, expect, it } from 'vitest'
import { connectPeer } from './webrtc'
import type { HandshakeSignal } from './webrtc'
import type { InputPacket } from './transport'
import { fakePcPair, settleMicrotasks as settle } from './testFakes'

/**
 * WebRTC handshake glue, headless: fake peer connections (testFakes.ts)
 * that enforce the real API's ordering rules (ICE before a remote
 * description throws, like the browser's InvalidStateError) so the
 * buffering logic is genuinely exercised — not just happy-pathed.
 */

/** immediate loopback signal pair (microtask delivery) */
function signalPair(): [HandshakeSignal, HandshakeSignal] {
  const a: HandshakeSignal = { send: (m) => queueMicrotask(() => b.onMessage?.(m)), onMessage: null }
  const b: HandshakeSignal = { send: (m) => queueMicrotask(() => a.onMessage?.(m)), onMessage: null }
  return [a, b]
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
