# Spec: Bot core L0–L2 — Position, placement enumerator, keypress pathfinder

**Stream**: bot (`progress/bot.md`). Produced 2026-06-10 from the
foundations interview following `research/bot-engine.md`. Self-contained;
execute milestone-by-milestone in fresh sessions.

## Goal

Build the bottom three layers of tetra's intelligence layer: a pure
**Position** value (L0), a **placement enumerator** that finds every
reachable final placement on a real board (L1), and a **pathfinder** that
turns any reachable placement into a keypress plan the engine will actually
execute (L2). This is the bridge every consumer needs — bots think in
placements (`{rot, x, y}`), tetra's engine speaks keypresses (`Action`) —
and it is engine-specific by nature (it must respect tetra's exact SRS+
kick tables, spawn rules, and timing), so it cannot be borrowed. Per
VISION.md it is the substrate under everything that teaches: candidate
display, review grading, puzzle mining, sparring, finesse analysis, and
the future RL action abstraction all stand on knowing *what is possible*
and *how to physically do it*.

### The layer map (context for fresh sessions)

The bot stream's agreed architecture. This spec builds L0–L2 only; the
upper layers are listed so the bottom is built with the right shape:

```
L0  Position        plain value: board + piece + queue + hold (+ holdUsed)
L1  Enumerator      Position → Placement[]            (what is reachable)
L2  Pathfinder      Position × Placement → InputPlan  (how to get there)
L3  Eval            Position × Placement × Weights → {score, features}   [later]
L4  Detectors       Position × Placement → ConceptTag[]                  [later]
L5  Policy          Position × Profile → Placement  (TBP-shaped seam)    [later]
L6  Drivers         Policy → Opponent | Analyzer | CLI runner            [later]
```

Standing decisions from the interview (don't relitigate in execution
sessions): placements are the native unit everywhere above the engine;
everything above L2 is data-parameterized (weights, profiles, detector
registries — content, not architecture); heuristic-first with search depth
as a dial, deep RL and learned human-likeness deferred; LLMs (if ever) sit
*above* the layer consuming detector facts, never below it making
judgments; human-facing bots default to shallow human-like search, the
deep searcher is an offline grading oracle.

## Out of scope

- **Evaluation of any kind** (L3+): no features, no weights, no "best
  move", no scoring. The enumerator returns *all* placements, unranked.
- Concept detectors, policies, difficulty ladders, archetypes, sparring.
- Any UI. Headless/CLI-first per CLAUDE.md; visuals consume this later.
- Cold Clear / TBP adapter (L5 concern; the Placement shape stays
  TBP-compatible so the adapter is cheap later).
- Board metrics, GoalSpec, place-by-spec — the pedagogy stream's
  training-core M0 owns those. Shared primitives may be deduped *later*;
  do not reach into their lane now.
