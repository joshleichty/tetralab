/**
 * Serverless signaling (spec Phase 4) — the SDP/ICE handshake mailbox.
 *
 * Vercel functions cannot hold WebSockets, so signaling is a tiny
 * poll-based mailbox API over a KV store: a room is one metadata record
 * plus two append-only message boxes (host's and guest's). A handshake is
 * a handful of messages; once the WebRTC DataChannel opens, signaling is
 * done and gameplay traffic is P2P.
 *
 * Everything here is pure and headless: `handleSignal` takes a request
 * shape, a `SignalStore`, and injected id/clock deps — the Vercel function
 * (`api/signal.ts`) and the vitest suite are interchangeable callers, per
 * the deterministic-drivability invariant.
 */

export const SIGNAL_VERSION = 1

/** room ids are short, url-safe, unambiguous (no 0/o/1/l) */
const ROOM_ID_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789'
export const ROOM_ID_LENGTH = 6
const ROOM_ID_RE = new RegExp(`^[${ROOM_ID_ALPHABET}]{${ROOM_ID_LENGTH}}$`)

/** rooms outlive any sane handshake, then evaporate */
export const ROOM_TTL_SEC = 15 * 60
const MAX_NAME_LENGTH = 24
/** SDPs run a few KB; anything bigger than this is not a handshake */
const MAX_MESSAGE_BYTES = 32_000

export type SignalBox = 'host' | 'guest'

export interface RoomMeta {
  v: number
  hostName: string
  createdAt: number
}

/**
 * The KV seam. `MemorySignalStore` serves tests and local dev;
 * `redisSignalStore` speaks Upstash REST in production. All write methods
 * refresh the room's TTL implicitly where the backend supports it.
 */
export interface SignalStore {
  /** atomically create the room; false if the id is taken */
  createRoom(id: string, meta: RoomMeta, ttlSec: number): Promise<boolean>
  getMeta(id: string): Promise<RoomMeta | null>
  /** atomically claim the single guest slot; false if already taken */
  claimGuest(id: string, name: string, ttlSec: number): Promise<boolean>
  /** append a serialized message to a box */
  append(id: string, box: SignalBox, msg: string, ttlSec: number): Promise<void>
  /** read serialized messages from a cursor (index into the box) onward */
  read(id: string, box: SignalBox, from: number): Promise<string[]>
}

// ── pure handler ─────────────────────────────────────────────────

export interface SignalRequest {
  method: string
  query: Record<string, string | undefined>
  body?: unknown
}

export interface SignalResult {
  status: number
  body: unknown
}

export interface SignalDeps {
  store: SignalStore
  /** room-id generator; injectable for deterministic tests */
  newRoomId?: () => string
  now?: () => number
}

export function randomRoomId(): string {
  let id = ''
  for (let i = 0; i < ROOM_ID_LENGTH; i++) {
    id += ROOM_ID_ALPHABET[Math.floor(Math.random() * ROOM_ID_ALPHABET.length)]
  }
  return id
}

const bad = (status: number, error: string): SignalResult => ({ status, body: { error } })

function cleanName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const name = raw.trim()
  if (name.length === 0 || name.length > MAX_NAME_LENGTH) return null
  return name
}

export async function handleSignal(req: SignalRequest, deps: SignalDeps): Promise<SignalResult> {
  const { store } = deps
  const newRoomId = deps.newRoomId ?? randomRoomId
  const now = deps.now ?? (() => Date.now())
  const op = req.query.op

  if (op === 'create') {
    if (req.method !== 'POST') return bad(405, 'POST required')
    const name = cleanName((req.body as { name?: unknown } | undefined)?.name)
    if (!name) return bad(400, 'bad name')
    const meta: Omit<RoomMeta, 'createdAt'> = { v: SIGNAL_VERSION, hostName: name }
    // a 31^6 space makes collisions vanishingly rare; retry a few anyway
    for (let attempt = 0; attempt < 4; attempt++) {
      const id = newRoomId()
      if (!ROOM_ID_RE.test(id)) return bad(500, 'bad room id generated')
      if (await store.createRoom(id, { ...meta, createdAt: now() }, ROOM_TTL_SEC)) {
        return { status: 200, body: { room: id, v: SIGNAL_VERSION } }
      }
    }
    return bad(503, 'could not allocate a room')
  }

  const room = req.query.room
  if (!room || !ROOM_ID_RE.test(room)) return bad(400, 'bad room')

  if (op === 'join') {
    if (req.method !== 'POST') return bad(405, 'POST required')
    const name = cleanName((req.body as { name?: unknown } | undefined)?.name)
    if (!name) return bad(400, 'bad name')
    const meta = await store.getMeta(room)
    if (!meta) return bad(404, 'no such room')
    if (meta.v !== SIGNAL_VERSION) return bad(409, 'version mismatch')
    if (!(await store.claimGuest(room, name, ROOM_TTL_SEC))) {
      return bad(409, 'room is full')
    }
    return { status: 200, body: { hostName: meta.hostName, v: meta.v } }
  }

  const box = req.query.box
  if (box !== 'host' && box !== 'guest') return bad(400, 'bad box')

  if (op === 'send') {
    if (req.method !== 'POST') return bad(405, 'POST required')
    if (req.body === undefined) return bad(400, 'missing body')
    const wire = JSON.stringify(req.body)
    if (wire.length > MAX_MESSAGE_BYTES) return bad(413, 'message too large')
    if (!(await store.getMeta(room))) return bad(404, 'no such room')
    await store.append(room, box, wire, ROOM_TTL_SEC)
    return { status: 200, body: { ok: true } }
  }

  if (op === 'poll') {
    if (req.method !== 'GET') return bad(405, 'GET required')
    const from = Number(req.query.from ?? '0')
    if (!Number.isInteger(from) || from < 0) return bad(400, 'bad cursor')
    if (!(await store.getMeta(room))) return bad(404, 'no such room')
    const raw = await store.read(room, box, from)
    return {
      status: 200,
      body: { messages: raw.map((m) => JSON.parse(m) as unknown), next: from + raw.length },
    }
  }

  return bad(400, 'unknown op')
}

