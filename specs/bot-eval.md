# Spec: Bot eval L3 — features, profiles, suggest()

**Stream**: bot (`progress/bot.md`). Produced 2026-06-10 from the
strategy/published-weights interview, on top of the completed
`specs/bot-core.md` (L0–L2: Position, enumerator, pathfinder — see
`docs/bot.md` for the layer map and API). Self-contained; execute
milestone-by-milestone in fresh sessions.

## Goal

Give the intelligence layer its opinions: a **feature layer** over
candidate placements, **named weight profiles** (the published,
battle-tested sets as seeds), and the **`suggest(position, profile)`**
query returning ranked candidates with inspectable per-feature score
breakdowns. This is the first layer that can say "this placement is
better, and here is why" — the substrate for review grading, paused
decision-points, puzzle mining, and sparring policies (all L5/L6
consumers, later specs). Per VISION.md and `research/bot-engine.md`
§4.5: heuristic-first, fully interpretable, zero data required.

### Standing decisions (from the interviews; don't relitigate)

- **Strategies are profiles, not architectures.** 9-0 vs 6-3 is a well
  parameter; LST leanings are T-slot weights; downstacker vs versus is
  a vector swap. The feature set is shared; profiles are data.
- **Published sets are anchors, not the destination.** Dellacherie/BCTS
  encode classic *marathon survival* (no T-spins, no B2B, no attack);
  Cold Clear's published weights encode *guideline versus*. Port the
  **feature functions** as the durable asset; ship the published vectors
  as named profiles for credibility + calibration; expect to retune for
  tetra's attack table via self-play (M2's harness is the instrument).
- **Features carry the human vocabulary.** The set is a *union*:
  published predictive features (transitions, eroded cells, landing
  height) plus concept-named ones (holes created, well purity, T-slot
  created/wasted). Concept-named features double as the seed of L4's
  detector/explanation layer.
- **Not weights, not here**: openers (book data), perfect-clear hunting
  (dedicated solver), 4-wide (constraint + combo profile) — pluggable
  modules in later specs. Live battle context (incoming garbage,
  spike timing) is an L5/L6 concern; L3 accepts an optional context
  (`b2b`, `combo`) but works board-only.

## Out of scope

- L4 explanations/idea-labels, L5 policies/difficulty/archetype tuning,
  L6 live drivers and the versus `Opponent` adapter.
- Lookahead beyond 1 piece; transposition/DAG search; any RL.
- Openers, PC solver, 4-wide modules (above).
- UI of any kind. Engine changes of any kind (L3 is pure consumer; the
  one allowed touch is *optional* — see M1 note on snapshot context).
- Tuning to beat Cold Clear. The bar is "credible, explainable,
  profile-differentiated", not maximum strength (the strong-oracle
  fallback remains Cold Clear WASM behind L5, per bot-core).

## Design

### Files

```
src/bot/outcome.ts     pure placement → resulting board + clear result
src/bot/features.ts    feature functions (registry, names, docs)
src/bot/profiles.ts    named weight vectors (data)
src/bot/suggest.ts     suggest(pos, profile, opts) → Suggestion[]
src/bot/run.ts         benchmark/self-play CLI (JSON metrics out)
src/bot/*.test.ts      per-module tests
```

Same purity rules as the rest of `src/bot/` (no DOM, no wall-clock, no
unseeded randomness; .ts-suffixed runtime imports so `run.ts` works on
plain node).

### `outcome.ts` — simulate the lock, purely

```ts
interface PlacementOutcome {
  after: Uint8Array        // board with placement applied and rows collapsed
  linesCleared: number
  /** placed-piece cells that were in cleared rows (Dellacherie "eroded") */
  erodedPieceCells: number
  spin: Spin               // from the placement (enumerator already labeled it)
  perfectClear: boolean
  attack: number           // tetra's own attackFor() with context (b2b/combo)
}
function placementOutcome(board: Uint8Array, p: Placement, ctx?: EvalContext): PlacementOutcome
```

