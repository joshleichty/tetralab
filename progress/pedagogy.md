# Progress — pedagogy stream (training that teaches)

Append-only, newest first. What changed, decisions made, open threads.
See WORKSTREAMS.md for the stream's place in the whole.

---

## 2026-06-10 — M3 built: lesson player UI + Track A (sign-off pending)

**This session**: executed training-core M3 — built, browser-verified
end-to-end, **but the milestone's done-when is a manual design review
with user sign-off, which has not happened: M3 is not closed.**

- **`src/ui/Learn.tsx`** — Learn home (track list → lesson rows in the
  menu's mode-row grammar, per-lesson ✓, track tally) + the lesson
  player: step rail dots left, the game's exact board frame center, card
  right (kicker, serif caption voice, live goal line for challenges,
  scripted-queue strip, mistake/hint notes, hint→reveal→continue
  actions). Enter advances, Backspace goes back, Esc exits, r retries.
- **`src/game/lessonController.ts`** — DOM shell mirroring
  GameController: fixed-step loop, real InputHandler (same handling
  settings), piece sounds via the new `machine.onEvents` hook, feedback
  sounds ('clear' correct / 'lock' bounce / 'win' complete), demo
  auto-play at 750ms beats, `window.__tetraLesson` debug handle,
  completion → `learnProgress.ts` persistence (`tetra.learn.v1`).
- **`src/render/lessonRenderer.ts`** — wraps BoardRenderer (constant
  frame) + the annotation vocabulary: cell marks, column wash, dashed
  placement ghosts, arrows; recognition answers paint green once solved.
  Feedback choreography is CSS on the frame (quiet green inset pulse /
  4px shake), never on the canvas.
- **Track A authored**: 6 lessons × 6 steps (flat nine, keep it flat,
  never bury a cell, no piece dependencies, 9-0 or 6-3, counting to
  four) — every one passes the harness; captions in the app's lowercase
  voice. Menu gained a `learn` group (App.tsx `section` routing, which
  the client stream's online screen now also uses).
- **Browser-verified live** (Chrome, real keys): wrong-move bounce with
  authored message, solve → correct cue → armed continue, challenge
  goal line counting pieces, recognition column tap, completion card
  ("clean run" / bounce tally), persistence → home ✓ and menu tally.
  Two real bugs found and fixed this way: an unstable React ref
  callback re-creating the renderer every frame (compounding dpr
  scale → blank board), and the queue strip leaking bag pieces beyond
  the script.

**Voice/strictness decisions taken (review at sign-off)**: captions are
lowercase full sentences, dry-warm, no exclamation marks; Track A
challenges are gentle (the A-track teaches shape, not speed) — community
numbers enter at Track B+ where the research gives them.

**Cross-stream flags**:
- App.tsx now routes top-level `section`s; client stream's online screen
  merged into the same model mid-session — converged cleanly.
- `machine.onEvents` hook added (additive) so UI layers can voice engine
  events without touching machine internals.
- **Bot stream's L0–L2 backbone (user-flagged this session) unblocks M5's
  cheese seed-pool calibration** — the spec's "scripted player over
  candidate seeds" is exactly `enumerate → plan → execute`. Also the
  future review/coach surfaces (post-M6).

**Open threads**:
- **M3 closes only on the user's design review** — walk Track A
  end-to-end in the real app (`npm run dev` → learn → the flat nine).
  Queued questions for that review: caption voice ok? challenge
  strictness ok? completion card content enough?
- Lesson player a11y: mode-row buttons carry no accessible names
  (preexisting pattern); recognition taps have no keyboard path. Worth
  a pass before M6 landing.
- M4 (Tracks 0, B, C, D) next after sign-off; Track B guided moves
  should display sequences from the finesse table.

---

## 2026-06-10 — M2 done: headless lesson runtime

**This session**: executed training-core M2. New layer `src/learn/`
(runtime) + `src/lessons/` (content registry); zero React anywhere in it
— asserted by a test that raw-scans both directories' imports.

- **`learn/types.ts`** — the lesson vocabulary: six step primitives
  (prose/demo/guidedMove/challenge/recognition/sandbox), `Annotation`
  (cells/ghost/column/arrow), `RecognitionAnswer` (cell/column/choice).
  Conventions: boards are bottom-aligned row strings; annotation coords
  are (column, rows-from-bottom); placements match by locked cells
  (placementId), so S spawn ≡ S 180 counts as correct.
  `DemoMove = Placement | { piece, actions }` — the raw-action variant is
  the T-spin escape hatch flagged in M1 (kicks/tucks demos).
- **`learn/machine.ts`** — `LessonMachine`: per-step fresh lesson-mode
  engine; Mathigon gating (prose/demo/sandbox free, gated steps need
  solved/revealed); wrong guided moves soft-bounce (mistake counted,
  per-mistake message, board rebuilt to the earned prefix); challenge
  goals via M0's compileGoal with `retry()`; hint→reveal (reveal plays
  the real solution and records 'revealed', not solved); back always
  free, earned gates stay earned; single replaced `feedback` value
  (quiet-moment discipline).
- **`learn/harness.ts`** — `validateLesson` (static: boards parse,
  solutions/answers well-formed, ≤16 steps) + `completeLesson` (drives
  the machine through every authored solution; throws with
  lesson/step context). `lessons.test.ts` runs both over the registry —
  **registering a lesson is what puts it under CI**.
- **`learn/fumen.ts`** + `scripts/fumen-to-board.ts` — fumen → BoardSpec
  (import-only interchange; `tetris-fumen` is a devDependency).
- **`lessons/sample/all-steps.ts`** — the reference lesson, one of each
  step kind on a real micro-topic (wells & holes); M3's Track A
  supersedes it as learner content.
- **goals.ts change**: `noNewHoles` now measures `playerHoles` (M1's
  metric) — identical on clean boards, correct on garbage boards, which
  unblocks C-track challenges.

**Cross-stream flags**: none beyond goals.ts above (engine untouched
otherwise). Challenge `solution` is required — harness and reveal both
need it; flagged here because lesson authors (M3/M4) must author
solutions, not just goals.

**Open threads**:
- M3 next: the lesson player UI + Track A content — **the hard quality
  gate; read docs/quality-bar.md first**, user sign-off required. Design
  threads queued from the lesson-structure discussion: challenge
  strictness (community numbers vs tiers) and caption voice.
- Recognition 'cell' answers are exact-match; if a lesson wants "any
  cell in the region", add a region answer kind then (don't pre-build).
- docs/learn.md lands in M6 per spec; until then this entry + the
  module docstrings are the map.

---

## 2026-06-10 — M1 done: replay stats layer

**This session**: executed training-core M1. The client stream had
already shipped the recorder, persistence (cap 20), and round-trip
identity tests, so M1 reduced to the derived-stats layer:

- **`Replay.presses`** (optional field, no version bump — old replays
  still play): physical keydowns stamped like actions. New
  `InputHandler.onPress` hook fires exactly when `keypresses` increments;
  controller wires it to `recorder.recordPress`. This is what lets
  replay-derived KPP/finesse match live semantics — DAS/ARR repeats live
  only in `actions`.
- **`stats.ts analyzeReplay(replay)`**: instrumented resimulation →
  per-piece (presses, graded optimum, fault, holes delta, bumpiness) +
  aggregates (KPP, faults, fault rate, holes created, roughness
  timeline, cheese blocks/100L) + `verified` (resimulated outcome ==
  recorded summary). Battle replays analyze through `Match`.
- **Finesse grading rule** (mirrors live + resolves the two-standard
  flag for stats): soft-drop pieces ungraded; optimum = no-180 teaching
  table, or the 180-aware optimum when the player actually pressed 180 —
  neither input style penalized.
- **`board.ts playerHoles`**: holes covered by piece cells, not garbage —
  cheese terrain isn't a stacking mistake; M2/M4 should consider it for
  C-track `noNewHoles` goals on garbage boards.
- **CLI**: `node scripts/replay-stats.ts <replay.json> [--index n]
  [--json]` — works on plain Node because of the import sweep below.
- Tests: stats suite drives the real `InputHandler` through the exact
  controller wiring (incl. its no-op log filter); an adaptive digger
  records a real cheese game for the downstack metric.

**Cross-stream flags**:
- **Engine-internal imports now carry `.ts` extensions** (mechanical
  sweep, all value imports): the whole engine chain runs under plain
  Node via type stripping. bot stream: your `src/bot/cli.ts` "tsx, not
  plain node" caveat is obsolete — plain `node` works now. Keep new
  engine modules extension-clean (noted in docs/engine.md invariants).
- `Replay` format gained optional `presses` (replay.ts is shared with
  client M6 lockstep work — additive only, playback untouched).
- `InputHandler` gained an `onPress` hook (additive).

**Open threads**:
- M2 next (headless lesson runtime). Plan for Track D demo steps needing
  scripted actions (T-spins can't be expressed by `place()`).
- Roughness timeline under garbage rises reflects terrain, not just the
  player's surface — fine for v1, revisit if Review reads it per-piece.

---

## 2026-06-10 — M0 done: engine substrate; Track 0 agreed

**This session**: executed `specs/training-core.md` M0. All landed in
`src/engine/`, pure and headless, 192 tests green (was 126):

- **`lesson` mode** (new `Mode`): zero gravity, no lock timer, no win
  condition — pieces lock only via `hardDrop`/`place()`; soft drop still
  works. The lesson runtime, not the clock, drives the game.
- **`setBoard(rows | Uint8Array)`** — bottom-aligned row-string boards
  (`'XXXX___XXX'`, parsed in new `board.ts`); throws on malformed input.
- **`setQueue(pieces)`** — scripted queue; seeded bag resumes after.
- **`place({type, rot, x})`** — placement-by-spec: straight drop from the
  top, pulls via hold when needed, returns false (state untouched) when
  unreachable. *Limitation by design: can't express kicks/tucks — T-spin
  demo steps (Track D) must script raw actions instead; M2 should plan
  for that.*
- **`board.ts` metrics**: columnHeights, stackHeight, holes, bumpiness
  (optional well-column exclusion), wellDepth, isWellPure.
- **`goals.ts`**: `GoalSpec` → `compileGoal(spec, engine)` evaluators
  (noNewHoles / clearLines / maxBumpiness / wellPure), observing drained
  events; gameover fails any pending goal.
- **Finesse sequence table** (`finesse-gen.ts` → `data/finesse-table.json`
  → `finesse-table.ts` loader, `npm run gen:finesse` runs on plain Node
  via type stripping): all-shortest-paths BFS, no-180 community standard,
  every minimal sequence per placement. Validated three ways: artifact ↔
  generator equality (CI catches stale artifact), **counts match the
  FinesseTrainer reference for all pieces × rotations × columns** (~160
  checks; their semantics — movement presses only, rotations free, DAS =
  one press — transcribed from finesseTrainer.js into the test), and
  every sequence executed through the real engine locks its claimed
  placement.

**Decisions**:
- Primary finesse table excludes 180 (community standard); the client
  stream's `finesse.ts optimalInputs` *includes* 180 and stays untouched
  — its KPP/fault grading is therefore stricter than the teaching table.
  Flagging rather than unifying: client stream should decide which
  standard summary-screen fault counts use.
- Track 0 — Controls & handling (3 lessons, beginner on-ramp) added to
  the spec (user-agreed this session), shipping in M4; v1 is now ~28
  lessons. Open design threads for M3 from the same discussion:
  challenge strictness (community numbers vs tiered) and caption voice.

**Cross-stream flags**:
- **Engine API additions** (above) are deliberately bot-usable: board
  metrics are evaluation features; `place()` is candidate application;
  GoalSpecs are future reward components. Bot stream's new `Position`
  snapshot/`spin.ts`/`fits()` landed mid-session in the same files —
  merged cleanly, `place()`/`canFit` now share its `fits()` helper.
- `tsconfig.app.json` gained `resolveJsonModule` (finesse artifact import).
- **Repo lint is not green** at session end: one pre-existing error in
  `src/net/transport.ts` (client stream's in-flight M6 work, uncommitted)
  — not touched from this lane. Tests and build are green.

**Open threads**:
- M1 next: the client stream already built recording/playback
  (`replay.ts`), so M1 reduces to the derived-stats layer (KPP, faults
  vs the new table, holes/roughness timelines, downstack efficiency) +
  persistence cap; CLI-callable first.
- Spec's M1 prose still describes the pre-replay codebase — read
  `docs/engine.md` replay section first.

---

## 2026-06-09 — Training-core spec (interview + research)

**This session**: extended interview filtered the training product down to
its core — three sections, **Play / Learn / Progress** — then four parallel
Opus research passes (lesson-player teardowns, curriculum extraction,
benchmark design, codebase map) fed **`specs/training-core.md`**: the full
executable spec for Learn + Progress. Supporting evidence persisted to
`research/training-core-research.md`. No code changes; tests green.

**Decisions**:
- Core loop: Learn teaches → Play integrates (stays clean, no in-game
  coaching) → Progress measures and links the bottleneck to its lesson.
  Daily set cut; review/coach/ghost-suggestions are bot-stream territory
  (the user's live-ghost / after-placement / undo-retry ideas from this
  interview are sharpening input for `specs/bot-engine-research.md`).
- Drills live inside Learn (lesson → exit drill), not a separate section.
- Lesson system: six step primitives (prose / demo / guidedMove /
  challenge / recognition / sandbox), card-by-card, interaction-gated,
  hint→reveal escalation, typed TS lesson data + engine-evaluated
  GoalSpecs, fumen as import-only interchange. Models: Lichess interactive
  lessons (script-is-the-data) + Mathigon (interaction gating). Every
  lesson machine-verified by a vitest harness — no DOM.
- Curriculum v1: Tracks A–D (stacking, finesse, downstacking, T-spins,
  ~25 lessons) extracted with sources in the research notes; E–G (versus
  theory, openers, styles) backlogged to IDEAS-level until A–D are
  immaculate.
- Finesse table derived by BFS (sequences, not just counts), validated
  against the FinesseTrainer count table.
- Progress: 4-skill battery (sprint / cheese-18 / blitz exist + new
  finesse test), energy 0–1200 anchored to winternebs thresholds,
  median-of-3, **harmonic-mean overall** (Voltaic's weakest-link gate),
  30-day recency window, calibrated seed pools.

**Cross-stream flags**:
- **Replay format defined in this spec** (seed + per-frame actions/dt) —
  `specs/feature-parity.md`'s "replays baseline?" open question should
  adopt it, not invent a second format.
- **Engine API additions** (M0): setBoard, setQueue, step control,
  place-by-spec, board metrics (holes/bumpiness/well). Pure, headless,
  tested — and deliberately useful to the bot stream (board metrics are
  evaluation features; place-by-spec is candidate application). No
  evaluation/recommendation built here.

**Open threads**:
- Execute `specs/training-core.md` M0 (engine substrate) in a fresh
  session. M3 (lesson player) is a hard quality gate — read
  `docs/quality-bar.md` first.
- Sequencing vs client-stream Phase 0: no collision except the replay
  format; can run in parallel.

---

## 2026-06-09 — Stream opened (docs reorg, no code)

**State at opening**: Research phase complete — `research/pedagogy.md` is
the evidence base (skill ladder, learning-science design rules, trainer
teardowns, the Learn / Drill / Test / Play / Review mode carving, ranked
methods). Headline: the ecosystem gap is *diagnosis* — no guideline tool
closes play → measure → diagnose → drill.

**Next**: an interview session producing the first training-mode spec(s).
Nothing is committed yet on which mode goes first; the research's method
ranking (engine review of own games, benchmark battery, weakness-targeted
drills) is the starting point for that conversation.

**Tandem note**: the top-ranked methods share a dependency — an engine that
evaluates positions and enumerates good placements. That capability is the
bot stream's territory; specs here should state what they need from it, not
build it.
