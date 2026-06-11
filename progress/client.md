# Progress — client stream (parity & quality)

Append-only, newest first. What changed, decisions made, open threads.
See WORKSTREAMS.md for the stream's place in the whole.

---

## 2026-06-09 — Phase 0 parity audit complete (docs only, no code)

**This session**: Executed Phase 0 of `specs/feature-parity.md`. Three
parallel research agents pulled primary sources live (official 2009
Guideline PDF, tetris.wiki/harddrop SRS + scoring pages, TETR.IO client
source `tetr.io/js/tetrio.js`, Jstris guide/lang repos); I read every line
of the engine/input/controller/UI and cross-checked. Deliverables:
**`docs/parity.md`** (the graded matrix — coverage contract) and
**`specs/feature-parity-runner.md`** (self-contained starter prompt that
drives M0–M7 to completion).

**Headline audit results**:
- SRS 90° kicks (JLSTZ+I), TETR.IO 180 kicks (JLSTZ+T), spawn
  columns/rows, scoring table (incl. mini T-spins, B2B ×1.5 semantics,
  combo indexing, PC bonuses, flat drop points), lock-delay move-reset
  semantics, 7-bag, hold rules: **verified character-exact** against
  sources.
- Confirmed divergences/gaps (Phase 1 work list in matrix §13): T-spin-0
  preserves combo; post-cap lock not immediate; no drop-on-spawn; garbage
  push-out silently deletes row 0 instead of topping out; missing B2B-PC
  3200; missing DCD/safelock; stuck keys on window blur; no resume
  countdown; rebind UI collapses multi-key binds; stats/audio gaps
  (APM/VS/finesse/KPP, combo/B2B/PC/danger sounds, volume slider).

**Decisions (user, recorded in matrix §12)**: D1 adopt SRS+ · D2 keep
2-row block-out lift (documented divergence) · D3 marathon ends at level
15 · D4 no music · D5 replays = record now, view later.

**Open threads**:
- Launch `specs/feature-parity-runner.md` in a fresh session to execute
  M0–M7 (M0 = the known lint debt).
