import {
  MemorySignalStore,
  handleSignal,
  redisSignalStore,
} from '../src/net/signaling'
import type { SignalStore } from '../src/net/signaling'

/**
 * Vercel function: the thin HTTP shell around the pure `handleSignal`
 * (src/net/signaling.ts — that file is where the behavior and the tests
 * live). Storage comes from a marketplace Redis via REST env vars; with
 * no KV configured it falls back to per-instance memory, which is only
 * coherent under `vercel dev` — fine for local play, useless in prod.
 */

let store: SignalStore | null = null

function getStore(): SignalStore {
  if (store) return store
  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN
  store =
    url && token
      ? redisSignalStore(url, token, (u, init) => fetch(u, init))
      : new MemorySignalStore()
  return store
}

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url)
  const query: Record<string, string | undefined> = {}
  url.searchParams.forEach((value, key) => {
    query[key] = value
  })
  const body = req.method === 'POST' ? await req.json().catch(() => undefined) : undefined
  const result = await handleSignal({ method: req.method, query, body }, { store: getStore() })
  return Response.json(result.body, { status: result.status })
}
