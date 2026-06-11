import type { SignalBox, SignalRequest, SignalResult } from './signaling'

/**
 * Client side of the signaling mailbox: a thin API wrapper plus the
 * polling channel the WebRTC glue consumes. Pure and tick-driven — the
 * transport is a function, so tests call `handleSignal` directly and the
 * browser passes `fetchSignalTransport` instead; nothing here reads a
 * wall clock or touches globals.
 */

export type SignalTransport = (req: SignalRequest) => Promise<SignalResult>

export class SignalError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

function expectOk(res: SignalResult): unknown {
  if (res.status !== 200) {
    const err = (res.body as { error?: string } | undefined)?.error ?? 'signal error'
    throw new SignalError(res.status, err)
  }
  return res.body
}

export class SignalApi {
  private readonly transport: SignalTransport

  constructor(transport: SignalTransport) {
    this.transport = transport
  }

  async create(name: string): Promise<{ room: string }> {
    const body = expectOk(
      await this.transport({ method: 'POST', query: { op: 'create' }, body: { name } }),
    )
    return body as { room: string }
  }

  async join(room: string, name: string): Promise<{ hostName: string }> {
    const body = expectOk(
      await this.transport({ method: 'POST', query: { op: 'join', room }, body: { name } }),
    )
    return body as { hostName: string }
  }

  async send(room: string, toBox: SignalBox, msg: unknown): Promise<void> {
    expectOk(
      await this.transport({ method: 'POST', query: { op: 'send', room, box: toBox }, body: msg }),
    )
  }

  async poll(
    room: string,
    box: SignalBox,
    from: number,
  ): Promise<{ messages: unknown[]; next: number }> {
    const body = expectOk(
      await this.transport({
        method: 'GET',
        query: { op: 'poll', room, box, from: String(from) },
      }),
    )
    return body as { messages: unknown[]; next: number }
  }
}

/** browser adapter: SignalRequest → fetch against /api/signal */
export function fetchSignalTransport(
  fetchFn: (url: string, init?: RequestInit) => Promise<Response>,
  base = '/api/signal',
): SignalTransport {
  return async (req) => {
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(req.query)) {
      if (value !== undefined) params.set(key, value)
    }
    const res = await fetchFn(`${base}?${params.toString()}`, {
      method: req.method,
      headers: req.body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: req.body !== undefined ? JSON.stringify(req.body) : undefined,
    })
    return { status: res.status, body: await res.json().catch(() => ({})) }
  }
}

export interface PollingChannelOpts {
  room: string
  /** which mailbox is mine to read; sends go to the other one */
  box: SignalBox
  pollEveryMs?: number
}

/**
 * Fire-and-forget ordered message channel over the mailbox API. `tick`
 * drives the poll cadence and send-queue flushing; failures retry on the
 * next tick (a vanished room surfaces through `onError` and stops the
 * channel). The WebRTC handshake glue consumes exactly this seam.
 */
export class PollingSignalChannel {
  onMessage: ((msg: unknown) => void) | null = null
  onError: ((err: SignalError) => void) | null = null

  private readonly api: SignalApi
  private readonly room: string
  private readonly box: SignalBox
  private readonly peerBox: SignalBox
  private readonly pollEveryMs: number

  private cursor = 0
  private pollAcc: number
  private polling = false
  private sendQueue: unknown[] = []
  private sending = false
  private closed = false

  constructor(api: SignalApi, opts: PollingChannelOpts) {
    this.api = api
    this.room = opts.room
    this.box = opts.box
    this.peerBox = opts.box === 'host' ? 'guest' : 'host'
    this.pollEveryMs = opts.pollEveryMs ?? 400
    this.pollAcc = this.pollEveryMs // first tick polls immediately
  }

  send(msg: unknown) {
    if (this.closed) return
    this.sendQueue.push(msg)
    void this.flushSends()
  }

  tick(dtMs: number) {
    if (this.closed) return
    void this.flushSends()
    this.pollAcc += dtMs
    if (this.pollAcc >= this.pollEveryMs && !this.polling) {
      this.pollAcc = 0
      void this.pollOnce()
    }
  }

  close() {
    this.closed = true
  }

  private fail(err: unknown) {
    if (this.closed) return
    // room gone or rejected: unrecoverable, stop and surface
    if (err instanceof SignalError && (err.status === 404 || err.status === 409)) {
      this.closed = true
      this.onError?.(err)
    }
    // transient errors (network, 5xx): swallowed; the next tick retries
  }

  private async pollOnce() {
    this.polling = true
    try {
      const { messages, next } = await this.api.poll(this.room, this.box, this.cursor)
      this.cursor = next
      for (const msg of messages) {
        if (this.closed) break
        this.onMessage?.(msg)
      }
    } catch (err) {
      this.fail(err)
    } finally {
      this.polling = false
    }
  }

  private async flushSends() {
    if (this.sending || this.closed) return
    this.sending = true
    try {
      while (this.sendQueue.length > 0 && !this.closed) {
        // keep the head until the send succeeds: order is preserved and
        // a transient failure retries from exactly where it stopped
        await this.api.send(this.room, this.peerBox, this.sendQueue[0])
        this.sendQueue.shift()
      }
    } catch (err) {
      this.fail(err)
    } finally {
      this.sending = false
    }
  }
}
