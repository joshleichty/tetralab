# Spec: Full feature parity with modern Tetris clients

Interviewed 2026-06-09. Execute in a fresh session, phase by phase; each phase
is a session (or several) that ends green per CLAUDE.md.

## Goal

A competitive player arriving from TETR.IO or Jstris can use tetra without
noticing anything missing, wrong, or off-feeling. **Baseline expected features
and experience — not feature maximalism — at the highest level of quality**,
per VISION.md: minimal, quiet, precise.

Two definitions anchor everything:

- **Baseline expected**: what a modern-client player assumes exists (correct
  mechanics, complete handling, instant retry, action text, the standard
  modes, the standard stats). Graded per-item in the parity matrix (Phase 0);
  anything not baseline goes to IDEAS.md, visibly, by the user's call.
- **Highest bar**: quality is the constraint, not a feature. Applies to feel,
  visuals, and architecture equally. Standing rule (user, 2026-06-09):
  **quality beats scope at every decision point** — if a row can't be brought
  fully to bar within its phase, cut or defer it; never ship the janky
  version. "Baseline-expected" grading does not override this.

## Decisions made in the interview

| Question | Decision |
| --- | --- |
| Reference ruleset | The most standard, well-recognized ruleset — guideline base attack table (shared by TETR.IO/Jstris), additive combo table, flat B2B +1. Client-specific exotica (TETR.IO Surge/multiplier, opener phase) deferred; attack rules live in config, not hardcoded. |
| Scope | Everything players expect to compete: verified core mechanics, versus substrate, battle mode, online 1v1, metrics, QoL, design quality. |
| Driver | One engine serves both human training and future RL/bot work; the engine does not know about either. |
| First opponent | Scripted garbage pressure behind an `Opponent` abstraction; a real bot is a later spec implementing the same interface. |
| Battle win condition | Phantom opponent with HP: net attack damages it; deplete to win, top out to lose. Difficulty = APM × messiness presets. |
| Online baseline | 1v1 via invite link. No accounts — nickname + room URL. Lobbies/matchmaking/spectating are later phases on the same foundation. |
| Infra | Vercel-native. WebRTC peer-to-peer gameplay; serverless signaling (see Architecture). |
| Design bar | Full design pass on every existing surface, not just new work. |
| UI philosophy | UI is the point; do not overcomplicate it. |
| Agent testability | This is an agent-driven codebase. Deterministic drivability at every layer becomes a standing invariant (see below). Playwright/visual snapshots deferred until the state-based foundation exists. |
| Out of scope | 20TSD mode, PC mode, real bot opponent, TETR.IO Surge/multiplier ruleset, accounts, matchmaking, lobbies → IDEAS.md. |

## New standing invariant: deterministically drivable at every layer

Extends the engine-purity rule upward (promote to CLAUDE.md when Phase 0
lands):

1. **Injectable time everywhere.** The engine ticks by `dt` (already true);
   the controller and any new layer must too. No layer may read wall-clock
   time directly. The whole stack runs fixed-timestep in tests.
2. **State-based assertions first.** Correctness is asserted on engine/DOM
   state, never pixels. Screenshot/Playwright testing is a later, layout-only
   addition.
3. **Abstracted transport.** Online play is built against a `Transport`
   interface with an in-memory implementation (scriptable latency/jitter/
   drop), so full 1v1 matches run headlessly in vitest. WebRTC is a swappable
   edge.
4. **Tests cite sources.** Every parity assertion names the document (and
   section) it encodes, so parity stays provable, not assumed.
5. **The matrix is the coverage contract.** A feature is not "have" until its
   parity-matrix row has tests. Agents treat green-but-uncovered as broken.

Known limits (accepted, mitigated): *feel* (DAS crispness, animation weight,
latency) is perceptual — instrument input-to-render latency and frame timing
as boundable numbers, and keep the human as the explicit sign-off gate on
feel at each phase end. Browser-layer nondeterminism (rAF jitter, tab
throttling) is quarantined by invariant 1.

## Ruleset (verified 2026-06-09)

