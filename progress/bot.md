# Progress — bot stream (engine substrate)

Append-only, newest first. What changed, decisions made, open threads.
See WORKSTREAMS.md for the stream's place in the whole.

---

## 2026-06-10 — bot-eval M0–M3 shipped: the intelligence layer has opinions

**This session** (continuation; spec written then executed same-day):
L3 complete — `outcome.ts` (pure lock simulation, tetra's own
`attackFor`), `features.ts` (18-feature registry: Dellacherie/BCTS
published set + concept-named set), `profiles.ts` (dellacherie, bcts,
clean, versus), `suggest.ts` (ranked + per-feature contributions;
optional lookahead-1 top-K re-rank), `selfplay.ts`/`run.ts` (greedy
self-play harness, JSON CLI), 25 new tests (43 total in src/bot/).

**Headline numbers** (all deterministic, pinned in benchmarks.test.ts):
- Published Dellacherie weights complete sprint-40 10/10 at ~102 pieces
  (floor is 100) — feature implementations calibrated against the
  literature's own weights.
- Behavioral splits are real: `clean` digs cheese-18 in 87.5 median
  pieces vs `versus` 134; `versus` sends 0.285 attack/piece vs
  dellacherie's 0.0275 (10×) on the endless playground — the versus
  profile genuinely builds T-spins/quads (visible in cli.ts --profile:
  it holds pieces, keeps a well, refuses b2b-breaking singles).
- Lookahead-1 cuts cheese digging 87.5 → 70.5 pieces (−19%) — the
  research's "depth value saturates early but depth-1 pays" claim
  reproduced in-house.

**Design notes**: `tslots` counts all *grounded* rot-2 full-spin rests
(overhung + under-construction slots), not straight drops — first
attempt missed canonical TSDs, caught by the fixture. M1 deviation
recorded in the spec: dellacherie likes TSDs too (eroded cells), so
differentiation is asserted via full-ordering inequality + a b2b
scenario instead of "dellacherie picks flat". Benchmarks are exact
gates, not statistics — everything is seeded. Bot suite runs ~19s
(self-play games); worth it for behavioral contracts.

**Cross-stream flags**: none touching shared engine (L3 is a pure
consumer; `Engine.b2b`/`combo` were already public). `engine/board.ts`
metrics now power both GoalSpecs and eval features, as planned.

**Next**: L4 (detectors → idea labels over suggestions) and/or L5
(policy seam: profiles + vision/speed/finesse gates → an `Opponent` for
versus). Both now have everything they need. Spec archivable.

## 2026-06-10 — `specs/bot-eval.md` written (L3: features, profiles, suggest)

**This session** (continuation): strategy interview → the L3 spec. No
code. Key decisions captured in the spec's "standing decisions":

- **Strategies are profiles**: 9-0/6-3/LST/downstacker/versus are weight
  vectors + parameters over one shared feature set — content, not
  architecture. Openers/PC/4-wide are explicitly *not* eval features
  (book data / solver / constraint modules, later specs).
