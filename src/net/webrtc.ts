import type { NetMessage, Transport } from './transport'

/**
 * WebRTC edge: turns a signaling channel + RTCPeerConnection into the
 * `Transport` the lockstep session consumes. The peer connection is
 * injected behind `PeerConnectionLike`, so the entire handshake glue —
 * offer/answer ordering, ICE trickling and buffering, channel adoption —
 * runs headlessly in vitest against fakes; `browserPeerConnection()` is
 * the only line that touches the real API.
 */

export interface DataChannelLike {
  readyState: string
  onopen: (() => void) | null
  onmessage: ((ev: { data: unknown }) => void) | null
  onclose: (() => void) | null
  send(data: string): void
  close(): void
}

export interface SessionDescriptionLike {
  type: string
  sdp?: string
}

export type IceCandidateLike = Record<string, unknown>

export interface PeerConnectionLike {
  createDataChannel(label: string, opts?: { ordered?: boolean }): DataChannelLike
  createOffer(): Promise<SessionDescriptionLike>
  createAnswer(): Promise<SessionDescriptionLike>
  setLocalDescription(desc: SessionDescriptionLike): Promise<void>
  setRemoteDescription(desc: SessionDescriptionLike): Promise<void>
  addIceCandidate(candidate: IceCandidateLike): Promise<void>
  onicecandidate: ((ev: { candidate: IceCandidateLike | null }) => void) | null
  ondatachannel: ((ev: { channel: DataChannelLike }) => void) | null
  close(): void
}

/** the slice of PollingSignalChannel the handshake needs */
export interface HandshakeSignal {
  send(msg: unknown): void
  onMessage: ((msg: unknown) => void) | null
}

type HandshakeMessage =
  | { t: 'offer'; sdp: SessionDescriptionLike }
  | { t: 'answer'; sdp: SessionDescriptionLike }
  | { t: 'ice'; candidate: IceCandidateLike }

export interface ConnectPeerOpts {
  role: 'host' | 'guest'
  signal: HandshakeSignal
  pc: PeerConnectionLike
}

/**
 * Run the WebRTC handshake over the signaling channel and resolve with a
 * `Transport` once the DataChannel opens. Incoming handshake messages are
 * processed strictly in order (one at a time), and ICE candidates that
 * arrive before the remote description are buffered — the classic
 * trickle-ICE race. Rejecting/timeout is the caller's policy.
 */
export function connectPeer(opts: ConnectPeerOpts): Promise<Transport> {
  const { role, signal, pc } = opts
  return new Promise<Transport>((resolve, reject) => {
    let remoteDescribed = false
    const earlyIce: IceCandidateLike[] = []
    let settled = false
    // handshake messages are processed sequentially: an answer must be
    // fully applied before the candidates behind it
    let chain: Promise<void> = Promise.resolve()

    const fail = (err: unknown) => {
      if (settled) return
      settled = true
      pc.close()
      reject(err instanceof Error ? err : new Error(String(err)))
    }

    const adopt = (ch: DataChannelLike) => {
      ch.onopen = () => {
        if (settled) return
        settled = true
        resolve(channelTransport(ch, pc))
      }
      // a close before open is a failed connection, not a played match
      ch.onclose = () => fail(new Error('data channel closed during handshake'))
    }

    pc.onicecandidate = (ev) => {
      if (ev.candidate) signal.send({ t: 'ice', candidate: ev.candidate } as HandshakeMessage)
    }

    if (role === 'host') {
      adopt(pc.createDataChannel('tetra', { ordered: true }))
      chain = chain
        .then(async () => {
          const offer = await pc.createOffer()
          await pc.setLocalDescription(offer)
          signal.send({ t: 'offer', sdp: offer } as HandshakeMessage)
        })
        .catch(fail)
    } else {
      pc.ondatachannel = (ev) => adopt(ev.channel)
    }

    signal.onMessage = (raw) => {
      chain = chain
        .then(async () => {
          if (settled) return
          const msg = raw as HandshakeMessage
          if (msg.t === 'offer' && role === 'guest') {
            await pc.setRemoteDescription(msg.sdp)
            remoteDescribed = true
            for (const c of earlyIce.splice(0)) await pc.addIceCandidate(c)
            const answer = await pc.createAnswer()
            await pc.setLocalDescription(answer)
            signal.send({ t: 'answer', sdp: answer } as HandshakeMessage)
          } else if (msg.t === 'answer' && role === 'host') {
            await pc.setRemoteDescription(msg.sdp)
            remoteDescribed = true
            for (const c of earlyIce.splice(0)) await pc.addIceCandidate(c)
          } else if (msg.t === 'ice') {
            if (remoteDescribed) await pc.addIceCandidate(msg.candidate)
            else earlyIce.push(msg.candidate)
          }
        })
        .catch(fail)
    }
  })
}

/** adapt an open DataChannel to the lockstep `Transport` seam */
function channelTransport(ch: DataChannelLike, pc: PeerConnectionLike): Transport {
  const transport: Transport = {
    onMessage: null,
    onClose: null,
    send(msg: NetMessage) {
      if (ch.readyState === 'open') ch.send(JSON.stringify(msg))
    },
    close() {
      ch.onclose = null
      ch.close()
      pc.close()
    },
  }
  ch.onmessage = (ev) => {
    transport.onMessage?.(JSON.parse(String(ev.data)) as NetMessage)
  }
  ch.onclose = () => {
    transport.onClose?.()
  }
  return transport
}

/** the one real-API line: a browser RTCPeerConnection behind the seam */
export function browserPeerConnection(iceServers?: RTCIceServer[]): PeerConnectionLike {
  return new RTCPeerConnection({
    iceServers: iceServers ?? [{ urls: 'stun:stun.l.google.com:19302' }],
  }) as unknown as PeerConnectionLike
}
