import { describe, expect, it } from 'vitest'
import { STEP_MS } from '../engine/replay'
import { RoomSession } from './room'
import type { RoomConfig } from './room'
import { FakeNetwork } from './transport'

/**
 * Room flow (spec Phase 4): ready/go handshake, synchronized countdown,
 * full matches, the rematch loop, and leaving — two RoomSessions over the
 * in-memory transport, no WebRTC anywhere.
 */

const COUNTDOWN = 100 // ms; 20 slices

function rig(opts: { hostCfg?: Partial<RoomConfig>; guestCfg?: Partial<RoomConfig> } = {}) {
  const net = new FakeNetwork({ seed: 9 })
  let nextSeed = 1000
  const host = new RoomSession(net.ends[0], {
    role: 'host',
    name: 'Hopper',
    countdownMs: COUNTDOWN,
    makeSeed: () => nextSeed++,
    attackDelaySteps: 80,
    hashEverySteps: 50,
    ...opts.hostCfg,
  })
  const guest = new RoomSession(net.ends[1], {
    role: 'guest',
    name: 'Curie',
    ...opts.guestCfg,
  })
  const run = (slices: number, hostStep?: (s: number) => void, guestStep?: (s: number) => void) => {
    for (let i = 0; i < slices; i++) {
      host.tick(STEP_MS, hostStep)
      guest.tick(STEP_MS, guestStep)
      net.tick(STEP_MS)
      host.session?.takeEvents()
      host.session?.takeRemoteEvents()
      guest.session?.takeEvents()
      guest.session?.takeRemoteEvents()
    }
  }
  return { net, host, guest, run }
}

/** finish the current match fast: the guest suicides into a hard-drop
 *  tower while the host idles and outlives it — host wins, every time */
function playOut(r: ReturnType<typeof rig>, maxSlices = 30_000) {
  const guestStep = (step: number) => {
    if (step % 20 === 0) r.guest.session?.applyAction('hardDrop')
  }
  for (let i = 0; i < maxSlices; i++) {
    r.host.tick(STEP_MS)
    r.guest.tick(STEP_MS, guestStep)
    r.net.tick(STEP_MS)
    r.host.session?.takeEvents()
    r.host.session?.takeRemoteEvents()
    r.guest.session?.takeEvents()
    r.guest.session?.takeRemoteEvents()
    if (r.host.state === 'ended' && r.guest.state === 'ended') return
  }
  throw new Error('match did not finish')
}

describe('RoomSession', () => {
  it('exchanges ready, auto-starts, and runs a synchronized countdown', () => {
    const r = rig({ hostCfg: { sdf: 25 }, guestCfg: { sdf: 30 } })
    r.run(3)
    expect(r.host.peerName).toBe('Curie')
    expect(r.guest.peerName).toBe('Hopper')
    expect(r.host.state).toBe('countdown')
    expect(r.guest.state).toBe('countdown')
    // identical match wiring on both ends, mirrored per-player handling
    expect(r.host.session!.cfg.seed).toBe(1000)
    expect(r.guest.session!.cfg.seed).toBe(1000)
    expect(r.host.session!.cfg.localSdf).toBe(25)
    expect(r.host.session!.cfg.remoteSdf).toBe(30)
    expect(r.guest.session!.cfg.localSdf).toBe(30)
    expect(r.guest.session!.cfg.remoteSdf).toBe(25)
    r.run(COUNTDOWN / STEP_MS + 2)
    expect(r.host.state).toBe('playing')
    expect(r.guest.state).toBe('playing')
    expect(r.host.session!.localStep).toBeGreaterThan(0)
  })

  it('plays a match to a decision on both ends', () => {
    const r = rig()
    r.run(COUNTDOWN / STEP_MS + 5)
    playOut(r)
    expect(r.host.session!.status).toBe('won') // guest's suicide tower
    expect(r.guest.session!.status).toBe('lost')
    expect(r.host.matchIndex).toBe(0)
  })

  it('rematch: both ask, a fresh seed and match id, stale tails ignored', () => {
    const r = rig()
    r.run(COUNTDOWN / STEP_MS + 5)
    playOut(r)
    const firstSeed = r.host.session!.cfg.seed

    r.guest.requestRematch()
    r.run(2)
    expect(r.host.rematchOffered).toBe(true) // surfaced for the host's UI
    expect(r.host.state).toBe('ended') // host hasn't agreed yet
    r.host.requestRematch()
    r.run(2)
    expect(r.host.state).toBe('countdown')
    expect(r.guest.state).toBe('countdown')
    expect(r.host.session!.cfg.seed).toBe(firstSeed + 1)
    expect(r.host.session!.cfg.matchId).toBe(1)
    expect(r.host.matchIndex).toBe(1)
    expect(r.host.rematchRequested).toBe(false) // reset for the next round

    // the second match must be as clean as the first, with match-0 final
    // packets still draining through the same wire
    r.run(COUNTDOWN / STEP_MS + 5)
    playOut(r)
    expect(r.host.session!.status).toBe('won')
    expect(r.guest.session!.status).toBe('lost')
    expect(r.host.session!.cfg.matchId).toBe(1)
  })

  it('a deliberate leave closes both rooms gracefully', () => {
    const r = rig()
    r.run(3)
    r.guest.close()
    r.run(3)
    expect(r.guest.state).toBe('closed')
    expect(r.host.state).toBe('closed')
    expect(r.host.peerLeft).toBe(true)
    expect(r.host.peerDisconnected).toBe(false)
  })

  it('a dead connection marks the peer disconnected', () => {
    const r = rig()
    r.run(3)
    // the transport's death notice (WebRTC channel close) fires
    r.net.ends[0].onClose?.()
    expect(r.host.state).toBe('closed')
    expect(r.host.peerDisconnected).toBe(true)
  })

  it('protocol version clashes close the room instead of desyncing later', () => {
    const net = new FakeNetwork()
    const host = new RoomSession(net.ends[0], { role: 'host', name: 'h' })
    // hand-roll an incompatible peer rather than a real RoomSession
    net.ends[1].onMessage = () => {}
    net.ends[1].send({ t: 'ready', v: 999, name: 'future', sdf: 20 })
    net.tick(1)
    expect(host.state).toBe('closed')
    expect(host.versionClash).toBe(true)
    expect(host.session).toBeNull()
  })

  it('rematch is refused after the peer leaves', () => {
    const r = rig()
    r.run(COUNTDOWN / STEP_MS + 5)
    playOut(r)
    r.guest.close()
    r.run(3)
    r.host.requestRematch()
    r.run(3)
    expect(r.host.rematchRequested).toBe(false)
    expect(r.host.state).toBe('closed')
  })
})
