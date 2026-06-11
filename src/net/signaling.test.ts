import { describe, expect, it } from 'vitest'
import {
  MemorySignalStore,
  ROOM_TTL_SEC,
  SIGNAL_VERSION,
  handleSignal,
  randomRoomId,
  redisSignalStore,
} from './signaling'
import type { SignalDeps, SignalRequest } from './signaling'

/**
 * Signaling (spec Phase 4): the poll-based SDP/ICE mailbox, tested as the
 * pure handler + store — exactly what the Vercel function adapts. The
 * full client flow rides on this in signalClient.test.ts.
 */

function deps(overrides: Partial<SignalDeps> = {}): SignalDeps {
  let n = 0
  return {
    store: new MemorySignalStore(() => 0),
    newRoomId: () => `qqqqq${(n++ % 9) + 2}`, // qqqqq2, qqqqq3, … (valid grammar)
    now: () => 1000,
    ...overrides,
  }
}

const post = (query: Record<string, string>, body?: unknown): SignalRequest => ({
  method: 'POST',
  query,
  body,
})
const get = (query: Record<string, string>): SignalRequest => ({ method: 'GET', query })

describe('handleSignal', () => {
  it('create → join → bidirectional send/poll with cursors', async () => {
    const d = deps({ newRoomId: () => 'abcdef' })
    const created = await handleSignal(post({ op: 'create' }, { name: 'Hopper' }), d)
    expect(created.status).toBe(200)
    expect(created.body).toEqual({ room: 'abcdef', v: SIGNAL_VERSION })

    const joined = await handleSignal(
      post({ op: 'join', room: 'abcdef' }, { name: 'Curie' }),
      d,
    )
    expect(joined.status).toBe(200)
    expect(joined.body).toEqual({ hostName: 'Hopper', v: SIGNAL_VERSION })

    // host → guest's box; guest → host's box
    await handleSignal(
      post({ op: 'send', room: 'abcdef', box: 'guest' }, { t: 'offer', sdp: 'sdp-h' }),
      d,
    )
    await handleSignal(
      post({ op: 'send', room: 'abcdef', box: 'host' }, { t: 'answer', sdp: 'sdp-g' }),
      d,
    )
    await handleSignal(post({ op: 'send', room: 'abcdef', box: 'host' }, { t: 'ice', c: 1 }), d)

    const hostBox = await handleSignal(get({ op: 'poll', room: 'abcdef', box: 'host', from: '0' }), d)
    expect(hostBox.body).toEqual({
      messages: [
        { t: 'answer', sdp: 'sdp-g' },
        { t: 'ice', c: 1 },
      ],
      next: 2,
    })
    // cursor: nothing new past 2
    const again = await handleSignal(
      get({ op: 'poll', room: 'abcdef', box: 'host', from: '2' }),
      d,
    )
    expect(again.body).toEqual({ messages: [], next: 2 })
    const guestBox = await handleSignal(
      get({ op: 'poll', room: 'abcdef', box: 'guest', from: '0' }),
      d,
    )
    expect(guestBox.body).toEqual({ messages: [{ t: 'offer', sdp: 'sdp-h' }], next: 1 })
  })

  it('the guest slot is single-occupancy', async () => {
    const d = deps({ newRoomId: () => 'abcdef' })
    await handleSignal(post({ op: 'create' }, { name: 'h' }), d)
    expect((await handleSignal(post({ op: 'join', room: 'abcdef' }, { name: 'g1' }), d)).status).toBe(200)
    const second = await handleSignal(post({ op: 'join', room: 'abcdef' }, { name: 'g2' }), d)
    expect(second.status).toBe(409)
  })

  it('unknown rooms 404 on join, send and poll', async () => {
    const d = deps()
    expect((await handleSignal(post({ op: 'join', room: 'zzzzzz' }, { name: 'g' }), d)).status).toBe(404)
    expect((await handleSignal(post({ op: 'send', room: 'zzzzzz', box: 'host' }, { t: 'x' }), d)).status).toBe(404)
    expect((await handleSignal(get({ op: 'poll', room: 'zzzzzz', box: 'host', from: '0' }), d)).status).toBe(404)
  })

  it('retries id collisions, then gives up cleanly', async () => {
    const d = deps({ newRoomId: () => 'aaaaaa' })
    expect((await handleSignal(post({ op: 'create' }, { name: 'one' }), d)).status).toBe(200)
    // same id forever: the second create must fail with 503, not clobber
    expect((await handleSignal(post({ op: 'create' }, { name: 'two' }), d)).status).toBe(503)
    expect(await d.store.getMeta('aaaaaa')).toMatchObject({ hostName: 'one' })
  })

  it('rooms expire after their TTL', async () => {
    let t = 0
    const store = new MemorySignalStore(() => t)
    const d = deps({ store, newRoomId: () => 'abcdef' })
    await handleSignal(post({ op: 'create' }, { name: 'h' }), d)
    t = ROOM_TTL_SEC * 1000 + 1
    expect((await handleSignal(post({ op: 'join', room: 'abcdef' }, { name: 'g' }), d)).status).toBe(404)
  })

  it('validates input: names, room ids, boxes, cursors, sizes, methods', async () => {
    const d = deps({ newRoomId: () => 'abcdef' })
    expect((await handleSignal(post({ op: 'create' }, { name: '' }), d)).status).toBe(400)
    expect((await handleSignal(post({ op: 'create' }, { name: 'x'.repeat(40) }), d)).status).toBe(400)
    expect((await handleSignal(get({ op: 'create' }), d)).status).toBe(405)
    await handleSignal(post({ op: 'create' }, { name: 'h' }), d)
    expect((await handleSignal(post({ op: 'join', room: 'BAD!' }, { name: 'g' }), d)).status).toBe(400)
    expect((await handleSignal(post({ op: 'send', room: 'abcdef', box: 'nope' }, {}), d)).status).toBe(400)
    expect(
      (await handleSignal(get({ op: 'poll', room: 'abcdef', box: 'host', from: '-1' }), d)).status,
    ).toBe(400)
    expect(
      (await handleSignal(
        post({ op: 'send', room: 'abcdef', box: 'host' }, { blob: 'x'.repeat(40_000) }),
        d,
      )).status,
    ).toBe(413)
    expect((await handleSignal(get({ op: 'nonsense', room: 'abcdef', box: 'host' }), d)).status).toBe(400)
  })

  it('random room ids match the accepted grammar', () => {
    for (let i = 0; i < 50; i++) {
      expect(randomRoomId()).toMatch(/^[abcdefghjkmnpqrstuvwxyz23456789]{6}$/)
    }
  })
})

