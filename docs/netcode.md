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

## Still to build (next M6 sessions)

The headless core above is done and tested. Remaining, in order:

1. **WebRTC `Transport`** — DataChannel (ordered is fine; the protocol
   tolerates anything), `RTCPeerConnection` wiring as a thin adapter.
2. **Signaling** — Vercel functions cannot host WebSockets: serverless
   functions + marketplace KV (e.g. Upstash Redis) with short polling for
   the SDP/ICE handshake (a handful of messages). Fallback if polling UX
   disappoints: managed realtime (Ably/PartyKit) for signaling only.
   Gameplay traffic is P2P either way.
3. **Room flow** — create room → shareable URL → nickname → handshake
   (exchange seed/SDF/config) → synchronized countdown → 1v1 → rematch
   loop. No accounts, no persistence.
4. **UI** — side-by-side duel view (parity matrix row), garbage-meter
   wind-up states (deferred from M5), connection-state surfaces (stall
   indicator, desync/disconnect end states), match-replay persistence.
   Disconnect timeouts are a room-layer concern (the core only stalls).
