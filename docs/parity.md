---
summary: The parity matrix — every mechanic/setting/stat/QoL row vs the modern-client baseline, graded; the coverage contract for the client stream.
read_when: doing any client-stream work (specs/feature-parity.md phases); deciding whether a behavior is correct, missing, or intentionally divergent.
---

# Parity matrix

Audit date **2026-06-09** (Phase 0 of `specs/feature-parity.md`). Sources were
fetched live; nothing below is from model memory. A feature is not "have"
until its row has tests (parity suite, Phase 1) — this file is the coverage
contract. Quality beats scope: a `baseline` grade never justifies shipping a
janky version (see CLAUDE.md / quality bar).

**Phase 1 (M1, 2026-06-09)**: §1–4 baseline rows are encoded in
`src/engine/parity.test.ts` with per-test source citations; the §13 engine
fixes and decisions D1 (SRS+) / D3 (marathon 15) are implemented. SRS+
numbers were re-fetched from [TV] source files during M1.

**Status** — ✓ have (verified) · △ divergent · ✗ missing
**Grade** — `baseline` expected by a TETR.IO/Jstris player · `nice` later ·
`out` not tetra · `DECIDE` user call recorded below

**Sources** — [PDF] 2009 Tetris Design Guideline (official, archive.org) ·
[TW] tetris.wiki (SRS / Scoring / Marathon / T-Spin / Top_out / TETR.IO /
Hold_piece / Random_Generator / Lock_delay) · [HD] harddrop.com (SRS /
Scoring / T-Spin / Spawn_Location / Drop) · [TIO] tetr.io client source
(`tetr.io/js/tetrio.js`, fetched 2026-06-09) · [JS] Jstris official guide +
lang files (github jezevec10) · [FAQ] tetrio.github.io/faq ·
[WN] winternebs TETRIS-FAQ · [LQ] liquipedia keybinds ·
[BD] tetrio-bot-docs (Poyo-SSB) · [TV] TemariVirus kick tables (extracted
from tetr.io source).

## 1. Rotation & spawning

| Row | Status | Grade | Notes |
| --- | --- | --- | --- |
| SRS 90° kicks, JLSTZ (all 8 transitions) | ✓ | baseline | Hand-verified against [TW]/[HD], exact (tetra stores y-down; published tables y-up). `src/engine/srs.ts` |
| SRS+ 90° kicks, I (all 8) | ✓ | baseline | D1 implemented: TETR.IO default SRS+ y-symmetric I kicks, exact vs [TV] srs_plus.zig |
| O piece: no kicks, rotation no-op | ✓ | baseline | [TW]/[HD] "cannot kick" |
| 180 kicks, JLSTZ+T (TETR.IO table, 6 tests) | ✓ | baseline | Hand-verified exact vs [TV] (extracted from tetr.io source). No guideline 180 standard exists; Jstris table undocumented even to players — TETR.IO's is the only defensible choice |
| 180 kicks, I | ✓ | baseline | D1 implemented: SRS+ minimal I-180 kicks 0→2 +(0,+1); R→L +(+1,0); 2→0 +(0,−1); L→R +(−1,0) [TV] |
| Spawn columns (JLSTZ 3–5, O 4–5, I 3–6, 0-indexed) | ✓ | baseline | Left-handed modern standard [HD-Spawn]. `spawnX()` |
| Spawn rows: hidden rows just above skyline, north-facing, flat-side down | ✓ | baseline | Rows 18–19 of the 40-row board = guideline rows 21–22 [TW-Guideline][PDF §3.4] |
| Drop one row immediately on spawn if unobstructed | ✓ | baseline | Fixed in M1: "move down immediately after appearing" [TW-Guideline][PDF] |
| ARE / generation delay | ✓ | baseline | Tetra has 0 ARE = modern competitive default ([TIO] `are:0`); [PDF] 0.2 s is the offline-guideline value. Intentional, documented here |

## 2. Locking & top-out

