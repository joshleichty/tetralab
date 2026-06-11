import { describe, expect, it } from 'vitest'
import { FakeNetwork } from './transport'
import type { InputPacket, NetMessage } from './transport'

/**
 * FakeNetwork — the in-memory Transport mandated by the deterministic-
 * drivability invariant (CLAUDE.md / specs/feature-parity.md Phase 4):
 * scriptable latency/jitter/drop on injectable time, so full online
 * matches run headlessly in vitest.
 */

function packet(doneThrough: number): InputPacket {
  return {
    t: 'input',
    doneThrough,
    windowStart: 0,
    ack: -1,
    actions: [],
    hashes: [],
    over: false,
  }
}

function collect(net: FakeNetwork, side: 0 | 1): NetMessage[] {
  const got: NetMessage[] = []
  net.ends[side].onMessage = (m) => got.push(m)
  return got
}

describe('FakeNetwork', () => {
  it('delivers nothing until the network clock passes the latency', () => {
    const net = new FakeNetwork({ latencyMs: 50 })
    const got = collect(net, 1)
    net.ends[0].send(packet(1))
    net.tick(49)
    expect(got).toHaveLength(0)
    net.tick(1)
    expect(got).toHaveLength(1)
    expect(got[0]).toEqual(packet(1))
  })

  it('zero conditions deliver on the next tick, in send order', () => {
    const net = new FakeNetwork()
    const got = collect(net, 0)
    net.ends[1].send(packet(1))
    net.ends[1].send(packet(2))
    net.tick(0)
    expect(got.map((m) => (m as InputPacket).doneThrough)).toEqual([1, 2])
  })

  it('drop rate 1 loses everything; 0 loses nothing', () => {
    const lossy = new FakeNetwork({ dropRate: 1 })
    const got = collect(lossy, 1)
    lossy.ends[0].send(packet(1))
    lossy.tick(1000)
    expect(got).toHaveLength(0)
    expect(lossy.inFlight()).toBe(0)

    const clean = new FakeNetwork({ dropRate: 0 })
    const got2 = collect(clean, 1)
    for (let i = 0; i < 20; i++) clean.ends[0].send(packet(i))
    clean.tick(1)
    expect(got2).toHaveLength(20)
  })

  it('drops are seeded: the same seed loses the same messages', () => {
    const survivors = (seed: number): number[] => {
      const net = new FakeNetwork({ dropRate: 0.5, seed })
      const got = collect(net, 1)
      for (let i = 0; i < 40; i++) net.ends[0].send(packet(i))
      net.tick(1)
      return got.map((m) => (m as InputPacket).doneThrough)
    }
    const a = survivors(7)
    expect(a.length).toBeGreaterThan(5)
    expect(a.length).toBeLessThan(35)
    expect(survivors(7)).toEqual(a)
    expect(survivors(8)).not.toEqual(a)
  })

  it('jitter can reorder messages', () => {
    // deterministic with the seed: across many sends, at least one pair
    // must arrive out of send order with jitter far larger than spacing
    const net = new FakeNetwork({ jitterMs: 100, seed: 3 })
    const got = collect(net, 1)
    for (let i = 0; i < 20; i++) {
      net.ends[0].send(packet(i))
      net.tick(1)
    }
    net.tick(200)
    const order = got.map((m) => (m as InputPacket).doneThrough)
    expect(order).toHaveLength(20)
    expect(order).not.toEqual([...order].sort((a, b) => a - b))
  })

  it('messages are isolated copies: mutating after send does not leak', () => {
    const net = new FakeNetwork()
    const got = collect(net, 1)
    const p = packet(1)
    net.ends[0].send(p)
    p.actions.push([5, 'left'])
    p.doneThrough = 99
    net.tick(1)
    expect((got[0] as InputPacket).doneThrough).toBe(1)
    expect((got[0] as InputPacket).actions).toEqual([])
  })

  it('setConditions applies to later sends, not in-flight ones', () => {
    const net = new FakeNetwork({ latencyMs: 10 })
    const got = collect(net, 1)
    net.ends[0].send(packet(1))
    net.setConditions({ latencyMs: 1000 })
    net.ends[0].send(packet(2))
    net.tick(20)
    expect(got.map((m) => (m as InputPacket).doneThrough)).toEqual([1])
    net.tick(1000)
    expect(got.map((m) => (m as InputPacket).doneThrough)).toEqual([1, 2])
  })

  it('a closed end neither sends nor receives', () => {
    const net = new FakeNetwork()
    const got0 = collect(net, 0)
    const got1 = collect(net, 1)
    net.ends[0].send(packet(1))
    net.ends[0].close()
    net.ends[0].send(packet(2)) // ignored: sender closed
    net.ends[1].send(packet(3)) // dropped: receiver closed
    net.tick(1)
    expect(got1).toHaveLength(1) // packet(1) was in flight before close
    expect(got0).toHaveLength(0)
  })
})