- **Published sets are anchors, not the destination**: port the feature
  *functions* (Dellacherie, BCTS) as the durable asset; ship published
  vectors as `dellacherie`/`bcts` profiles for calibration (if they
  can't survive sprint-40 on our engine, our features are wrong);
  hand-seed `clean` + `versus` profiles (Cold Clear relative magnitudes,
  tetra's own `attackFor` for attack terms). Retune via self-play.
- **Union feature set**: published predictive features + concept-named
  ones (holesCreated, wellPurity, tslotsCreated/Wasted, b2bPreserved) —
  the concept names seed L4's explanation layer.
- **suggest() returns the why**: score = exact sum of per-feature
  contributions; interpretability is an invariant with a test.
- **Benchmarks are level-1 only** (sprint/cheese/slow-survival): plans
  assume inputs-faster-than-gravity, so the harness must not race
  marathon gravity. Bounds pinned only after measuring variance
  (anti-flake discipline).

**Cross-stream notes**: `engine/board.ts` metrics are imported as
feature primitives (their header anticipated this); pedagogy's new
`playerHoles` distinction (player-made vs cheese terrain) is exactly
the kind of concept-named feature L3 wants — reuse it. Optional M1
touch: `snapshot()` carrying b2b/combo (flag if taken).

**Next**: execute bot-eval M0 (outcome + features) in a fresh session.

## 2026-06-10 — bot-core M3 shipped: spec complete, L0–L2 done

**This session** (same day, continuation): M3 closes `specs/bot-core.md`
— all four milestones done; the spec is ready to archive once docs are
deemed settled (`specs/README.md` rule).

- **CLI**: `node src/bot/cli.ts --seed 42 --pieces 5 [--mode cheese]` —
  prints board, every reachable placement with tags (spin/hold/sd) and
  its full keypress plan, executes a seeded-random pick per piece. Runs
  on plain Node (≥23): src/bot followed the repo-wide move to
  .ts-suffixed runtime imports (another stream converted src/engine this
  session; `attack.ts` had no imports, so the whole chain is node-clean).
  One `declare const process` keeps it typed inside the app tsconfig
  without @types/node.
- **Corpus**: + rising-garbage dogfood (cheese row every 3rd piece —
  survival's rise generator without racing its timer) and a wall-mini
  fixture proving label agreement end-to-end (`T-SPIN MINI SINGLE`).
- **Perf**: enumerate-with-plans (both pieces) on a mid-game board
  asserted <10ms, logs actual (typically well under 1ms). No memoization
  yet — add when `suggest()` exists.
- **Docs**: `docs/bot.md` (layer map, API, the round-trip property,
  assumptions); `docs/engine.md` observation surface now lists
  `snapshot()`. `enumerateCandidates()` exported for L3 (candidates with
  plans, no re-search).

**Next**: the L3 spec — evaluation features + portable weights
(Dellacherie/BCTS/Cold Clear) + `suggest()`. Engine/board metrics from
the pedagogy stream (`engine/board.ts`) are the feature primitives, as
their header anticipates. 233 tests green repo-wide at session end.

## 2026-06-10 — bot-core M1+M2 shipped: the enumerator + pathfinder exist

**This session** (continuation of the M0 session): `src/bot/` is born —
`types.ts` (Placement/InputPlan/PlanStep), `position.ts`
(`positionFromRows` fixture builder), `enumerate.ts` (L1: BFS over
(rot, x, y) with the engine's exact spawn rules/kick loop/spin rule;
per-edge candidate emission so slide-in 'none' and rotate-in 'full' at
identical cells stay distinct), `path.ts` (L2: `planFor` readback from
the same BFS), `execute.ts` (the canonical executor on the `STEP_MS`
grid; `sonicDrop` = softDropOn → tick to floor → softDropOff).
19 tests in `bot.test.ts`, green on first run.

**Verified properties** (the spec's core claim — no mocked physics):
empty-board counts 34/17/9 per piece, all hard-drop-only; TSD chamber
found as spin-full + executes to the engine's own `T-SPIN DOUBLE`; the
kick-only TST (SRS kick index 4) found + executes to `T-SPIN TRIPLE`;
I-tuck under a ledge (`hardDropOnly: false`) + its rest-on-top twin
(`true`); hold enumeration (plans prefixed `hold`, skipped when used or
same-piece); determinism; round-trips across random marathon/cheese
walks and an exhaustive mid-game candidate sweep.

**Decisions**: plans assume inputs-faster-than-gravity (stated in
enumerate.ts header; executor ticks 5ms/step, level-1 gravity is
~1000ms/row) — high-gravity live driving is an L6 driver concern, not a
plan concern. `searchPiece` is exported for L3+ (eval wants candidates
*with* plans without re-searching). No memoization yet — searches are
sub-ms; add it when `suggest()` exists.

**Open threads**: M3 remains — CLI demo, perf ceiling assert, corpus
expansion (survival-rise boards), `docs/bot.md`. Mini-spin fixture
(T-spin mini label agreement) worth adding to the M3 corpus. The
concurrent client-stream lockstep work has 1 failing test + 1 lint error
in `src/net/` at time of writing — theirs, in flight, not touched here.

## 2026-06-10 — bot-core M0 shipped (shared substrate)

**This session** (same session as the foundations interview below — M0 was
small enough to execute directly): pure `fits(board, type, rot, x, y)` in
`pieces.ts`; pure 3-corner T-spin rule in new `spin.ts`; `Position` type
in `types.ts` + `Engine.snapshot()`. Engine delegates everywhere (`canFit`
→ `pieceFits` → `fits`; `detectTSpin` → `spin.ts`) — no behavior change,
`REPLAY_VERSION` untouched. Direct unit tests in
`src/engine/substrate.test.ts` (13 tests); full suite 139 green.

**Cross-stream flags** (engine ground, concurrent with pedagogy's
training-core M0 which landed `board.ts`/`goals.ts`/`setBoard`/`setQueue`/
`place()`/lesson mode in the same working tree):
- Their private `Engine.pieceFits` now delegates to the pure `fits` —
  one collision implementation in the codebase; metrics in their
  `board.ts` are exactly the L3 feature primitives the bot stream will
  consume later, as their header comment anticipates.
- Fixed a broken import in their `board.ts` (`PIECE_CELL` from `./types`
  → `./pieces`; it failed all 6 engine test files at runtime) and
  converted `goals.ts` constructor parameter properties to explicit
  fields (TS1294 under `erasableSyntaxOnly`; broke the build). Both
  mechanical, semantics-preserving fixes, flagged here rather than
  asked-first because they blocked the shared suite/build.
- Working-tree note: three streams were editing concurrently this
  session (bot, pedagogy training-core, client net/lockstep);
  transient red states belonged to in-flight edits, not landed work.
  Green-at-session-end is per-stream best-effort under tandem editing.
- `spin.ts` is the one true T-spin rule: anyone touching spin detection
  edits the pure function, not the engine.

**Next**: bot-core M1 (the enumerator) in a fresh session.

## 2026-06-10 — Foundations interview → `specs/bot-core.md` (L0–L2)

**This session**: No code. Extended foundations interview with the user
(architecture, abstraction level, use cases, human-likeness, LLM role),
then wrote `specs/bot-core.md` — the first build spec, scoped to
Position (L0) + placement enumerator (L1) + placement→keypress
pathfinder (L2). Execute it milestone-by-milestone in fresh sessions.

**Decisions agreed** (recorded in the spec's layer map; don't relitigate):
- The bot stream builds tetra's **intelligence layer**: a queryable
  6-layer stack (Position → enumerate → path → eval → detectors →
  policy → drivers) consumed via four query shapes (suggest / analyze /
  play / generate) by ~22 use cases inventoried in-session.
- **Placements are the native unit**; one pathfinder translates down to
  keypresses. Everything above L2 is data-parameterized: strategies,
  difficulty tiers, mode objectives = weight profiles + gates, i.e.
  content, not architecture.
- **Heuristic-first with search depth as a dial** — human-facing bots
  default shallow (current piece + 1 preview, gated feature vocabulary:
  how humans actually play per the research); the deeper searcher is an
  offline grading/mining oracle only. Deep RL + learned human-likeness
  stay deferred; Cold Clear WASM remains the L5 fallback oracle.
- **LLM (user raised, then deferred)**: if it ever lands, it sits *above*
  the layer narrating detector facts — never below it making judgments.
  Strengthens the case for the interpretable core; nothing to build now.
- "Good move" is always **board + explicit frame** (mode × declared
  technique × player level); the bot never grades against an undeclared
  objective.

**Cross-stream flags**: the spec's M0 touches shared engine ground —
extract pure `fits()` (collision) and pure 3-corner T-spin detection
(engine delegates; no behavior change, `REPLAY_VERSION` untouched), add
`Engine.snapshot()`. pedagogy's training-core M0 (place-by-spec, board
metrics, GoalSpec) is explicitly out of scope here; possible later dedup
of board primitives noted in both specs' lanes. `finesse.ts` unchanged —
the enumerator cross-validates against it on empty boards.

**Open threads**: L3 feature set + portable weights (Dellacherie/BCTS/
Cold Clear) is the next spec after bot-core ships; visuals
(reachability/candidate ghosts) are a cheap consumer once L1 exists —
park in IDEAS.md territory until a UI stream wants it.

## 2026-06-09 — Bot/engine substrate research executed

**This session**: Executed `specs/bot-engine-research.md` — six parallel
research passes (Tetris cognition, chess.com/lichess engine teardowns, bot
landscape, human-like AI + replay data, coaching mechanisms, choice/
explanation evidence), synthesized into `research/bot-engine.md`
(committed). No code, no engine changes; tests/lint/build green.

**Headline verdicts** (full reasoning + citations in the report):
- **Chess analogy: fails at the move level, holds at the platform level.**
  Tetris decisions are shallow-wide (lookahead saturates at 1–2 pieces,
  state space converges heavily); but chess platforms mostly use engines as
  offline content factories (puzzles mined once, difficulty graded by user
  attempts) — a consumption pattern that fits a shallow Tetris engine well.
- **Recommended core: hybrid** — placement enumerator + handcrafted-feature
  eval (Dellacherie/BCTS/Cold Clear weights are portable) + hand-written
  concept detectors producing idea-labels. Cold Clear via WASM/TBP as
  strong-oracle fallback (MPL-2.0). Deep RL from raw is two orders of
  magnitude weaker per the literature; learned human-likeness
  (Maia-for-Tetris) is data-gated (TETR.IO has no official bulk replay
  endpoint) — deferred, not foundational.
- **One core serves 5 of 6 consumers** (paused decision-points, review,
  comparison, puzzle mining, live hints). The honest negative: believable
  human-like sparring needs a *separate* model everywhere it's been done
  (Maia, KataGo human-SL); plan the seam (TBP-shaped policy interface),
  hand-tuned systematic degradation (speed/preview/feature-vocabulary
  gates, never random blunders) as sparring v1.
- **Explanations: essential at one-line idea-label depth**, commit-first
  (player places before seeing candidates), fading with skill, never at
  speed (reinvestment theory). The candidate-choice interaction is the
  best-evidenced design in the whole report.

**Decisions**: First build artifact implied by everything: the **placement
enumerator + placement→keypress pathfinder** against tetra's SRS tables —
it's the bridge every bot needs (bots think in placements, our `Action` is
keypresses), and it also powers finesse detection, the RL action
abstraction, and TBP compatibility. RL stack fork stays open but tilted
heuristic-first/TS-native by the evidence.

**Cross-stream flags**: pedagogy — the report's Part 7 decision framework
(concept-type → mechanism, stage-gated) is the bot-side complement to
pedagogy's mode carving; the paused decision-point + review surfaces are
where the two streams meet. client — versus `Opponent` interface should
stay placement-agnostic (a TBP-shaped seam) so any bot tier plugs in.

**Open threads**: tetra's own games are seed+inputs with future benchmark
labels — a first-party replay corpus for a later learned model; worth a
line in any data/telemetry design. Believability A/B ("human or bot?")
protocol when sparring ships.

## 2026-06-09 — Stream opened (docs reorg, no code)

**State at opening**: Research spec written, not yet executed —
`specs/bot-engine-research.md` → deliverable `research/bot-engine.md`.
Centerpieces: the chess-analogy verdict (is per-decision analysis even the
right primitive for Tetris?), the concept-expression mechanism taxonomy,
and the learned vs heuristic vs hybrid comparison. It should cite
`research/pedagogy.md` (now exists), and has explicit permission to conclude
that a single extendable core is the wrong shape.

**Open forks** (stay open until the research lands): RL training stack
(TS-native vs Python+gym vs heuristic-first); whether explanations are
essential; skill-conditioning.

**Likely early milestone regardless of stack**: a headless CLI runner
(`tetra-sim`-style — run N games with a policy, emit metrics as JSON). In
IDEAS.md; pull it into a spec when the time comes.
