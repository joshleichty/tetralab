---
summary: The bot layers (L0–L3) — Position, placement enumerator, keypress pathfinder, evaluation/suggest; the intelligence layer.
read_when: touching src/bot/, building detectors/policies on top, or anything that needs "what placements exist, how to execute them, and how good they are".
---

# Bot layers (`src/bot/`)

The bottom four layers of tetra's intelligence layer (bot stream;
`specs/bot-core.md` L0–L2, `specs/bot-eval.md` L3; research in
`research/bot-engine.md`). Pure, headless, deterministic — same rules as
`src/engine/` (no DOM, no wall-clock, no unseeded randomness); imports
engine modules, never the reverse.

## The layer map

```
L0  Position        plain value: board + piece + queue + hold (+ holdUsed)
L1  Enumerator      Position → Placement[]            (what is reachable)
L2  Pathfinder      Position × Placement → InputPlan  (how to get there)
L3  Eval            suggest(pos, profile) → ranked + per-feature "why"
L4  Detectors       Position × Placement → ConceptTag[]                  [later]
L5  Policy          Position × Profile → Placement  (TBP-shaped seam)    [later]
L6  Drivers         Policy → Opponent | Analyzer | CLI runner            [later]
```

Standing decisions (from the foundations interview — don't relitigate):
placements are the native unit above the engine; everything above L2 is
data-parameterized (weights/profiles/detector registries = content, not
architecture); heuristic-first with search depth as a dial; LLMs (if
ever) sit above the layer consuming detector facts; human-facing bots
default to shallow human-like search, the deep searcher is an offline
oracle.

## Files & API

- `types.ts` — `Placement` (`{type, rot, x, y, cells, spin, usedHold,
  hardDropOnly}`), `InputPlan` (`PlanStep[]`, always ends `hardDrop`;
  `'sonicDrop'` = softDropOn → tick to floor → softDropOff)
- `position.ts` — `positionFromRows(rows, piece, opts)` fixture builder
  (bottom-aligned row strings, `engine/board.ts` format); live positions
  come from `Engine.snapshot()`
- `enumerate.ts` — `enumerate(pos)` → all reachable placements, canonical
  order; `enumerateCandidates(pos)` keeps each placement's plan;
  `searchPiece` is the underlying BFS
- `path.ts` — `planFor(pos, placement)` → `InputPlan | null`
- `execute.ts` — `executePlan(engine, plan)`: the **canonical executor**,
  the one true semantics of a plan (applyAction/tick on the `STEP_MS`
  grid). No second interpreter, ever.
- `cli.ts` — demo: `node src/bot/cli.ts --seed 42 --pieces 5
  [--mode cheese]` (plain Node ≥ 23; keep the runtime import chain
  .ts-suffixed)

## How the enumerator works (and why it's trustworthy)

BFS over piece states (rot, x, y) that mirrors the engine exactly: spawn
replicates the D2 two-row lift + guideline initial drop; rotations run
the engine's kick loop (first fitting kick, kick index recorded); spins
use the same pure 3-corner rule the engine uses (`engine/spin.ts`).
Candidates are emitted per *edge*, so sliding into a slot (spin `none`)
and rotating into identical cells (spin `full`) remain distinct
candidates — L3 will score them differently. Dedup identity is
cells + spin label.

**The core property, enforced by tests (`bot.test.ts`): every placement
the enumerator claims is proven by executing its own plan in a real
`Engine` and matching the lock cells (and clear labels for spins). No
mocked physics.** Verified across: empty boards (placement sets =
finesse identities, 34/17/9), TSD chamber, kick-only TST (SRS kick
index 4), wall mini (`T-SPIN MINI SINGLE`), I-tuck under a ledge,
random marathon/cheese walks, rising-garbage boards, and an exhaustive
mid-game sweep.

## L3 — evaluation (`specs/bot-eval.md`)

- `outcome.ts` — `placementOutcome(board, placement, ctx)`: pure lock
  simulation (collapse, eroded cells, perfect clear) + attack from
  tetra's own table (`engine/attack.ts`); `EvalContext = {b2b, combo}`
  (engine counters entering the placement; `Engine.b2b/combo` are public)
- `features.ts` — the registry: published predictive features
  (Dellacherie/BCTS: landingHeight, erodedPieceCells, row/column
  transitions, holes, cumulativeWells, holeDepth, rowsWithHoles) +
  concept-named ones (holesCreated, maxHeight, bumpiness, deepestWell,
  tslots, b2bBroken, comboContinued, attack, perfectClear, linesCleared).
  Every feature: a name, a doc line, a hand-computed test. `tslots`
  counts grounded rot-2 full-spin rests that would clear — overhung and
  under-construction slots included.
- `profiles.ts` — strategies as data: `dellacherie`/`bcts` (published
  weights verbatim — calibration anchors: they must survive sprint-40 or
  our features are wrong), `clean` (downstack), `versus` (attack/B2B/
  T-slot economy). Hand-seeded profiles are tuned via run.ts.
- `suggest.ts` — the L3 query: ranked `Suggestion[]`, `score` = exact sum
  of `contributions` (tested invariant). `lookahead: 1` re-ranks the top
  `lookaheadWidth` (10) candidates by best follow-up with the next known
  queue piece.
- `selfplay.ts` / `run.ts` — greedy self-play + the benchmark CLI:
  `node src/bot/run.ts --profile versus --mode endless --games 10
  [--lookahead 1]` → JSON (per-game + aggregate). Modes sprint | cheese |
  endless (level-1 only; endless = survival with the rise timer off).
- `benchmarks.test.ts` — pinned behavioral gates (deterministic, not
  statistical): dellacherie completes sprint-40; clean out-digs versus on
  cheese; versus >2× dellacherie attack/piece on endless; lookahead-1
  out-digs greedy. Measured 2026-06-10: clean cheese-18 median 87.5
  pieces (70.5 with lookahead), versus 0.285 attack/piece vs
  dellacherie's 0.0275.

## Assumptions & boundaries

- Plans assume inputs fast relative to gravity (executor steps 5 ms;
  level-1 gravity ~1000 ms/row; descent is explicit via `sonicDrop`).
  High-gravity live driving is an L6 driver concern.
- No memoization yet — searches are sub-ms (perf test asserts < 10 ms
  with plans, both pieces); add caching when `suggest()` exists.
- The pedagogy stream's board metrics (`engine/board.ts`) are the L3
  feature primitives; evaluation itself lives here, not there.