| Row | Status | Grade | Notes |
| --- | --- | --- | --- |
| Lock delay 0.5 s, Extended Placement ("move reset") | ✓ | baseline | [PDF §5.7]; default + required for multiplayer. `cfg.lockDelay` 500 ms |
| 15 move/rotation cap; counter restored only on new lowest row | ✓ | baseline | Matches [PDF §5.7] semantics incl. "previously reached row does NOT restore" |
| Post-cap behavior: lock **immediately** on first surface touch | ✓ | baseline | Fixed in M1 per [PDF §5.7]: with all 15 resets spent, a grounded piece locks on the next tick |
| What counts as a "move" (airborne moves before first ground contact) | △ | nice | [PDF] counts 15 movements/rotations outright; tetra only counts while grounded or timer running. Encode chosen reading in tests; PDF text ambiguous in practice |
| Hard drop locks instantly, +2/cell | ✓ | baseline | [PDF §5.4][TW-Scoring] |
| Soft drop does not lock (normal lock delay applies) | ✓ | baseline | [PDF §5.5] |
| Block out (spawn obstructed → game over) | ✓ | baseline | D2 resolved: tetra keeps the 2-row lift as a documented intentional divergence (docs/engine.md); behavior encoded in the parity suite |
| Lock out (piece locks entirely above visible field) | ✓ | baseline | [TW-Top_out]. `allAboveVisible` |
| Garbage push-out top-out (block pushed above buffer → game over) | ✓ | baseline | Fixed in M1 per [TW-Top_out]: a rise that would shove blocks above the buffer ends the game; rows never silently vanish |
| Line clear delay 0 | ✓ | baseline | [TIO] `lineclear_are:0`, [JS] default 0 ms |

## 3. Scoring

| Row | Status | Grade | Notes |
| --- | --- | --- | --- |
| Clear points 100/300/500/800 × level | ✓ | baseline | [TW-Scoring][PDF] |
| T-spin points 400/800/1200/1600 × level (0/S/D/T) | ✓ | baseline | [TW-Scoring] |
| Mini T-spin 100/200/400 × level (0/S/D) | ✓ | baseline | Matches [TW-Scoring] incl. Mini-TSD 400 "(if present)". [HD] claims 1200; official [PDF] omits the row. Tetra's value is the defensible one — documented choice, no change |
| B2B ×1.5 on action score (not drops), first B2B clear unbonused | ✓ | baseline | [TW-Scoring][PDF §worked example]. Engine applies pre-level-multiply — algebraically identical |
| B2B chain: only Single/Double/Triple breaks; T-spin-0 neither breaks nor bonuses | ✓ | baseline | [PDF][TW-Scoring] |
| Combo 50 × count × level; first clear in chain scores 0 | ✓ | baseline | [TW-Scoring][HD]; indexing matches community convention |
| Combo resets on **any** non-clearing lock | ✓ | baseline | Fixed in M1: T-spin-0 locks now reset combo like every other non-clearing placement |
| Perfect clear bonuses 800/1200/1800/2000 × level, additive | ✓ | baseline | [TW-Scoring] (not in [PDF]; Tetris Effect-era values) |
| B2B Tetris PC = 3200 × level | ✓ | baseline | Fixed in M1 per [TW-Scoring]: B2B quad PC bonus is 3200 instead of 2000 |
| Soft drop +1/cell, hard drop +2/cell, flat (never level-multiplied) | ✓ | baseline | [TW-Scoring][PDF] |
| Level multiplies clears/T-spins/combo only | ✓ | baseline | [TW-Scoring] |

## 4. Gravity, levels, randomizer, queue, hold

