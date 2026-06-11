import { describe, expect, it } from 'vitest'
import { STEP_MS } from '../engine/replay'
import { OnlineConnector } from './online'
import type { OnlineDeps } from './online'
import { MemorySignalStore, handleSignal } from './signaling'
import type { SignalDeps } from './signaling'
import { fakePcPair, settleMicrotasks as settle } from './testFakes'

/**
 * The full online flow, both ends, no browser: create → share code →
 * join → signaling-relayed WebRTC handshake → RoomSession ready/go →
 * countdown → lockstep ticking. This is the exact orchestration the UI
 * drives — the UI layer adds only pixels.
 */

function rig() {
  const signalDeps: SignalDeps = {
    store: new MemorySignalStore(() => 0),
    newRoomId: () => 'abcdef',
    now: () => 0,
  }
  const { host: hostPc, guest: guestPc, world } = fakePcPair()
  const mkDeps = (pc: typeof hostPc): OnlineDeps => ({
    transport: (req) => handleSignal(req, signalDeps),
    makePc: () => pc,
    pollEveryMs: 100,
  })
  const a = new OnlineConnector(mkDeps(hostPc))
  const b = new OnlineConnector(mkDeps(guestPc))
  const thirdWheel = () =>
    new OnlineConnector({
      transport: (req) => handleSignal(req, signalDeps),
      makePc: () => fakePcPair().guest,
      pollEveryMs: 100,
    })
  const tickBoth = async (times: number, dt = 100) => {
    for (let i = 0; i < times; i++) {
      a.tick(dt)
      b.tick(dt)
      await settle()
    }
  }
  return { a, b, world, tickBoth, thirdWheel }
}

describe('OnlineConnector', () => {
  it('host → invite code → join → handshake → both rooms live and playing', async () => {
    const { a, b, tickBoth } = rig()
    a.host({ name: 'Hopper', countdownMs: 200, makeSeed: () => 777 })
    await settle()
    expect(a.phase).toMatchObject({ t: 'waiting', room: 'abcdef' })

    b.join('abcdef', { name: 'Curie' })
    await settle()
    expect(b.phase).toMatchObject({ t: 'connecting', hostName: 'Hopper' })

    // signaling polls relay the offer/answer/ICE until the channel opens
    await tickBoth(8)
    expect(a.phase.t).toBe('room')
    expect(b.phase.t).toBe('room')
    if (a.phase.t !== 'room' || b.phase.t !== 'room') return

    // ready/go rode the DataChannel; both reached the same match
    // (countdown precision is room.test.ts territory)
    await tickBoth(4, 20)
    expect(a.phase.session.peerName).toBe('Curie')
    expect(b.phase.session.peerName).toBe('Hopper')
    expect(a.phase.session.session!.cfg.seed).toBe(777)
    expect(b.phase.session.session!.cfg.seed).toBe(777)

    // through the countdown into lockstep ticking
    await tickBoth(10, 50)
    for (let i = 0; i < 10; i++) {
      a.tick(STEP_MS)
      b.tick(STEP_MS)
      await settle(4)
    }
    expect(a.phase.session.state).toBe('playing')
    expect(b.phase.session.state).toBe('playing')
    expect(a.phase.session.session!.localStep).toBeGreaterThan(0)
    expect(a.phase.session.session!.remoteStep).toBeGreaterThan(0)
  })

  it('joining a missing room surfaces a friendly error', async () => {
    const { b } = rig()
    b.join('zzzzzz', { name: 'Curie' })
    await settle()
    expect(b.phase).toMatchObject({ t: 'error' })
    expect((b.phase as { message: string }).message).toMatch(/does not exist/)
  })

  it('a second guest is told the room is full', async () => {
    const { a, b, tickBoth, thirdWheel } = rig()
    a.host({ name: 'Hopper' })
    await settle()
    b.join('abcdef', { name: 'Curie' })
    await tickBoth(8)
    const late = thirdWheel()
    late.join('abcdef', { name: 'Lovelace' })
    await settle()
    expect(late.phase).toMatchObject({ t: 'error' })
    expect((late.phase as { message: string }).message).toMatch(/full/)
  })

  it('cancel backs out of hosting and releases the handshake', async () => {
    const { a } = rig()
    a.host({ name: 'Hopper' })
    await settle()
    expect(a.phase.t).toBe('waiting')
    a.cancel()
    await settle()
    expect(a.phase.t).toBe('idle')
  })
})
