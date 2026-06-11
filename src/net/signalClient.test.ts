import { describe, expect, it } from 'vitest'
import { MemorySignalStore, handleSignal } from './signaling'
import type { SignalDeps } from './signaling'
import { PollingSignalChannel, SignalApi, SignalError, fetchSignalTransport } from './signalClient'

/**
 * Client ↔ handler ↔ store, fully in memory: the exact bytes the browser
 * will exchange, minus the network. Async work is microtask-only here, so
 * a few drained microtask turns settle everything deterministically.
 */

const settle = async (turns = 6) => {
  for (let i = 0; i < turns; i++) await Promise.resolve()
}

function rig() {
  const deps: SignalDeps = {
    store: new MemorySignalStore(() => 0),
    newRoomId: () => 'abcdef',
    now: () => 0,
  }
  const api = new SignalApi((req) => handleSignal(req, deps))
  return { api, deps }
}

describe('SignalApi', () => {
  it('create/join/send/poll round trip', async () => {
    const { api } = rig()
    const { room } = await api.create('Hopper')
    expect(room).toBe('abcdef')
    const { hostName } = await api.join(room, 'Curie')
    expect(hostName).toBe('Hopper')
    await api.send(room, 'guest', { t: 'offer', sdp: 'x' })
    const got = await api.poll(room, 'guest', 0)
    expect(got).toEqual({ messages: [{ t: 'offer', sdp: 'x' }], next: 1 })
  })

  it('non-200s throw typed SignalErrors', async () => {
    const { api } = rig()
    await expect(api.join('zzzzzz', 'g')).rejects.toThrow(SignalError)
    await expect(api.join('zzzzzz', 'g')).rejects.toMatchObject({ status: 404 })
  })
})

describe('PollingSignalChannel', () => {
  it('two channels exchange ordered messages through the mailbox', async () => {
    const { api } = rig()
    const { room } = await api.create('h')
    await api.join(room, 'g')
    const host = new PollingSignalChannel(api, { room, box: 'host', pollEveryMs: 400 })
    const guest = new PollingSignalChannel(api, { room, box: 'guest', pollEveryMs: 400 })
    const atHost: unknown[] = []
    const atGuest: unknown[] = []
    host.onMessage = (m) => atHost.push(m)
    guest.onMessage = (m) => atGuest.push(m)

    host.send({ t: 'offer', n: 1 })
    host.send({ t: 'ice', n: 2 })
    guest.send({ t: 'answer', n: 3 })
    await settle()

    // nothing delivered until a poll fires
    expect(atGuest).toHaveLength(0)
    host.tick(400)
    guest.tick(400)
    await settle()
    expect(atGuest).toEqual([
      { t: 'offer', n: 1 },
      { t: 'ice', n: 2 },
    ])
    expect(atHost).toEqual([{ t: 'answer', n: 3 }])

    // cursors advance: nothing re-delivered, later sends still arrive
    guest.send({ t: 'ice', n: 4 })
    await settle()
    host.tick(400)
    guest.tick(400)
    await settle()
    expect(atHost).toEqual([{ t: 'answer', n: 3 }, { t: 'ice', n: 4 }])
    expect(atGuest).toHaveLength(2)
  })

  it('polls at the configured cadence, not on every tick', async () => {
    const { api, deps } = rig()
    const { room } = await api.create('h')
    let polls = 0
    const counting = new SignalApi(async (req) => {
      if (req.query.op === 'poll') polls++
      return handleSignal(req, deps)
    })
    const ch = new PollingSignalChannel(counting, { room, box: 'host', pollEveryMs: 400 })
    for (let i = 0; i < 10; i++) {
      ch.tick(100)
      await settle(2)
    }
    expect(polls).toBe(3) // t=0 (primed), t=400, t=800
  })

  it('a vanished room surfaces through onError and stops the channel', async () => {
    let t = 0
    const deps: SignalDeps = {
      store: new MemorySignalStore(() => t),
      newRoomId: () => 'abcdef',
      now: () => t,
    }
    const api = new SignalApi((req) => handleSignal(req, deps))
    const { room } = await api.create('h')
    const ch = new PollingSignalChannel(api, { room, box: 'host', pollEveryMs: 400 })
    const errors: SignalError[] = []
    ch.onError = (e) => errors.push(e)
    ch.tick(400)
    await settle()
    expect(errors).toHaveLength(0)
    t = 16 * 60 * 1000 // past the TTL: the room evaporated
    ch.tick(400)
    await settle()
    expect(errors).toHaveLength(1)
    expect(errors[0].status).toBe(404)
    ch.send({ t: 'late' }) // ignored: channel is closed
    ch.tick(400)
    await settle()
    expect(errors).toHaveLength(1)
  })

  it('transient send failures retry in order on later ticks', async () => {
    const { api: real, deps } = rig()
    const { room } = await real.create('h')
    let failing = true
    const flaky = new SignalApi(async (req) => {
      if (req.query.op === 'send' && failing) return { status: 500, body: { error: 'boom' } }
      return handleSignal(req, deps)
    })
    const ch = new PollingSignalChannel(flaky, { room, box: 'guest', pollEveryMs: 400 })
    ch.send({ n: 1 })
    ch.send({ n: 2 })
    await settle()
    expect((await real.poll(room, 'host', 0)).messages).toEqual([])
    failing = false
    ch.tick(50) // any tick retries the queue, polling cadence aside
    await settle()
    expect((await real.poll(room, 'host', 0)).messages).toEqual([{ n: 1 }, { n: 2 }])
  })
})

describe('fetchSignalTransport', () => {
  it('builds the query URL and JSON body the handler expects', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = []
    const fetchFn = async (url: string, init?: RequestInit) => {
      calls.push({ url, init })
      return new Response(JSON.stringify({ ok: true }), { status: 200 })
    }
    const transport = fetchSignalTransport(fetchFn, '/api/signal')
    const res = await transport({
      method: 'POST',
      query: { op: 'send', room: 'abcdef', box: 'host' },
      body: { t: 'ice' },
    })
    expect(res).toEqual({ status: 200, body: { ok: true } })
    expect(calls[0].url).toBe('/api/signal?op=send&room=abcdef&box=host')
    expect(calls[0].init?.method).toBe('POST')
    expect(calls[0].init?.body).toBe('{"t":"ice"}')
  })
})
