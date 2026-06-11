import {
  MemorySignalStore,
  handleSignal,
  redisSignalStore,
} from '../src/net/signaling'
import type { SignalStore } from '../src/net/signaling'

/**
 * Vercel function: the thin HTTP shell around the pure `handleSignal`
 * (src/net/signaling.ts — that file is where the behavior and the tests
 * live). Node-style handler signature: it is what both `vercel dev` and
 * the production Node runtime hand a default export. Storage comes from
 * a marketplace Redis via REST env vars; with no KV configured it falls
 * back to per-instance memory, which is only coherent under `vercel dev`
 * — fine for local play, useless in prod.
 */

/** the slices of VercelRequest/VercelResponse we use (no dependency) */
interface NodeishRequest {
  method?: string
  url?: string
  query?: Record<string, string | string[] | undefined>
  body?: unknown
}
interface NodeishResponse {
  status(code: number): NodeishResponse
  json(body: unknown): void
}

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

export default async function handler(req: NodeishRequest, res: NodeishResponse) {
  const query: Record<string, string | undefined> = {}
  const searchParams = new URL(req.url ?? '/', 'http://local').searchParams
  searchParams.forEach((value, key) => {
    query[key] = value
  })
  for (const [key, value] of Object.entries(req.query ?? {})) {
    if (typeof value === 'string') query[key] = value
  }
  const result = await handleSignal(
    { method: req.method ?? 'GET', query, body: req.body },
    { store: getStore() },
  )
  res.status(result.status).json(result.body)
}