| Row | Status | Grade | Notes |
| --- | --- | --- | --- |
| Gravity `(0.8−(L−1)·0.007)^(L−1)` s/row | ✓ | baseline | Verbatim [PDF §7][TW-Marathon]. Tetra caps at L20 + 0.5 ms/row floor (undocumented region; fine) |
| Soft drop = SDF × gravity (guideline suggests 20×) | ✓ | baseline | [PDF §7.1]; tetra default SDF 20, user-settable 5–∞ |
| Marathon: fixed goal, 10 lines/level | ✓ | baseline | [TW-Marathon] |
| Marathon ends at level 15 (win state) | ✓ | baseline | D3 implemented: 150 lines = win, PB = score at finish [TW-Marathon] |
| 7-bag Random Generator (pure Fisher-Yates per bag) | ✓ | baseline | [PDF §3.3][TW-Random_Generator][BD]. Seeded mulberry32 |
| First-bag constraint | ✓ | baseline | None — correct: guideline specifies none; TETR.IO normal play has none (S/Z/O-skip is stride-mode only) [BD] |
| Next queue: 5 previews | ✓ | baseline | [TIO] `nextcount` default 5, [JS] default 5. Configurable count = nice |
| Hold: one slot, swap, orientation resets to spawn | ✓ | baseline | [PDF §5.6] |
| Hold flag: re-enabled only after a lock down | ✓ | baseline | [PDF] "A Lock Down must take place between Holds" |
| Hold piece visibly dimmed while unavailable | ✓ | baseline | [TIO] default on. `dimFirst` |

## 5. Handling

| Row | Status | Grade | Notes |
| --- | --- | --- | --- |
| DAS, ms-based, settable | ✓ | baseline | Default 133 ms = Jstris default [JS]; TETR.IO 10f ≈ 167 ms [TIO] |
| ARR, ms-based, 0 = instant | ✓ | baseline | [FAQ] "0 = instantaneous". Instant impl = 10 dispatches (board width) — OK |
| SDF slider 5–41, 41 = ∞ | ✓ | baseline | Range exactly matches [TIO] (5–41, 41 renders ∞) |
| DCD (DAS cut delay) | ✓ | baseline | Added in M3: ms slider (default 0 = Jstris feel); pauses auto-repeat after rotate/hard-drop per [FAQ], charge preserved |
| Cancel-DAS-on-direction-change toggle | ✗ | nice | Tetra hardcodes preserve-charge (Jstris style) = TETR.IO's default-off behavior anyway [TIO]; the toggle itself is nice |
| Safelock ("prevent accidental hard drops") | ✓ | baseline | Added in M3, default on: hard drop swallowed 100 ms after a piece locks on its own [TIO] |
| Prefer-soft-drop-over-movement (20G) | ✗ | nice | [TIO] default on; only matters at very high gravity |
| IRS / IHS (initial rotation/hold) | ✗ | nice | [TIO] tap default; nearly moot at 0 ARE |
| DAS charges during countdown | ✓ | baseline | Tetra has it; matches competitive expectation |
| DAS charge preserved when direction released | ✓ | baseline | Jstris-documented behavior [JS]; most-recent-direction-wins stack |

## 6. Controls

| Row | Status | Grade | Notes |
| --- | --- | --- | --- |
| Default scheme (arrows + Z/X + A 180 + C/Shift hold + Space) | ✓ | baseline | Matches TETR.IO guideline scheme [LQ][TIO] minus numpad/Ctrl alternates (nice) |
| Full rebinding of all 10 actions | ✓ | baseline | Settings modal |
| Multiple keys per action | ✓ | baseline | Fixed in M3: chip-based rebind UI — click a key to unbind, + adds another; conflicts stolen across actions |
| Dedicated instant restart (tap R) | ✓ | baseline | Tetra = tap (TETR.IO stride behavior; default TETR.IO is hold-R ~15f). Tap is the better behavior for a trainer — intentional |
| Hold-to-forfeit / quit | ✓ | baseline | Esc → pause → quit covers it for solo |
| Gamepad | ✗ | out | [TIO] has it; not tetra baseline → IDEAS.md |

## 7. Gameplay QoL