- DAS/ARR simulation. The engine has no DAS (it's a controller concept);
  plans are discrete taps. Finesse *counting* already exists
  (`src/engine/finesse.ts`) and is unchanged by this spec.

## Design

### Files

```
src/bot/types.ts        Position, Placement, PlanStep, InputPlan
src/bot/position.ts     snapshot/clone helpers
src/bot/enumerate.ts    L1 BFS (placements + parent pointers)
src/bot/path.ts         L2 plan readback
src/bot/execute.ts      canonical plan executor (drives a real Engine)
src/bot/bot.test.ts     unit + property tests
src/bot/cli.ts          tiny demo entry (see M3)
```

`src/bot/` obeys the same purity rules as `src/engine/` (no DOM, no
wall-clock, no unseeded randomness) and imports engine modules
(`pieces.ts`, `srs.ts`, `types.ts`) — never the reverse.

### Shared-engine changes (flag in the progress entry — other streams stand on these)

1. **Pure collision**: extract a free function
   `fits(board: Uint8Array, type: PieceType, rot: Rot, x: number, y: number): boolean`
   (into `src/engine/pieces.ts` or a new `src/engine/board.ts`);
   `Engine.canFit` delegates to it. Pure, board-as-argument — the
   enumerator's inner loop and (later) pedagogy's metrics both want it.
2. **Pure T-spin detection**: extract the 3-corner rule from
   `Engine.detectTSpin` (`engine.ts:396`) into a pure function taking
   `(board, piece, lastMoveWasRotation, lastKickIndex)`; the engine
   delegates. The enumerator must label spins identically to the engine —
   one implementation, two callers, zero drift.
3. **`Engine.snapshot(): Position`** — copies board + active type + queue
   + hold + holdUsed into a plain value. The bot layers never take an
   `Engine` instance: positions also come from replays, authored boards,
   and branches.

No rule changes, no replay-visible behavior changes (`REPLAY_VERSION`
untouched). Existing 126 tests must stay green through the refactor.

### L0 — Position

```ts
interface Position {
  board: Uint8Array          // copy, BOARD_W × BOARD_H, same cell encoding
  piece: PieceType           // the piece to place (engine: active.type)
  queue: PieceType[]         // visible previews
  hold: PieceType | null
  holdUsed: boolean
}
```

A value, never a live reference. `snapshot()` copies; `position.ts` also
offers `fromRows(rows: string[], …)` for test fixtures (row-string grid,
same convention the pedagogy spec uses for BoardSpec — coordinate, don't
share code yet).

### L1 — Enumerator

```ts
interface Placement {
  type: PieceType
  rot: Rot
  x: number; y: number       // bounding-box origin at lock, engine coords
  cells: Array<[number, number]>
  spin: 'none' | 'mini' | 'full'    // T pieces only, engine-identical rule
  usedHold: boolean
  hardDropOnly: boolean      // reachable without soft drop
}

function enumerate(pos: Position): Placement[]
```

Algorithm — the standard strong-bot construction (Cold Clear's `moves.rs`
shape), on tetra's exact rules:

- **Start state**: the engine's spawn, replicated exactly — `rot 0`,
  `spawnX(type)`, `SPAWN_Y`, including the guideline initial one-row drop
  when unobstructed and the D2 two-row lift when blocked
  (`engine.ts:547–572`). If no spawn cell fits, return `[]`.
- **BFS over (rot, x, y)** with transitions: `left`, `right` (±1 x);
  `cw`/`ccw`/`r180` through `kicksFor` (first fitting kick, exactly the
  engine's rotate loop incl. kick index); `sonicDrop` (descend to floor —
  models instant soft drop). Track per-state: parent pointer, the action
  that reached it, whether it was a rotation, and the kick index (for spin
  labeling).
- **Terminal states**: any state with no fit at `(x, y+1)` (grounded).
  A grounded state is a candidate *and* BFS continues through it (tucks:
  slide under an overhang after dropping).
- **Dedup by cell set** (placement identity, as `finesse.ts` does): two
  routes to the same cells are one placement; keep the first found (BFS ⇒
  fewest inputs). Spin-relevant T placements are *not* merged across
  distinct `(rot, lastMoveWasRotation, kick)` when the spin label differs —
  a TSD reached by rotation and the same cells reached by sliding are
  different candidates (different label, different score later).
- **Hold**: if `!pos.holdUsed`, also enumerate the hold piece (`hold` if
  set, else `queue[0]`), flagged `usedHold`, plans prefixed with `hold`.
- **Determinism**: fixed transition order ⇒ stable output order; sort the
  final list by `(usedHold, rot, x, y)` for a canonical surface.

Assumption, stated and tested rather than hidden: plans assume inputs are
fast relative to gravity (executor steps at `STEP_MS`; level-1 gravity is
~1000ms/row, soft drop is explicit via `sonicDrop`). High-gravity live
driving is an L6 concern.

### L2 — Pathfinder + executor

```ts
type PlanStep = Action | 'sonicDrop'   // sonicDrop = softDropOn → tick to floor → softDropOff
interface InputPlan { steps: PlanStep[] }   // ends with 'hardDrop'

function planFor(pos: Position, target: Placement): InputPlan | null
function executePlan(engine: Engine, plan: InputPlan): void
```

- `planFor` is parent-pointer readback from the same BFS (memoized per
  Position); `null` for unreachable targets. Plans end in `hardDrop`
  (the lock); `sonicDrop` mid-plan expresses tucks/spins.
- `executePlan` is the **canonical executor** — the one true semantics of
  a plan: `applyAction` per step on the `STEP_MS` grid; for `sonicDrop`,
  `softDropOn` then tick until descent stops (engine `sdf` must be
  ≥ `INSTANT_SDF` for instant semantics; executor asserts or configures
  it). Tests, demo bots, and future drivers all execute plans only through
  this function — no second interpreter, ever.

## Milestones

Each lands green (`npm test`, `npm run lint`, `npm run build`) and ends
with a progress entry.

- [x] **M0 — Shared substrate** (2026-06-10): pure `fits` (pieces.ts),
  pure T-spin detection (spin.ts), `Engine.snapshot()`; engine delegates
  to the pure functions (incl. the concurrent training-core session's
  `pieceFits`, which now wraps `fits`). All pre-existing tests pass
  unchanged; direct unit tests in `src/engine/substrate.test.ts`;
  shared-engine changes flagged in `progress/bot.md`.
- [x] **M1 — Enumerator** (2026-06-10): `enumerate()` complete (BFS,
  tucks, spins, hold, dedup, spin labels, canonical order). Empty-board
  placement counts match the finesse identity set for all 7 pieces
  (34/17/9); fixtures covered: TSD chamber (soft-drop + rotate-in, spin
  full), the kick-only TST (final (±1,∓2) SRS kick), I tuck under a
  ledge — all with correct `spin`/`hardDropOnly` flags.
- [x] **M2 — Pathfinder + executor** (2026-06-10, with M1): `planFor` +
  `executePlan`. Round-trip property holds: every empty-board placement,
  every placement on a 12-piece mid-game stack (exhaustive), and seeded
  random walks through marathon (30 pieces) and cheese (15) lock exactly
  `placement.cells` in a real `Engine`; TSD/TST plans produce the
  engine's own `T-SPIN DOUBLE`/`T-SPIN TRIPLE` clear labels.
- [ ] **M3 — Property suite + CLI demo**: (a) corpus property test —
  seeded random stacks (drive an engine with a scripted random-placement
  player), cheese boards, and survival-rise boards; full round-trip on
  each; (b) a perf check (enumerate+plan on a realistic mid-game board;
  log the timing, assert a generous ceiling, e.g. <10ms); (c)
  `src/bot/cli.ts`: given a fixture/seed, print the position and every
  placement with its plan (`npx tsx src/bot/cli.ts --seed 42 --pieces 5`)
  — the "headless first" proof. Done when: suite green in CI, CLI output
  is readable, `docs/bot.md` exists (with `read_when` header) describing
  the layer map and the L0–L2 API, and `docs/engine.md` notes
  `snapshot()`.

## Verification

- **The core property** (the spec's reason to exist): *everything the
  enumerator claims is independently proven by the engine* — every
  `Placement` round-trips through `executePlan` on a real `Engine` to an
  identical lock. No mocked physics anywhere in the tests.
- **Completeness cross-checks**: empty-board parity with `finesse.ts`;
  hand-built fixtures with known tuck/spin answers (cite SRS+ cases from
  `parity.test.ts` where applicable).
- **Identity discipline**: dedup never merges placements with different
  spin labels; canonical ordering is asserted (same Position ⇒ identical
  array, twice).
- **Purity**: no DOM/wall-clock/unseeded randomness under `src/bot/`
  (same standard as `src/engine/`); engine refactor leaves all
  pre-existing tests untouched and green.