Uses `attackFor` from `engine/attack.ts` (tetra-native attack table —
better than porting Cold Clear's assumptions). `EvalContext = { b2b:
boolean; combo: number }`, default `{ b2b: false, combo: 0 }`.

### `features.ts` — the union feature set

Each feature is a named pure function `(board, placement, outcome) →
number`, registered in a typed record so profiles, breakdowns, and docs
share one name list. Reuse `engine/board.ts` metrics (holes, bumpiness,
columnHeights, wellDepth, isWellPure) — import, don't duplicate.

Published set (cite definitions in comments — Dellacherie via the
codemyroad/Thiery-Scherrer formulations, [BCTS]):
`landingHeight`, `erodedPieceCells`, `rowTransitions`,
`columnTransitions`, `holes`, `cumulativeWells`, `holeDepth`,
`rowsWithHoles`.

Versus/concept set (tetra-named, evaluated on the outcome):
`holesCreated` (delta), `maxHeight`, `bumpiness` (well-excluded),
`wellPurity` (chosen-well column clean), `tslotsCreated` (TSD-shaped
notches present after, detectable by running the enumerator's spin
labeling on a hypothetical T — cheap), `tslotWasted` (filled an existing
T-slot without a spin), `b2bPreserved` / `b2bBroken` (from outcome +
ctx), `attack`, `perfectClear`, `comboContinued`.

Exact membership may shrink/grow during M0 — the registry is the
contract; every shipped feature has a direct unit test on a hand-built
board with a hand-computed value.

### `profiles.ts` — named vectors

```ts
interface EvalProfile { name: string; weights: Partial<Record<FeatureName, number>> }
```

Ship four seeds: `dellacherie` (published 6 weights, verbatim, mapped
onto our features), `bcts` (published 8), `clean` (hand-seeded
downstack/survival profile: holes and height dominate, attack ignored),
`versus` (hand-seeded from Cold Clear's published *relative magnitudes*
— holes strongly negative, T-slots positive, B2B/attack positive — not
its literal values, which assume its own search). Unset features weigh 0.

### `suggest.ts` — the query

```ts
interface Suggestion {
  placement: Placement
  plan: InputPlan
  score: number
  features: Record<FeatureName, number>      // raw values
  contributions: Record<FeatureName, number> // value × weight (the "why")
}
function suggest(pos: Position, profile: EvalProfile, opts?: {
  context?: EvalContext
  lookahead?: 0 | 1        // default 0; 1 = max over next known piece (M3)
}): Suggestion[]           // sorted best-first, deterministic tiebreak
```

Built on `enumerateCandidates` (plans come free). Deterministic: stable
sort with the canonical placement order as tiebreak. Perf target
inherited from bot-core: depth-0 suggest well under 10ms (it's one
outcome + ~20 features per candidate, ~100 candidates).

M1 note (optional, flag if taken): `Engine.snapshot()` could carry
`b2b`/`combo` so live consumers don't thread context manually — additive
engine touch, coordinate via progress entry as usual.

### `run.ts` — the self-play instrument

`node src/bot/run.ts --profile versus --games 20 --mode cheese --seed 7`
→ one JSON object on stdout: per-game and aggregate metrics (pieces,
lines, attack, attack/piece, blocks-per-cheese-line, topped-out,
completion, elapsed-sim-ms). Greedy policy loop = `suggest()[0]` →
`executePlan`. **Benchmark modes are level-1 only** (sprint, cheese,
survival with `riseStartMs` set huge as the endless playground) — the
plans' inputs-faster-than-gravity assumption breaks at marathon level
~15, and the harness must not race gravity.

## Milestones

Each lands green (test/lint/build) with a progress entry.

- [x] **M0 — Outcome + features** (2026-06-10): `outcome.ts`,
  `features.ts`, 18-feature registry, hand-computed-board tests for the
  scans (empty-board constants, alternating row, covered holes, 3-deep
  well), outcome-vs-real-Engine agreement on the TSD fixture (board
  occupancy + lines + attack). Note: `tslots` scans *all grounded* rot-2
  fits, not straight drops — canonical TSD slots sit under overhangs.
- [x] **M1 — Profiles + suggest()** (2026-06-10): four profiles,
  contributions-sum-to-score asserted for every profile, determinism
  asserted, `versus` ranks the TSD first, orderings visibly differ.
  *Deviation from the milestone text*: dellacherie also likes the TSD
  (eroded cells — it's a 2-line clear to it), so the disagreement test
  uses full-ordering inequality plus a b2b scenario (`versus` refuses a
  chain-breaking single that `dellacherie` takes) — a stronger
  differentiation than the original wording.
- [x] **M2 — run.ts + pinned benchmarks** (2026-06-10): `selfplay.ts`
  (shared game loop, live engine context) + `run.ts` JSON CLI. Measured
  first (seeds 1000+): sprint completion 10/10 both anchor profiles
  (~102 pieces/40 lines, theoretical floor 100); cheese median clean
  87.5 vs versus 134 pieces; endless attack/piece versus 0.285 vs
  dellacherie 0.0275 (10×). Pinned as deterministic gates (seeded ⇒
  exact, not statistical) in `benchmarks.test.ts`.
- [x] **M3 — Lookahead dial + docs** (2026-06-10): `lookahead: 1`
  (top-10 re-rank by best follow-up with the next known piece, chain
  bookkeeping engine-faithful) — cheese median 87.5 → 70.5 pieces
  (−19%), the research's depth-1 claim reproduced and pinned;
  `cli.ts --profile` shows ranked placements with top contributions;
  `docs/bot.md` covers L0–L3. Spec ready to archive.

## Verification

- **Feature truth**: hand-computed values on hand-built boards for every
  feature; published-definition cross-checks for the Dellacherie/BCTS
  set; outcome-vs-real-Engine agreement on the bot-core fixtures.
- **Profile differentiation**: the M1 disagree-test (TSD board) plus the
  M2 behavioral splits (dig efficiency vs attack rate) — profiles must
  *behave* differently in whole games, not just score differently.
- **Strength sanity**: published Dellacherie weights surviving sprint-40
  at high rates is the calibration that our feature implementations are
  faithful (it cleared hundreds of thousands of lines in the literature;
  failing sprint-40 means our features are wrong, not its weights).
- **Determinism + perf**: same position + profile ⇒ identical
  suggestions; depth-0 suggest <10ms asserted alongside the bot-core
  perf test.
- **Interpretability invariant**: every score is exactly the sum of its
  contributions; no feature without a name, a doc line, and a test.