describe('redisSignalStore (command shapes against a fake Upstash REST)', () => {
  function fakeRedis() {
    const calls: Array<(string | number)[][]> = []
    const results: unknown[][] = []
    const fetchFn = async (_url: string, init: { body?: string }) => {
      const commands = JSON.parse(init.body ?? '[]') as (string | number)[][]
      calls.push(commands)
      const result = results.shift() ?? commands.map(() => null)
      return {
        status: 200,
        json: async () => result.map((r) => ({ result: r })),
      }
    }
    return { calls, results, store: redisSignalStore('https://kv.example', 'tok', fetchFn) }
  }

  it('createRoom uses SET NX EX and maps OK/null to taken-or-not', async () => {
    const { calls, results, store } = fakeRedis()
    results.push(['OK'], [null])
    const meta = { v: 1, hostName: 'h', createdAt: 5 }
    expect(await store.createRoom('abcdef', meta, 900)).toBe(true)
    expect(await store.createRoom('abcdef', meta, 900)).toBe(false)
    expect(calls[0]).toEqual([
      ['SET', 'tetra:room:abcdef:meta', JSON.stringify(meta), 'NX', 'EX', 900],
    ])
  })

  it('append RPUSHes and refreshes the box TTL in one pipeline', async () => {
    const { calls, store } = fakeRedis()
    await store.append('abcdef', 'guest', '{"t":"offer"}', 900)
    expect(calls[0]).toEqual([
      ['RPUSH', 'tetra:room:abcdef:guest', '{"t":"offer"}'],
      ['EXPIRE', 'tetra:room:abcdef:guest', 900],
    ])
  })

  it('read LRANGEs from the cursor and tolerates missing keys', async () => {
    const { results, store } = fakeRedis()
    results.push([['a', 'b']], [null])
    expect(await store.read('abcdef', 'host', 2)).toEqual(['a', 'b'])
    expect(await store.read('abcdef', 'host', 0)).toEqual([])
  })

  it('claimGuest is SET NX', async () => {
    const { calls, results, store } = fakeRedis()
    results.push(['OK'])
    expect(await store.claimGuest('abcdef', 'g', 900)).toBe(true)
    expect(calls[0][0].slice(0, 3)).toEqual(['SET', 'tetra:room:abcdef:guest', 'g'])
    expect(calls[0][0]).toContain('NX')
  })

  it('surfaces redis errors loudly', async () => {
    const fetchFn = async () => ({
      status: 200,
      json: async () => [{ error: 'WRONGTYPE' }],
    })
    const store = redisSignalStore('https://kv.example', 'tok', fetchFn)
    await expect(store.getMeta('abcdef')).rejects.toThrow(/WRONGTYPE/)
  })
})
