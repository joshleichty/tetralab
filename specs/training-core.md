# Spec: Training core — Learn + Progress

Produced 2026-06-09 from an extended interview plus four research passes
(lesson-player teardowns, curriculum extraction, benchmark design, codebase
map). Self-contained; execute milestone-by-milestone in fresh sessions.
Companion reference: `research/pedagogy.md` (the evidence base — cite it,
don't re-derive it).

## Goal

Turn tetra from a client into a trainer by adding the two missing surfaces
of the core improvement loop: **Learn** (interactive lessons that teach
high-level Tetris on real boards) and **Progress** (a fixed benchmark
battery producing per-skill ratings that point at your bottleneck and link
to its lesson). Play already exists and stays clean — no in-game coaching.
The loop: Learn teaches a pattern → Play integrates it → Progress measures
and says what to learn next. This is the first concrete delivery of
VISION.md's "it teaches"; per the pedagogy research it implements the three
highest-ranked no-AI methods (lessons/worked examples, benchmark battery
with weakest-link ratings, retrieval challenges).

**Quality bar (standing directive)**: cut scope rather than ship anything
janky. Fewer lessons, immaculate. The lesson player is the flagship
aesthetic surface of the app — "minimal, quiet, precise" applies to every
animation, caption, and feedback moment.

## Out of scope

- Bot/coach anything: live suggestions, ghost-piece coach, engine review of
  games, style emulation (the bot stream's territory —
  `specs/bot-engine-research.md`; this spec states what it needs from the
  engine substrate but builds no evaluation).
- Replay *viewer* UI (recording + resimulation is in scope; watching
  replays is the review surface, later).
- Spaced-repetition scheduling, daily sets, streaks, gamification.
- Curriculum topics E (garbage/versus theory), F (openers), G (styles) —
  the lesson *system* must support them; the *content* is backlog
  (IDEAS.md) until Tracks A–D are immaculate.
- Online/accounts; everything in `specs/feature-parity.md` (one
  coordination point: the replay format, see Design §4).
- Adaptive drill generation from personal error profiles (needs review
  surface; later).

## Design

### 1. App structure: three sections

Top-level navigation replaces the current single menu: **Play** (existing
mode select, untouched gameplay), **Learn** (tracks → lessons), **Progress**
(benchmark battery + skill profile). Current menu overlay
(`src/ui/Overlays.tsx:15`) becomes Play's home. Navigation is part of the
flagship design pass — quiet, keyboard-navigable.

### 2. The lesson system

**Research-backed shape** (teardowns: Lichess interactive lessons, Brilliant,
Mathigon, Duolingo — see PROGRESS pointer to agent findings and
`research/pedagogy.md` Part 2.2):

- **Hierarchy**: Track → Lesson → Step. Card-by-card, one step per screen;
  the board is the constant frame, only captions/overlays change.
- **Lesson length**: 6–12 steps, 3–5 minutes. Internal arc: concrete demo
  first → guided → challenge → recognition → end on an easy win.
- **Gating**: Mathigon-style interaction gating. `prose`/`demo`/`sandbox`
  advance on Continue; `guidedMove`/`challenge`/`recognition` gate Next
  until the goal fires. Back is always free; forward is earned. Every gated
  step has hint → reveal-solution escalation (revealing still advances, but
  marks the step "revealed, not solved").
- **Feedback choreography**: correct = one quiet precise moment (soft tone,
  gate dissolves); wrong = soft bounce, never a buzzer. No confetti.
  Brilliant's micro-feedback discipline at instrument calibration.

**Six step primitives** (discriminated union — the complete vocabulary;
adding a lesson never means new UI):

```ts
type Step =
  | { kind: 'prose';      board: BoardSpec; caption: string; shapes?: Annotation[] }
  | { kind: 'demo';       board: BoardSpec; script: Placement[]; caption: string; shapes?: Annotation[] }
  | { kind: 'guidedMove'; board: BoardSpec; solution: Placement[]; caption: string;
      hint?: string; mistakes?: { match: Placement; message: string }[] }
  | { kind: 'challenge';  board: BoardSpec; queue: PieceType[]; goal: GoalSpec; caption: string;
      hint?: string; solution?: Placement[] }
  | { kind: 'recognition'; board: BoardSpec; prompt: string;
      answer: CellRef | number; choices?: string[]; hint?: string }
  | { kind: 'sandbox';    board: BoardSpec; caption?: string; overlay?: 'roughness' | 'wellDepth' }
```

- `guidedMove` is the Lichess core: board constrains input to the scripted
  placement(s); wrong placements bounce with optional per-mistake messages.
- `challenge` is outcome-constrained, not move-constrained: free play, the
  engine judges via `GoalSpec` (Execute Program's "runtime is the judge").
- `recognition` is the chunk-recognition quiz (tap a cell/column, or pick
  from 2–4 choices, first-correct shuffled) — the one thing Lichess can't
  do and the heart of pattern teaching.

**GoalSpec** is declarative data (e.g. `{ kind: 'noNewHoles', pieces: 10 }`,
`{ kind: 'clearLines', n: 2, label: 'T-SPIN DOUBLE' }`,
`{ kind: 'maxBumpiness', value: 2 }`, `{ kind: 'wellPure', column: 9 }`),
compiled to predicates evaluated **in the engine layer** over state +
events. Same predicates later serve as RL reward components — one
definition, two consumers. Board metrics needed: holes count, bumpiness,
well purity/depth, stack height (new pure functions in `src/engine/`).

**Lesson data**: lessons are TypeScript data modules
(`src/lessons/<track>/<lesson>.ts`) exporting
`{ id, track, title, steps: Step[] }`. No markdown DSL, no parser — typed
data + engine types. `BoardSpec` is a row-string grid (fumen-style
`'LLL_______'` rows) parsed to the engine's `Uint8Array`; **import from
fumen strings** supported via the MIT `tetris-fumen` npm package
(authoring: paste community fumen, get a BoardSpec) — fumen is interchange,
never the runtime format. `Annotation` is a tiny declarative vocabulary:
highlight cells, outline a ghost placement, mark a column, arrow.

**Headless-first invariant**: every lesson must be machine-verifiable with
no DOM — a vitest harness instantiates each lesson, auto-plays each
`guidedMove`/`challenge` solution through the engine, and asserts goals
fire. A lesson that can't pass its own solution fails CI.

### 3. Curriculum (v1 content: Tracks 0 + A–D, 27-28 lessons)

Full extraction with board states, challenges, and sources lives in the
research pass; summary of what ships (order mirrors the howtotetris spine —
discipline before flash):

- **Track 0 — Controls & handling (3)** *(added 2026-06-10, user-agreed:
  the beginner on-ramp Track A assumes)*: moving pieces (move/rotate/
  soft/hard drop, ghost, hold, preview); DAS/ARR and why settings matter
  (doubles as an interactive handling tuner); reading the board (clears,
  wells, what a hole costs). Skippable by construction — passing A1's
  challenge proves it unnecessary. Same predicate discipline: every
  lesson ends in a measurable do-it, never a "got it" button.
- **Track A — Stacking & well discipline (6)**: flat-9 + dedicated well;
  bumpiness; don't make holes; no piece dependencies; 9-0 vs 6-3; counting
  to 4 (Tetris readiness). Sources: winternebs general/sprint, four.lol
  /stacking/tetris.
- **Track B — Finesse (6)**: what 2-step finesse is; never tap 3×; move-
  then-rotate order; rotate toward DAS; the column exceptions; DAS
  tap-back. Sources: four.lol/mid-game/finesse, harddrop Finesse, galactoid.
- **Track C — Downstacking (6)**: what cheese is; clean obvious stacking;
  don't block your next holes; block-efficiency benchmarks; preview-driven
  digging; skimming. Sources: winternebs cheese, four.lol/mid-game/skimming.
- **Track D — T-spins (7)**: 3-corner rule; full vs mini; the TSD overhang;
  spin-by-kick detection; TST; Fin/Neo/Iso (may cut if quality demands —
  it's the most advanced); forecasting. Sources: four.lol/srs/t-spin,
  winternebs tspin.

Each lesson = one concept, ends with a do-it challenge whose pass condition
uses community numbers where they exist (e.g. C4 challenge: clear cheese-18
under a block budget derived from the winternebs tiers).

### 4. Replays + derived stats (the substrate)

Codebase facts (from the exploration pass): the engine is fully
deterministic — seed + action sequence + tick timings reproduce a game
exactly; nothing records them today (events are drained and dropped at
`src/game/controller.ts:216`).

```ts
interface Replay {
  v: 1
  seed: number
  mode: Mode
  config: Partial<EngineConfig>
  frames: Array<{ dt: number; actions: Action[] }>   // per rAF frame
}
```

- A `ReplayRecorder` taps `GameController`'s dispatch + frame loop
  (`controller.ts:185`); recording is always-on for real games, capped
  (e.g. last 20 games) in localStorage following the `settings.ts`
  persistence pattern.
- **Resimulation** (headless): construct `Engine(seed, mode, config)`, feed
  frames, capture events → derived per-piece stats: KPP, finesse faults
  (vs the finesse table), holes created, surface roughness timeline,
  downstack efficiency. CLI-callable first (a `tetra-stats` style entry
  usable from vitest/node), UI later.
- **Coordination**: `specs/feature-parity.md` has "replays baseline?" open —
  this format is the answer; that spec should adopt it, not invent one.

### 5. Finesse table

Derive, don't transcribe (research conclusion: no machine-readable
sequence table exists; FinesseTrainer has counts only, harddrop is
human-tables behind 403):

- BFS over the input alphabet {tap L/R, DAS L/R (one step), CW, CCW, drop}
  from spawn state to every reachable (column, rotation) on an empty board,
  SRS kicks applied, 0G assumed. Output: minimal input sequence(s) per
  placement, snapshotted to a generated JSON artifact + loader.
- Primary table excludes 180 (community standard); flag for a 180 variant
  later.
- Validate in tests against the FinesseTrainer count table (counts must
  match) and the four.lol examples.
- Consumers: lesson Track B (guided moves show the optimal sequence),
  replay stats (fault counting), Progress finesse test.

### 6. Benchmark battery + skill profile (Progress)

**Four skills, four tests** (formats per the benchmark research):

| Skill | Test | Score | Notes |
|---|---|---|---|
| Speed | 40L sprint | time | exists; seed pool |
| Downstacking | cheese-18 race | blocks placed (primary), time (tiebreak) | exists; seed pool needs calibration |
| Attack | blitz (120s) | score | exists; seed pool |
| Finesse | new: 50-piece prescribed-placement test | faults + KPP | fixed sequence is contamination-safe |

- **Seed pools**: each test draws randomly from a fixed pool of ~30
  calibrated seeds (deterministic engine makes every run reproducible;
  pool prevents memorizing "the" board). Cheese pool must be variance-
  calibrated (run a scripted player over candidates, drop outliers).
- **Scoring**: raw score → **energy 0–1200** by linear interpolation
  between per-band thresholds anchored to community numbers (winternebs
  sprint tiers: 20s→1200, 30s→~800, 44s→~400; cheese blocks: <250→1200,
  300→~600, 400→~100; KPP: 2.6→1200, 3.0→~600). Assessment number =
  **median of 3 runs** (best-ever kept separately as the PB).
- **Aggregation**: per-skill = median-of-3 energy; **overall = harmonic
  mean across the four skills** (Voltaic's exact mechanism — dominated by
  the weakest skill, zero until every skill has a recent score).
  **Recency window**: scores older than 30 days don't count toward the
  rating (PBs persist) — the rating tracks current form, per VISION.md
  "training instrument," not a trophy case.
- **Bands**: 8 named bands over the 0–1200 scale (D, C, B, A, S, SS, U, X —
  community-legible letters, our own thresholds; explicitly NOT claiming
  TETR.IO rank equivalence).
- **Presentation** (three zoom levels, all pointing at the bottleneck):
  1. Overall band badge + worded callout: "Gated by Downstacking (C)."
  2. Four-axis radar with band rings — the dented axis is the bottleneck.
  3. Per-skill tier table: energy, band color, delta to next band — each
     row links to its Learn track.
- Persistence via the `settings.ts` localStorage pattern
  (`tetra.progress.v1`).

### 7. Engine extensions required (all headless, all tested)

From the codebase map — the gaps are small and precise:

- `setBoard(rows: string[] | Uint8Array)` — load arbitrary board state
  (validates, recomputes derived state).
- `setQueue(pieces: PieceType[])` — scripted queue overriding the bag
  (bag resumes after).
- Step control: allow `applyAction`/`tick` in a lesson-controlled state
  (today both no-op unless `status === 'playing'`, `engine.ts:119,152`).
- Board metrics module: holes, bumpiness, well depth/purity, height —
  pure functions, also the GoalSpec substrate.
- Placement application by spec: `place({ type, rot, x })` for demo
  scripts and lesson auto-verification (compute via existing `canFit`
  /`ghostY`, `engine.ts:284–292`).
- Engine stays pure: no DOM, seeded RNG only (CLAUDE.md invariant);
  `engine.test.ts` (28 passing) grows with every addition.

## Milestones

Each lands green (tests/lint/build) and is independently shippable. Cut
from the end, never compress quality.

- [x] **M0 — Engine substrate** *(2026-06-10)*: setBoard, setQueue, step control,
  place-by-spec, board metrics, GoalSpec compiler; finesse table generator
  + JSON artifact validated against FinesseTrainer counts. Done when: all
  new APIs have vitest coverage; finesse counts match the reference table
  for all 7 pieces × rotations × columns.
- [x] **M1 — Replays** *(2026-06-10; format/recorder/persistence had
  already landed via the client stream — this milestone delivered the
  stats layer + press-log fidelity)*: Replay format, always-on recorder,
  headless resimulation producing per-piece stats (KPP, faults, holes,
  roughness, downstack efficiency); localStorage persistence with cap.
  Done when: a recorded game resimulates to an identical final state
  (asserted in tests) and stats are CLI-derivable from a stored replay.
- [x] **M2 — Lesson runtime (headless)** *(2026-06-10)*: Step types, lesson
  state machine (gating, hint/reveal, progress), fumen import, annotation
  model; the vitest lesson-validation harness. Done when: a sample lesson
  of all six step kinds passes the harness with zero React imported.
- [ ] **M3 — Lesson player UI + Track A** *(built 2026-06-10; awaiting the
  design-review sign-off that closes it)*: the flagship surface — card
  grammar, board annotations, feedback choreography, track/lesson
  navigation, progress persistence; Track A's 6 stacking lessons authored
  and polished. Read `docs/quality-bar.md` before starting this milestone.
  Done when: Track A is completable end-to-end, every lesson passes the
  harness, and the player meets the quality bar in a manual design review
  (user sign-off).
- [ ] **M4 — Tracks 0, B, C, D**: controls/handling on-ramp, finesse
  (table-driven), downstacking, T-spins content. Done when: all lessons
  pass the harness; Track B guided moves display optimal sequences from
  the generated table; D6 (Fin/Neo/Iso) explicitly cut if it can't be
  made immaculate. (Track 0 lands here, not M3, to keep the M3 design
  gate focused on Track A as the flagship review content.)
- [ ] **M5 — Progress**: finesse test mode; seed pools (cheese calibrated);
  energy curves + harmonic-mean rating + recency window; the profile page
  (badge/callout, radar, tier table) with links into Learn. Done when: a
  full battery run produces a stored profile whose bottleneck callout
  links to the right track, and rating math has direct unit tests.
- [ ] **M6 — Integration & landing**: three-section navigation, docs
  (`docs/learn.md`, `docs/progress.md` with read_when headers), update
  `docs/engine.md` for new APIs, PROGRESS.md entry, promote replay-format
  decision to the parity spec, archive this spec's research notes. Done
  when: lint/build/test green and a fresh session can navigate the app's
  three sections without dead ends.

## Verification

- **Automated**: `npm test` includes — engine extension tests; finesse
  table cross-validation; replay round-trip determinism; the lesson
  harness over every shipped lesson; rating-math unit tests (energy
  interpolation, harmonic mean, recency window, median-of-3).
- **End-to-end (manual)**: complete Track A as a user; deliberately fail a
  guidedMove (bounce + message), use hint then reveal (advances, marked
  revealed); run the full battery twice and confirm the profile updates,
  the radar dents at the weakest skill, and its link opens the right
  track.
- **Quality gate**: the M3 design review is a hard gate — if the lesson
  player doesn't feel like the best surface in the app, M4+ wait.
- **Invariants intact**: engine purity (no DOM imports under
  `src/engine/` — assert via lint or a test), all pre-existing modes
  unaffected (existing 28 tests still green).
