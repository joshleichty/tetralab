---
summary: Online 1v1 lockstep — the deterministic netcode core (src/net/), its protocol, and the match-replay formats.
read_when: touching src/net/, building the online room flow (WebRTC/signaling), consuming match replays, or changing anything the lockstep simulation hashes.
---

# Netcode (`src/net/`)

Spec Phase 4 (`specs/feature-parity.md`), built headless-first per the
deterministic-drivability invariant: the whole 1v1 stack runs in vitest
over an in-memory transport. WebRTC and the room flow are a swappable
edge on top, not the foundation.

## Model: lockstep with an attack-delay horizon

Each client simulates **both** engines on the shared `STEP_MS` grid; only
`(step, action)` streams cross the wire (`docs/engine.md` invariants make
the rest re-derivable).

- **One coupling rule**: an attack emitted by a board during its step `s`
  enters the opposing board's pending meter at step `s + attackDelaySteps`
  (default 100 steps = 500 ms). This makes the coupled system a pure
  function of the two action streams — `simulateMatchReplay` in
  `lockstep.ts` is that theorem stated as code.
- **The delay doubles as the lockstep horizon.** The local board may run at
  most `attackDelaySteps` ahead of the peer's confirmed stream, so local
  input applies instantly (zero added input lag — the feel bar) and only
  the remote *view* lags by network latency. No rollback is needed:
  boards never interact inside the horizon.
- **Stalls, not desyncs.** If the peer's stream falls past the horizon the
  local game freezes (`session.stalled`; input during a freeze is dropped,
  classic lockstep) and resumes when data arrives. Sustained latency above
  the horizon degrades to slow motion — each side ratchets forward on the
  other's progress — and self-heals.
- **Canonical step order** on both sides: (1) scheduled garbage queues
  into the engine, (2) the step's actions apply in order, (3) the engine
  ticks `STEP_MS`, (4) emitted attacks are scheduled at `+delay`. The
  controller integration must dispatch input inside the session's `onStep`
  hook to stay on this order.
- **Per-player handling**: SDF affects simulation, so it is exchanged at
  handshake and fixed for the match (no mid-match settings edits online).
  DAS/ARR/DCD live in the input layer and stay private. Both engines share
  one match seed (same bags — the competitive fairness standard) and one
  `AttackConfig`.

## Wire protocol (`transport.ts`)

`Transport` is the deterministic seam: `FakeNetwork` (scriptable
latency/jitter/drop on injectable time) for tests, WebRTC DataChannel in
production. The protocol survives loss and reordering by **redundancy,
not retransmission**: every `InputPacket` carries the entire unacked
window (`windowStart..doneThrough` actions + unacked state hashes), so any
single delivery heals all earlier losses. Acks piggyback on the reverse
stream and only shrink the window. Flushing runs on tick time, never on
step progress — two mutually stalled peers must still exchange packets to
un-deadlock.

Desync detection: every `hashEverySteps` each side fingerprints its own
engine (`Engine.stateHash`, timers included); the peer verifies the
fingerprint when its re-simulation reaches that step. Any mismatch ends
the match as `desynced` on both ends (a `desync` packet tells the peer).
Trust model for invite-link play: a hacked client can fabricate inputs —
indistinguishable from skill — but cannot silently diverge the simulation.

## Outcomes

Death is part of the simulation: a top-out at step `s` is re-derived by
the peer, so match results need no referee. `won`/`lost` compare death
steps; identical steps are a `draw`. The winner's session keeps simulating
the loser to its final board (UI + replay completeness). After a decision
the session re-flushes its final packet a few times (`FIN_FLUSHES`) so the
peer can always decide too.

## Match replays

- **Scripted battles** (M5 mode): `Replay.opponent` carries the
  `ScriptedPressureOpponent` config — the opponent is deterministic on the
  step grid, so config alone reproduces its timing. Playback drives a
  `Match` exactly as `GameController` does. Pre-M6 battle replays lack the
  field and are refused.
- **Online matches**: `MatchReplay` = both action streams + match config
  (seed, attack delay, per-player SDF). `matchReplayFrom(session)` captures
  either player's view; `simulateMatchReplay` replays on the pure
  synchronous core and reproduces both engines bit-exactly (round-trip
  tested). This is the format the pedagogy Review surface and bot analysis
  should consume for versus games.

## Signaling (`signaling.ts`, `signalClient.ts`, `api/signal.ts`)

Vercel functions cannot host WebSockets, and a WebRTC handshake is only a
handful of messages — so signaling is a poll-based mailbox: one room =
metadata + a guest slot + two append-only boxes, behind the `SignalStore`
seam (in-memory for tests/dev; Upstash-REST for prod, accepting both
`KV_REST_API_*` and `UPSTASH_REDIS_REST_*` env names). `handleSignal` is a
pure function of `{method, query, body}` × store × injected id/clock;
`api/signal.ts` is its ~25-line Vercel shell. Client-side, `SignalApi`
speaks the same request shape through a transport function (tests plug
`handleSignal` straight in) and `PollingSignalChannel` is the tick-driven
ordered channel the WebRTC glue consumes. Rooms expire after 15 minutes;
ids are 6 chars from an unambiguous alphabet.

**Provisioning**: prod needs a marketplace Redis (e.g. Upstash) installed
on the Vercel project so the REST env vars exist. Without them the
function falls back to per-instance memory — coherent only under
`vercel dev`.

## WebRTC edge (`webrtc.ts`)

`connectPeer({role, signal, pc})` runs offer/answer/trickle-ICE over the
signaling channel and resolves with a `Transport` when the ordered
DataChannel opens. The peer connection is injected (`PeerConnectionLike`),
so the glue — strict in-order message processing, ICE buffered until the
remote description lands, channel adoption, death-during-handshake
rejection — is fully tested against fakes that enforce the real API's
ordering rules. `browserPeerConnection()` (a STUN-configured
`RTCPeerConnection`) is the only untested line. Channel death after open
surfaces through `Transport.onClose`.

## Room flow (`room.ts`)

`RoomSession` owns everything from "channel open" to "packets flowing":
both sides send `ready` (protocol version, nickname, SDF) on connect; the
host rolls a seed and fires `go` (match id, seed, countdown) once both are
ready; both run the same countdown and tick the `LockstepSession` from
`playing` on. Rematches re-run `go` with a fresh seed once both sides ask.
Control messages share the wire with game packets; match-id tags on
input/desync packets keep one match's final re-flushes out of the next.
States: `lobby → countdown → playing → ended (→ countdown …) → closed`,
with `peerLeft` / `peerDisconnected` / `versionClash` flags for the UI.
A dead connection closes the room (friendly play: no forfeit-win claim).

## Still to build (final M6 session)

1. **Room UI + controller wiring** — create/join screens (invite URL,
   nickname), duel view (remote board render, parity matrix row),
   countdown/stall/desync/disconnect surfaces, rematch button; the
   controller drives `RoomSession.tick` with input dispatched in `onStep`
   and SDF edits blocked mid-match. Garbage-meter wind-up states
   (deferred from M5) become meaningful here.
2. **Match-replay persistence** for online games (`matchReplayFrom`).
3. **KV provisioning** on the Vercel project (user action) + a live
   two-browser smoke test through the deployed signaling path.