| Row | Status | Grade | Notes |
| --- | --- | --- | --- |
| Instant retry mid-game | ✓ | baseline | R restarts with fresh seed |
| Start countdown | ✓ | baseline | 1400 ms; TETR.IO solo ≈3 s, stride 500 ms [TIO]. Consider shorter on retry (polish) |
| Resume-from-pause countdown / input grace | ✓ | baseline | Added in M3: 900 ms ready/go countdown on unpause, inputs gated (DAS still pre-charges) |
| Action text (clear label, B2B, combo, PC) | ✓ | baseline | Engine labels + controller captions. ALL/SOME/OFF setting = nice [TIO] |
| Ghost piece + toggle | ✓ | baseline | Opacity slider = nice [TIO 0.15 default] |
| Danger warning (board state + sound when near top-out) | ✓ | baseline | Added in M3, toggleable: breathing red wash + warning sound when the stack reaches the top 4 visible rows |
| Stuck-input protection on focus loss (blur clears held keys) | ✓ | baseline | Fixed in M3: window blur resets held keys/DAS; hidden tab auto-pauses (quality-bar §5.5) |
| Undo/redo (zen-style practice) | ✗ | out→pedagogy | [TIO] ZEN has it; belongs to pedagogy-stream mode design |
| Settings persistence (localStorage) | ✓ | baseline | `tetra.settings.v1` |
| Settings export/import file | ✗ | nice | [TIO] `.ttc` drag-drop |

## 8. Stats & summaries

| Row | Status | Grade | Notes |
| --- | --- | --- | --- |
| Live: time, lines, PPS, score, level (per-mode layouts) | ✓ | baseline | `StatsPanel` |
| Live APM / attack stats | △ | baseline (Phase 2+) | M5: live APM + attack in the battle HUD and results. Other modes + VS score land with the Phase-5 metrics pass |
| VS score | ✗ | baseline (Phase 2+) | `((sent+garbage cleared)/pieces)×PPS×100` [tetrio.team2xh.net] |
| Finesse faults + KPP + input counter (Pro-mode-style, optional) | ✓ | baseline | Added in M3: `src/engine/finesse.ts` BFS optimum table ([HD-Finesse], real kick tables); faults/KPP/inputs in the results summary. Soft-dropped pieces exempt (documented) |
| End-of-game summary depth | ✓ | baseline | Fixed in M3: adds inputs, KPP, holds, finesse faults, max combo, max B2B, clear-type breakdown incl. T-spin variants + PCs |
| Per-mode PBs | ✓ | baseline | sprint/blitz/marathon/cheese-by-size/survival; PB flag in results |
| PB celebration (sound/visual) | ✗ | nice | [TIO] `personalbest`/`worldrecord` events |
| Stat-slot customization | ✗ | nice | [TIO] 5 configurable slots |
| Replay timeline analytics (choke/finesse markers) | ✗ | out→pedagogy | Tenchi-FAQ feature; pedagogy Review surface owns this |

## 9. Audio

| Row | Status | Grade | Notes |
| --- | --- | --- | --- |
| Core SFX: move/rotate/spin/drops/lock/hold/clear/quad/garbage/level/over/win/ready-go | ✓ | baseline | Synthesized WebAudio, matches tetra aesthetic |
| Combo escalation (tiered combo sounds) | ✓ | baseline | Added in M3: pitch ladder rising 2 semitones per combo, capped |
| B2B clear sound | ✓ | baseline | Added in M3: paired bright accent layered over the clear |
| All-clear (PC) distinct sound | ✓ | baseline | Added in M3: rising arpeggio + chord stinger |
| Top-out danger siren | ✓ | baseline | Added in M3: low double pulse on entering danger |
| Finesse-fault sound | ✗ | nice | With finesse feature [TIO 40L] |
| Volume slider (not just on/off) | ✓ | baseline | Added in M3: 0–100% SFX volume + mute toggle |
| Music | ✗ | DECIDE | [TIO] full BGM system; Jstris none by default. Decision D4 |

## 10. Visual