- CLAUDE.md promotion of the "deterministically drivable" invariant still
  pending (runner's M1 can carry it).
- Cross-stream flag: D5 means every game records `{seed, config, actions}`
  from M2 on — pedagogy's Review surface and bot's replay-analysis both
  stand on that format; coordinate before changing it.

---

## 2026-06-09 — Stream opened (docs reorg, no code)

**State at opening**: Playable client shipped and deployed (React+TS+Vite,
pure engine, SRS/scoring/modes, seeded RNG, 28/28 tests green). No parity
work has run yet.

**Next**: `specs/feature-parity.md` Phase 0 — the parity audit producing
`docs/parity.md`. Phase 0 carries four open questions to resolve with the
user (replays baseline?, sprint variants/zen?, PC attack value 10 vs 5,
cosmetic-settings line). The "deterministically drivable at every layer"
invariant gets promoted to CLAUDE.md when Phase 0 lands.

**Known debt**: `npm run lint` fails with 10 pre-existing errors (engine.ts
unused expressions + useless `points` assignment, useGame.ts ref access
during render, format.ts). Some look semantic, not cosmetic — needs its own
session.

## 2026-06-09 — M1: mechanics parity (engine + parity suite)

**This session (runner M0–M1)**: M0 cleared the 10 lint errors (useGame
lazy-useState instead of ref-during-render; engine expression statements).
M1 implemented every §13 engine fix + D1 + D3 and shipped the parity suite.

**Engine changes** (`src/engine/`):
- **SRS+** (D1): I 90° kicks replaced with TETR.IO's y-symmetric table,
  minimal I-180 kicks added. Numbers re-fetched this session from
  TemariVirus/Budget-Tetris-Engine (srs_plus.zig / srs_tetrio.zig) and
  cross-checked against the repo's plain-SRS table + wiki description.
- T-spin-0 locks now reset combo · post-cap (15 resets) grounded pieces
  lock on next tick · pieces drop one row immediately on spawn ·
  garbage push-out above the buffer is a top-out (rows never silently
  deleted) · B2B quad PC = 3200 · marathon ends at level 15 as a win
  (PB = score; controller already handled `win` generically).

**Parity suite**: `src/engine/parity.test.ts` — 30 tests covering every
docs/parity.md §1–4 baseline row, each citing its source; includes exact
kick-table comparisons (published y-up values verbatim, negated), a real
kick-5 TST chamber, mini-spin setups, exact-score assertions. 82 tests
green; lint/build clean.

**Docs**: parity.md statuses flipped for the fixed rows; engine.md gained
"Ruleset & intentional divergences" (SRS+, 0 ARE, D2 lift, marathon 15,
mini-TSD 400); the deterministically-drivable invariant promoted to
CLAUDE.md (closes the Phase 0 open thread).

**Open threads**: mini-TSD (400) has no behavioral test (no reachable
setup without exotic kicks — documented in the suite). Next: M2 replay
recording (D5).

**Cross-stream flag**: SRS+ changes I-piece kick behavior — any future
bot/placement-search code must use `kicksFor` rather than assuming
plain SRS.

## 2026-06-09 — M2: replay recording (D5) + fixed-timestep simulation

**This session (runner M2)**: every finished game now records
`{REPLAY_VERSION, full config incl. seed, fixed-step action log, sdf
changes, summary}` and persists to `tetra.replays.v1` (newest-first,
capped 20, quota-safe). No viewer (D5: pedagogy Review surface owns it).

**Architecture decision**: introduced **fixed-timestep simulation**
(`STEP_MS = 5` ms, 200 steps/s) in the controller — frame dt accumulates
and the engine ticks in fixed steps; input DAS/ARR updates on the same
grid (finer than the old per-frame update). Actions are stamped with step
indices. This is the quality-bar §5.2/5.3 loop architecture and the time
base lockstep netcode (M6) requires — replays and netcode share one grid.
Blitz's 120 s cutoff now lands on an exact step boundary.

**Lean logs**: controller filters no-op wall shoves (instant-ARR fires 10
blind moves per update) before recording — only state-changing
left/right actions are logged.

**Tests** (`src/engine/replay.test.ts`, 7): round-trip identity (full
state: board bytes, score/combo/b2b, queue, hold, active piece, elapsed)
across marathon, 30k-step action-spam, survival (timer rises), cheese
(seeded holes); mid-game SDF change honored; config snapshot isolation;
version-mismatch playback refusal. 89 tests green; lint/build clean.

**Cross-stream flags**:
- Replay format is the contract pedagogy (Review) and bot (analysis)
  stand on: `src/engine/replay.ts` `Replay` interface. Coordinate before
  changing; bump `REPLAY_VERSION` on any state-visible engine change.
- The fixed-step grid is now an invariant (docs/engine.md): drive the
  engine in STEP_MS ticks, never variable dt.

**Open threads**: replay list/viewer UI deliberately absent. Next: M3
handling & QoL parity.

## 2026-06-09 — M3: handling & QoL parity (every §13 input/stats/audio item)

**This session (runner M3)**: all remaining §13 items shipped, browser
smoke-tested (settings modal, multi-bind, gameplay loop, results summary,
replay persistence, resume countdown, danger state — verified live via
`window.__tetra` in an automated Chrome session).

**Input layer** (`src/input/keyboard.ts`, now DOM-free testable via
`press`/`release`): DCD (ms slider, default 0 = Jstris feel; pauses
auto-repeat after rotate/hard-drop, charge preserved [FAQ]) · safelock
(default on, 100 ms hard-drop guard after auto-locks; controller detects
"lock without harddrop event") · blur clears held keys + hidden tab
auto-pauses · keypress + per-piece input counters.

**Finesse** (`src/engine/finesse.ts`, pure): BFS optimum over (rot, x)
using the real kick tables; placements collapsing to identical cell sets
share optima (rotating O = wasted input). Lock event now carries
`piece {type, rot, x}`. Faults = pieces over optimum; soft-dropped pieces
exempt (documented). KPP/inputs from the input layer.

**Controller/UI**: resume-from-pause 900 ms countdown · danger state
(top 4 visible rows) → breathing red wash (not vfx-gated) + warning
sound, toggleable · combo pitch-ladder, B2B accent, all-clear stinger
sounds · SFX volume slider (0–100%) · multi-key rebind UI (chips: click
to unbind, + to add; conflicts stolen) · end-of-game summary: inputs,
KPP, holds, finesse faults, max combo, max B2B, clear-type breakdown ·
marathon menu copy reflects D3.

**Tests**: +19 (finesse optimums incl. ≤3-input bound over all
placements; headless DAS/ARR/DCD/safelock/counters). 108 green;
lint/build clean.

**Open threads**: mini-TSD behavioral test still absent (M1 note) ·
combo-break sound not added (kept the soundscape quiet; revisit at M7
feel pass if chains feel flat).

**Cross-stream flags**: `finesse.ts` is pedagogy-ready (drill grading);
lock events now carry final placement — bot stream can consume for
move-matching.

## 2026-06-09 — M4: versus substrate (engine, headless)

**This session (runner M4)**: spec Phase 2 complete, all pure engine code.

- **`src/engine/attack.ts`**: `AttackConfig` (guideline table [WN]: clears
  0/1/2/4, T-spins 2/4/6, minis 0/0/1, PC +10, B2B +1, additive FAQ combo
  table) + `attackFor()`. Variants (TETR.IO multiplier/Surge) become
  config later, not rewrites.
- **Engine**: every clear computes `info.attack`; pending garbage cancels
  first, remainder emits `{kind:'attack'}`. `queueGarbage(lines)` /
  `pendingGarbage()` (the meter). Entry on lock — incl. the same lock that
  partially cancelled. One hole per attack, re-rolled between attacks;
  `messiness` = per-line move probability within an attack. Push-out
  top-out reused. New mode `'battle'` (no levels, no engine win state).
- **`src/engine/versus.ts`**: `Opponent` interface (tick / receiveAttack /
  takeOutgoing / hp) — the match layer can't tell a script from a bot.
  `ScriptedPressureOpponent`: seeded bursts paced to an average APM;
  presets = APM × messiness. `Match`: win = deplete HP, lose = top out;
  drives engine + opponent, routes attacks both ways, re-emits events.
- **Tests** (+18, 126 green): attack table cited vs [WN]; cancel/partial-
  cancel/enter; change-on-attack + messiness-1 adjacency; deterministic
  entry; flood top-out; opponent APM averaging + determinism; three full
  headless matches (win by HP depletion incl. B2B math, loss under
  pressure, deterministic end-to-end active match).

**Open threads**: solo engines now emit 'attack' events too (harmless,
and the M5 APM/VS HUD will consume them). Battle replays need opponent
timing recorded — that design belongs to M6 lockstep.

**Cross-stream flag (bot)**: `Opponent` in `src/engine/versus.ts` is the
interface a future bot implements for sparring; `Match` is the harness.

## 2026-06-09 — M5: battle mode UI (built; feel sign-off pending)

**This session (runner M5)**: spec Phase 3 — one new mode on the existing
renderer, exactly three new elements:

- **Garbage meter**: thin red bar hugging the board's left edge, height =
  pending lines (cell-scaled), 160 ms eased. Single red state — honest,
  since our garbage is always "enters on next lock" imminent; the
  yellow→red wind-up state machine becomes meaningful with online (M6+).
- **Opponent HP**: quiet panel under NEXT — label, 4 px accent track,
  tabular hp numbers.
- **APM readout**: battle stats layout (time big, apm, attack, pps);
  attack + APM also added to battle results. `ctrl.attackSent` tallies
  attack events (all modes — Phase-5 metrics will reuse).

Mode wiring: `start('battle', {battlePreset})` builds a `Match` with
`ScriptedPressureOpponent`; presets casual/steady/fierce (APM 25/50/90 ×
messiness 0/0.3/0.7 × HP 40/60/80) surfaced as menu chips like cheese
goals; per-preset PBs (fastest win). Controller ticks the match (which
ticks engine + opponent) and drains match events — existing
sfx/fx/finish paths unchanged. Results: win = time + "opponent downed",
loss = "opponent at N/M hp".

Browser-verified: pressure builds in the meter, attack cancellation
(quad vs 17 pending → no hp damage, correct), messy garbage entry
visible, HP panel/stats render.

**⏸ HUMAN GATE: feel sign-off required before M5 closes** — presets
(APM/messiness/HP numbers), meter/HP-bar feel, battle soundscape.

**Open threads**: garbage meter color states deferred (above) · battle
replays don't capture opponent timing (M6 lockstep owns that design).

## 2026-06-10 — M5 closed: feel sign-off received

**This session**: human gate cleared — user played battle mode and signed
off on the feel ("it feels great"): presets, garbage meter / HP bar, and
soundscape accepted as shipped. No code changes.

**Next**: per `specs/feature-parity.md`, remaining phases are M6 (online
1v1 lockstep — owns the battle-replay opponent-timing design) and the
design pass.

## 2026-06-10 — M6 part 1: lockstep netcode core (headless) + battle-replay fidelity

**This session (runner M6, first half)**: the spec-mandated headless
foundation, in-memory-first — `src/net/` is new, plus the battle-replay
design M6 owned. Full design rationale in **docs/netcode.md** (new).

- **`src/net/transport.ts`**: `Transport` seam + `FakeNetwork` — seeded,
  injectable-time pair with scriptable latency/jitter/drop, mid-flight
  condition changes, JSON round-trip serialization enforcement.
- **`src/net/lockstep.ts`**: `LockstepSession` — both engines simulated
  locally, only `(step, action)` streams cross the wire. Keystone rule:
  attack emitted at step `s` enters the opponent at `s + attackDelaySteps`
  (default 500 ms); the delay doubles as the lockstep horizon, so local
  input has zero added latency and lag spikes stall (then resume) rather
  than desync. Canonical per-step order (garbage → actions → tick →
  schedule). Drop/reorder-proof protocol: every packet resends the whole
  unacked window; acks piggyback; flushing runs on tick time so mutual
  stalls can't deadlock. Desync = periodic `Engine.stateHash()` exchange
  (new engine method, timers included), verified against the local
  re-simulation; one `desync` packet ends both sides. Outcomes (won/lost/
  draw) compare re-derived death steps — no referee.
- **Match replays**: online `MatchReplay` = both streams + match config;
  `simulateMatchReplay` re-runs the pure synchronous two-engine core
  (the determinism theorem as code) and reproduces both boards bit-exactly.
  Scripted-battle replays fixed per the M4/M5 open thread: `Replay.opponent`
  (config suffices — the opponent is grid-deterministic); playback drives a
  `Match` mirroring the controller exactly; pre-M6 battle replays refused.
- **Tests** (+25; 230 green tree-wide): full bot-vs-bot matches over the
  fake network — outcome invariance across perfect/lossy/jittery links,
  50% drop convergence, exact attack-delay arrival, horizon stall/ratchet/
  recovery, stall input-freeze, corrupted-board desync detection within ~2
  hash periods, draw on identical deaths, replay round-trips both views,
  stateHash sensitivity (timers, pending-attack partition, single cell).

**Decisions** (mine, flagged for review): attack delay 100 steps = 500 ms
(netcode tuning constant, not a parity row) · per-player SDF exchanged at
handshake, fixed mid-match · shared match seed (same bags) · stalls drop
input (classic lockstep) · winner keeps simulating loser to the final board.

**Concurrency note**: bot + pedagogy streams worked this tree in parallel
this session (engine gained `fits`/`spin.ts`/`snapshot`/lesson mode under
me); `stateHash` and netcode sit cleanly on their refactor; joint tree
green. `Engine.stateHash` tests live in `src/net/lockstep.test.ts` to
avoid touching `engine.test.ts` mid-flight — relocate if it ever matters.

**Open threads (next M6 session, in order — see docs/netcode.md §still-to-build)**:
WebRTC DataChannel transport · Vercel serverless + KV polling signaling ·
room flow (invite URL, nickname, handshake, countdown sync, rematch) ·
duel-view UI + garbage-meter wind-up states + stall/desync surfaces ·
match-replay persistence · disconnect timeouts (room layer). Controller
must dispatch input via the session's `onStep` hook and block SDF edits
mid-match.

**Cross-stream flags**: `MatchReplay` (src/net/lockstep.ts) is the versus
format pedagogy Review / bot analysis should consume · `Engine.stateHash()`
is available as a cheap whole-state identity assert for any stream's tests ·
solo `Replay` gained optional `opponent` (additive; `REPLAY_VERSION`
unchanged — engine rules untouched).

## 2026-06-10 — M6 part 2: online plumbing end-to-end (signaling, WebRTC, room flow)

**This session (runner M6, second half — headless plumbing)**: everything
between "player clicks create room" and "lockstep packets flow" now
exists and is tested without a browser. docs/netcode.md updated with
per-layer sections; UI is the only M6 work left.

- **Signaling** (`src/net/signaling.ts` + `api/signal.ts`): poll-based
  mailbox for the SDP/ICE handshake — `SignalStore` seam with in-memory
  (tests/dev) and Upstash-REST (prod; both `KV_REST_API_*` and
  `UPSTASH_REDIS_REST_*` env names) backends; `handleSignal` is a pure
  function (injected store/ids/clock) and the Vercel function is a ~25-line
  shell over it. Rooms: 6-char unambiguous ids, single-occupancy guest
  slot (NX), 15-min TTL, 32 KB message cap.
- **Client** (`src/net/signalClient.ts`): `SignalApi` over a transport
  function (tests call the handler directly; browser uses
  `fetchSignalTransport`) + `PollingSignalChannel` — tick-driven cadence,
  ordered sends with head-retry, room-gone surfacing. No wall clock.
- **WebRTC edge** (`src/net/webrtc.ts`): `connectPeer` → `Transport` on an
  open ordered DataChannel; `PeerConnectionLike` injection means the glue
  (sequential handshake processing, early-ICE buffering, death-during-
  handshake rejection, post-open `Transport.onClose`) is tested against
  fakes that throw on real-API ordering violations. One untested line:
  `browserPeerConnection()`.
- **Room flow** (`src/net/room.ts`): `RoomSession` — `ready` (version/
  name/SDF) → host-authored `go` (match id, seed, countdown) → lockstep →
  `ended` → rematch loop with fresh seeds. Control messages multiplex
  with game packets on one wire; **match-id tags** (new `m` field on
  input/desync packets, `LockstepSession.cfg.matchId`) keep a finished
  match's re-flushes out of the next. `bye`/disconnect/version-clash all
  close the room with distinct flags for the UI.
- **Tests** (+38, 268 green tree-wide): handler validation/expiry/
  collision-retry, Redis command shapes vs a fake REST endpoint, polling
  cadence/cursors/retry-in-order, ICE-before-offer buffering, channel
  death paths, and full room lifecycles over FakeNetwork — two matches
  back-to-back through the rematch handshake, leave/disconnect/clash.

**Decisions (mine, flagged)**: signaling is bootstrap-only (config rides
the DataChannel in `ready`/`go`, not the mailbox) · disconnect = room
closed, no forfeit-win (friendly invite-link play) · rematch needs both
sides to ask; host is the only `go` author · `api/` typechecks via
tsconfig.node.json include.

**Open threads (final M6 session)**: room UI + controller wiring (input
via `RoomSession.tick`'s `onStep`; block SDF edits mid-match), duel view,
connection-state surfaces, online match-replay persistence. **User
action needed before live testing: install a marketplace Redis (e.g.
Upstash) on the Vercel project** so `api/signal.ts` has KV env vars;
then a two-browser smoke test through the deployed path.

**Cross-stream flags**: `Transport` gained optional `onClose`;
input/desync packets gained optional `m` (default 0 — pre-room sessions
unaffected). Concurrency: bot/pedagogy streams again worked this tree in
parallel (engine.ts now imports with `.ts` extensions, `erasableSyntaxOnly`
is on — constructor parameter properties are banned repo-wide now).