Base attack table — guideline standard, confirmed by
[TETRIS-FAQ versus](https://winternebs.github.io/TETRIS-FAQ/versus/) and
`docs/tetris-reference.md` §1.2:

| Clear | Lines sent |
| --- | --- |
| Single / Double / Triple | 0 / 1 / 2 |
| Quad | 4 |
| T-spin Single / Double / Triple | 2 / 4 / 6 |
| Mini T-spin Single / Double | 0 / 1 |
| Perfect Clear | 10 (config; clients range 5–10) |
| B2B bonus | +1 per attack |

Combo (additive, stacks with the clear's attack), indexed by combo count
starting at 1-combo: `0,0,1,1,1,2,2,3,3,4,4,4,5` (FAQ-confirmed; matches
Jstris/Tetris Friends Expert+).

Garbage lifecycle: **queue → cancel → enter**. Incoming attack waits in a
visible meter; outgoing attack cancels pending lines first, remainder sends;
uncancelled garbage enters when a piece locks. Hole column persists within
one attack and re-rolls between attacks ("change on attack"); a `messiness`
parameter [0,1] is the per-line probability the hole moves (0 = clean,
high = cheese). All values live in an `AttackConfig` table alongside
`EngineConfig` — variants (TETR.IO multiplier, Surge) become config later,
not rewrites.

## Phases

### Phase 0 — Parity audit

Produce `docs/parity.md`: a matrix of every mechanic, mode, setting, stat,
and QoL behavior → **have / divergent / missing**, each row graded
**baseline-expected / nice-to-have / out** and citing its source. Audit
against primary sources live (tetris.wiki, tetrio.wiki.gg, harddrop.com,
TETRIS-FAQ) — never from model memory; `docs/tetris-reference.md` carries
confidence flags for where prose is thin and real-client verification is
needed. Cover at minimum:

- **Mechanics**: SRS kick tables (JLSTZ/I/O, all transitions) + 180 kicks;
  T-spin 3-corner rule, mini vs full, kick-5 upgrade; full guideline scoring
  (clears, T-spin points, B2B ×1.5, combo, drop points, PC bonus, level
  multipliers); 7-bag; hold rules; spawn positions/orientations and top-out;
  lock delay (500 ms, 15 move resets, reset semantics); gravity curves.
- **Handling**: DAS/ARR/SDF semantics vs the standard model (ARR 0 =
  instant, SDF ∞ = instant — tetra's `INSTANT_SDF=41` boundary needs
  checking); DCD (DAS cut delay — tetra lacks it; baseline-expected for
  0-ARR play); DAS-cancel-on-direction-change; key rebinding completeness.
- **QoL**: instant restart, countdown, pause (exist — verify feel); action/
  judgement text (T-SPIN DOUBLE, B2B, combo, PC); line-clear feedback; ghost;
  sfx coverage; settings persistence; end-of-game summary.
- **Stats**: PPS (exists); APM, APP, VS (formula:
  `VS = ((sent + garbage cleared) / pieces) × PPS × 100`); finesse faults +
  KPP; PB depth per mode.
- **Modes**: sprint variants (20/40/100), zen, replays — graded, not
  auto-included.

Deliverable: the matrix, plus the graded baseline column agreed with the
user before Phase 1 begins.

### Phase 1 — Mechanics parity

Fix every *divergent* baseline row. Deliverable: the **parity test suite**
(`src/engine/parity.test.ts` or split per area), every assertion citing its
source per invariant 4. Intentional divergences documented in
`docs/engine.md` with rationale.

### Phase 2 — Versus substrate (engine, headless)

- `AttackConfig` + attack calculation on `ClearInfo` (engine emits
  `attack` per clear; solo modes simply ignore it).
- Garbage queue/cancel/enter + messiness + change-on-attack hole rules.
- `Opponent` interface: receives attacks, emits incoming attacks, exposes
  HP/state. Engine and match layer don't know script from bot.
- Scripted-pressure implementation: deterministic, seeded, presets =
  APM × messiness.
- Match layer: one human-driven engine + one `Opponent`, win/lose rules.
- Fully tested headlessly, including complete scripted matches.

### Phase 3 — Battle mode (UI)

One new mode on the existing renderer. Adds exactly three elements:
incoming-garbage meter beside the board, opponent HP bar, APM readout.
Difficulty presets surfaced simply. No second board, no new screens.

### Phase 4 — Online 1v1 (invite link)

- **Netcode**: deterministic lockstep — clients exchange `(action, tick)`
  streams and simulate both engines locally; the seeded engine guarantees
  identical simulation. Periodic state-hash exchange detects desync.
- **`Transport` interface** with two implementations: in-memory fake
  (scriptable latency/jitter/drop — the test harness) and WebRTC
  DataChannel.
- **Signaling** (verified 2026-06-09: Vercel functions cannot host
  WebSockets, even with Fluid Compute —
  [Vercel KB](https://vercel.com/kb/guide/do-vercel-serverless-functions-support-websocket-connections)):
  SDP/ICE exchange needs only a handful of messages, so Vercel-native =
  serverless functions + marketplace KV (e.g. Upstash Redis) with short
  polling. Fallback if polling UX disappoints: a managed realtime channel
  (Ably/PartyKit) for signaling only. Gameplay traffic is P2P either way.
- Room flow: create room → shareable URL → friend joins with nickname →
  countdown → ranked-rules 1v1 (rematch loop). No accounts, no persistence.
- Full matches (two engines + fake transport, scripted network conditions)
  must run headlessly in vitest before WebRTC lands.

### Phase 5 — Design pass + metrics/QoL

- Audit and raise every surface (menu, HUD, settings, overlays, new battle/
  online screens) to the VISION.md standard; motion/feedback polish
  (clear effects, judgement text, transitions).
- Ship the baseline-graded QoL and stats rows from the matrix: APM/APP/VS in
  HUD, finesse (KPP/faults) in the input layer, judgement text, missing
  handling settings (DCD etc.), end-of-game summaries.
- Feel sign-off by the user per the invariant's known-limits clause.

Phases 1–3 and 5's metrics work can interleave; Phase 4 depends only on
Phase 2.

## Open questions (resolve during Phase 0, with the user)

- Replays: baseline-expected or nice-to-have? (Deterministic engine makes
  them nearly free: seed + action log.)
- Sprint variants (20/100) and zen: baseline or IDEAS.md?
- PC attack value: pick 10 (Jstris) or 5 (TETR.IO League) as the default.
- Where the parity matrix draws the line on cosmetic settings (board
  opacity, particles, etc.).

## Sources

- `docs/tetris-reference.md` (foundational research, June 2026, with
  confidence flags)
- [TETRIS-FAQ — versus](https://winternebs.github.io/TETRIS-FAQ/versus/)
  (attack + combo tables, confirmed this session)
- [tetrio.github.io/faq/mechanics](https://tetrio.github.io/faq/mechanics.html)
  (handling semantics: ARR 0 instant, SDF ∞ instant, DCD)
- [TETR.IO wiki — Garbage](https://tetrio.wiki.gg/wiki/Garbage) (combo
  multiplier formula, B2B charging, garbage special bonus — the deferred
  TETR.IO layer)
- [Vercel KB — WebSockets](https://vercel.com/kb/guide/do-vercel-serverless-functions-support-websocket-connections)
  (no WebSocket hosting on functions; third-party realtime list)