| Row | Status | Grade | Notes |
| --- | --- | --- | --- |
| Grid | ✓ | baseline | Opacity setting = nice [TIO 0.1] |
| Clear/drop/lock effects + screen shake, toggleable | ✓ | baseline | `vfx` toggle |
| Danger-state board treatment | ✓ | baseline | Added in M3: quiet breathing red wash (data-bearing — not vfx-gated), shares the §7 toggle |
| Board/background opacity, particles slider, zoom | ✗ | nice | [TIO] |
| Block skins | ✗ | out | Tetra has its own design language |
| Side-by-side duel view | ✗ | baseline (Phase 3/4) | Battle/online surfaces |

## 11. Modes

| Row | Status | Grade | Notes |
| --- | --- | --- | --- |
| Sprint 40L | ✓ | baseline | Win at 40; PB by time |
| Sprint 20/100 variants | ✗ | nice | [JS] has 20/40/100/1000; TETR.IO is 40-only |
| Blitz (2 min, leveling) | ✓ | baseline | Controller-enforced timer |
| Cheese race 10/18/100 | ✓ | baseline | [JS] parity; seeded non-repeating holes |
| Survival (rising garbage) | ✓ | baseline | [JS] parity |
| Marathon | ✓ | baseline | D3 implemented in M1: ends at level 15 as a win |
| Zen / endless chill | ✗ | out→pedagogy | Mode carving belongs to pedagogy stream |
| Battle (vs scripted pressure) | ✓ | baseline | M4 substrate + M5 UI (garbage meter, opponent HP, APM, casual/steady/fierce presets, per-preset PBs). Feel signed off 2026-06-10 |
| Online 1v1 (invite link) | △ | baseline | M6 core landed headless (`src/net/`, docs/netcode.md): lockstep sessions, attack-delay horizon, `Transport` + in-memory fake, hash-based desync detection, match replays — full matches under latency/jitter/drop tested in vitest. WebRTC transport, signaling, room flow + duel UI remain |
| Replays (record/playback) | △ | baseline | D5 implemented in M2: every finished game records `{version, config+seed, fixed-step action log}` (`src/engine/replay.ts`, persisted via `tetra.replays.v1`, round-trip-tested headlessly). M6 added battle-replay fidelity (`Replay.opponent`) and the online `MatchReplay` format (docs/netcode.md). Viewer deliberately deferred to the pedagogy Review surface |

## 12. Decisions (resolved with user, 2026-06-09)

- **D1 — SRS+.** Adopt TETR.IO's default table: symmetric I 90° kicks +
  minimal I-180 kicks (numbers in §1 row and [TV]). JLSTZ tables unchanged.
  Muscle memory transfers 1:1 from Tetra League.
- **D2 — Keep the 2-row block-out lift** (lenient spawn). Documented
  intentional divergence from strict [PDF]; encode current behavior in a
  parity test. (Decided by the agent, not escalated — minor.)
- **D3 — Marathon ends at level 15** (150 lines): win state, PB = score at
  finish. No endless variant for now (zen territory → pedagogy).
- **D4 — No music.** The instrument stays quiet. SFX volume slider still
  baseline.
- **D5 — Replays: record now, view later.** Every game records
  `{seed, config, timestamped actions}` from day one; the viewer ships when
  the pedagogy stream builds the Review surface. No half-built viewer.

## 13. Confirmed Phase 1 work list (no decision needed)

Engine fixes: T-spin-0 combo reset · post-cap immediate lock · drop-on-spawn ·
garbage push-out top-out · B2B-Tetris-PC 3200.
Input/QoL: DCD · safelock · blur-clears-held-keys · resume countdown ·
multi-key rebind UI.
Stats/audio: summary depth (inputs/KPP/holds/clear breakdown/max combo/max
B2B) · combo/B2B/PC/danger sounds · volume slider · finesse counter (with
[HD-Finesse] definition) · danger warning.
Everything ships with cited parity tests per the spec's invariants.