// ── stores ───────────────────────────────────────────────────────

interface MemoryRoom {
  meta: RoomMeta
  guest: string | null
  boxes: Record<SignalBox, string[]>
  expiresAt: number
}

/** in-memory store for tests and local dev; TTL on an injected clock */
export class MemorySignalStore implements SignalStore {
  private rooms = new Map<string, MemoryRoom>()
  private readonly now: () => number

  constructor(now: () => number = () => Date.now()) {
    this.now = now
  }

  private live(id: string): MemoryRoom | null {
    const room = this.rooms.get(id)
    if (!room) return null
    if (room.expiresAt <= this.now()) {
      this.rooms.delete(id)
      return null
    }
    return room
  }

  async createRoom(id: string, meta: RoomMeta, ttlSec: number): Promise<boolean> {
    if (this.live(id)) return false
    this.rooms.set(id, {
      meta,
      guest: null,
      boxes: { host: [], guest: [] },
      expiresAt: this.now() + ttlSec * 1000,
    })
    return true
  }

  async getMeta(id: string): Promise<RoomMeta | null> {
    return this.live(id)?.meta ?? null
  }

  async claimGuest(id: string, name: string, ttlSec: number): Promise<boolean> {
    const room = this.live(id)
    if (!room || room.guest !== null) return false
    room.guest = name
    room.expiresAt = this.now() + ttlSec * 1000
    return true
  }

  async append(id: string, box: SignalBox, msg: string, ttlSec: number): Promise<void> {
    const room = this.live(id)
    if (!room) return
    room.boxes[box].push(msg)
    room.expiresAt = this.now() + ttlSec * 1000
  }

  async read(id: string, box: SignalBox, from: number): Promise<string[]> {
    return this.live(id)?.boxes[box].slice(from) ?? []
  }
}

/** minimal fetch shape so stores/tests never depend on global fetch */
export type FetchLike = (
  url: string,
  init: { method: string; headers?: Record<string, string>; body?: string },
) => Promise<{ status: number; json(): Promise<unknown> }>

/**
 * Upstash Redis REST store (Vercel marketplace KV). One pipeline call per
 * operation; atomicity comes from NX where it matters. Works with either
 * env naming: `KV_REST_API_URL`/`KV_REST_API_TOKEN` or
 * `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN`.
 */
export function redisSignalStore(url: string, token: string, fetchFn: FetchLike): SignalStore {
  const pipeline = async (commands: (string | number)[][]): Promise<unknown[]> => {
    const res = await fetchFn(`${url}/pipeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(commands),
    })
    if (res.status !== 200) throw new Error(`redis pipeline failed: ${res.status}`)
    const rows = (await res.json()) as Array<{ result?: unknown; error?: string }>
    for (const row of rows) {
      if (row.error) throw new Error(`redis: ${row.error}`)
    }
    return rows.map((r) => r.result)
  }
  const k = (id: string, part: string) => `tetra:room:${id}:${part}`

  return {
    async createRoom(id, meta, ttlSec) {
      const [result] = await pipeline([
        ['SET', k(id, 'meta'), JSON.stringify(meta), 'NX', 'EX', ttlSec],
      ])
      return result === 'OK'
    },
    async getMeta(id) {
      const [raw] = await pipeline([['GET', k(id, 'meta')]])
      return raw ? (JSON.parse(raw as string) as RoomMeta) : null
    },
    async claimGuest(id, name, ttlSec) {
      const [result] = await pipeline([['SET', k(id, 'guest'), name, 'NX', 'EX', ttlSec]])
      return result === 'OK'
    },
    async append(id, box, msg, ttlSec) {
      await pipeline([
        ['RPUSH', k(id, box), msg],
        ['EXPIRE', k(id, box), ttlSec],
      ])
    },
    async read(id, box, from) {
      const [rows] = await pipeline([['LRANGE', k(id, box), from, -1]])
      return (rows as string[] | null) ?? []
    },
  }
}
