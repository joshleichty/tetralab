---
summary: The bot substrate (L0–L2) — Position, placement enumerator, keypress pathfinder; the bottom of the intelligence layer.
read_when: touching src/bot/, building evaluation/policies/detectors on top, or anything that needs "what placements exist and how to execute them".
---

# Bot substrate (`src/bot/`)

The bottom three layers of tetra's intelligence layer (bot stream;
`specs/bot-core.md`, research in `research/bot-engine.md`). Pure,
headless, deterministic — same rules as `src/engine/` (no DOM, no
wall-clock, no unseeded randomness); imports engine modules, never the
reverse.

## The layer map

```
L0  Position        plain value: board + piece + queue + hold (+ holdUsed)
L1  Enumerator      Position → Placement[]            (what is reachable)
L2  Pathfinder      Position × Placement → InputPlan  (how to get there)
L3  Eval            Position × Placement × Weights → {score, features}   [next]
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

## Assumptions & boundaries

- Plans assume inputs fast relative to gravity (executor steps 5 ms;
  level-1 gravity ~1000 ms/row; descent is explicit via `sonicDrop`).
  High-gravity live driving is an L6 driver concern.
- No memoization yet — searches are sub-ms (perf test asserts < 10 ms
  with plans, both pieces); add caching when `suggest()` exists.
- The pedagogy stream's board metrics (`engine/board.ts`) are the L3
  feature primitives; evaluation itself lives here, not there.
