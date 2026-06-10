# Training-core research notes

*2026-06-09. Supporting research for `specs/training-core.md`, from four
parallel passes: lesson-player teardowns, curriculum extraction, benchmark
design, codebase map. Condensed; the spec carries the decisions, this
carries the evidence and the full curriculum. Companion to
`research/pedagogy.md`.*

---

## 1. Lesson-player teardown conclusions

Products examined: Brilliant, chess.com Lessons, **Lichess interactive
lessons** (closest analog), **Mathigon** (best authoring model, open
source), Duolingo, Execute Program, Orbit/Quantum Country, Nicky Case
explorables.

Key findings adopted into the spec:

- **Lichess**: an interactive lesson is just *a scripted move-tree + a
  prompt comment per move + a hidden hint + per-move error messages*, on a
  board that rejects off-script moves
  ([blog](https://mskchess.ru/blog/WtDErSQAADJfhJJs/interactive-lessons)).
  Authoring is pure data (PGN + `[%cal]`/`[%csl]` arrow/circle
  annotations). → our `guidedMove` + `Annotation` model.
- **Mathigon**: progression is **interaction-gated** — next step hidden
  until the current step's goals fire; authoring splits declarative
  content from a thin per-step code-behind
  ([markdown docs](https://github.com/mathigon/studio/blob/main/docs/markdown.md)).
  → our gating + GoalSpec.
- **Brilliant**: card-by-card, one idea per card, scaffold-then-strip,
  hint → reveal escalation that never hard-blocks, micro-feedback as a
  designed moment ([teardown](https://uxdesign.cc/the-key-to-learning-math-and-science-online-is-interactive-play-6ea68ce167fe)).
- **Duolingo**: 3–5 minute sessions, easy→hard→easy arc, never end on
  failure ([teardown](https://blakecrosley.com/guides/design/duolingo)).
- **Execute Program**: the runtime is the judge (our challenge predicate);
  example↔quiz alternation rhythm.
- **Nicky Case**: concrete experience first, sandbox last.
- Rejected: video (chess.com — heavy, unskimmable, breaks "quiet");
  markdown DSL + parser (Mathigon's stack is overkill at our scale — typed
  TS data wins for board-centric content); PGN (can't express recognition
  quizzes or outcome predicates).

## 2. The full curriculum extraction (35 lessons, 7 topics)

Spec ships Tracks A–D; E–G are backlog. Per lesson: the idea / boards to
show / challenge. Sources: [winternebs TETRIS-FAQ](https://winternebs.github.io/TETRIS-FAQ/)
(general/sprint/cheese/tspin/versus), [four.lol](https://four.lol/)
(trailing slashes required), [galactoid](https://galactoidtetris.wordpress.com/),
harddrop wiki (403s automated fetch; corroborated via snippets).

### Track A — Stacking & well discipline
| # | Lesson | Idea | Challenge |
|---|---|---|---|
| A1 | Flat-9 with a well | 9 columns flat, one dedicated well column | place a bag keeping well pure + surface flat |
| A2 | Bumpiness | flat surfaces accept more pieces | reduce bumpiness below threshold from a jagged board |
| A3 | Don't make holes | a covered empty cell is dead weight | 10 pieces, zero new holes |
| A4 | No piece dependencies | never build a surface only one piece solves | spot the I-dependency; re-stack to remove it |
| A5 | 9-0 vs 6-3 wells | well choice trades ease vs options | maintain a Tetris well after converting |
| A6 | Counting to 4 | track Tetris-readiness of the well | drop I only when well is exactly 4 deep |

### Track B — Finesse
| # | Lesson | Idea | Challenge |
|---|---|---|---|
| B1 | 2-step finesse | every placement reachable in ≤2 movement steps | min-keypress placement, fault counter |
| B2 | Never tap 3× | DAS to wall + tap back beats triple-tap | far columns without 3 same-direction taps |
| B3 | Move-then-rotate | default ordering; rotate after DAS for off-wall spacing | correct order flagged even when column is right |
| B4 | Rotate toward DAS | rotation direction shouldn't fight movement | choose matching rotation direction |
| B5 | Column exceptions | the off-by-one columns that break the rule | execute the exception placements |
| B6 | DAS tap-back | one-off-wall = DAS + one tap | column 2/9 with exactly DAS+tap |

### Track C — Downstacking
| # | Lesson | Idea | Challenge |
|---|---|---|---|
| C1 | What cheese is | garbage rows, one hole each | identify hole columns |
| C2 | Clean obvious stacking | next move should be obvious; no fancy spins | clear 4 rows, no new holes, block budget |
| C3 | Don't block next holes | never seal a hole you still need | staggered garbage without sealing |
| C4 | Block efficiency | blocks/100L is the metric (400 new → <250 advanced) | cheese-18 under block budget |
| C5 | Preview-driven digging | plan ~5 pieces ahead | board solvable only via previewed order |
| C6 | Skimming | non-B2B clear to survive | skim when height crosses danger line |

### Track D — T-spins
| # | Lesson | Idea | Challenge |
|---|---|---|---|
| D1 | 3-corner rule | ≥3 of 4 corners filled = T-spin | classify boards spin/not |
| D2 | Full vs mini | 2 front corners = full | distinguish; build a full not a mini |
| D3 | The TSD overhang | overhang above a 2-row notch | construct + execute from flat |
| D4 | Spin-by-kick | the rotation that triggers the spin | execute the kicking rotation |
| D5 | TST | deep 3-row slot, TST kick | build + execute |
| D6 | Fin/Neo/Iso | last-kick variant spins (cut-candidate) | identify which variant a board enables |
| D7 | Forecasting | stack so a slot is revealed by a clear | set up, uncover, execute |

### Backlog topics (E–G, for later content milestones)
- **E Garbage/versus (5)**: attack values; B2B chaining; combo thresholds
  (<5 worse than a triple, target 7+); spikes; tanking/canceling.
- **F Openers (5)**: why openers; TKI; DT cannon; PCO; tier awareness
  (TKI/MKO reliable, PCO risky).
- **G Styles (5)**: ST stacking; LST; 4-wide 3-residual; center vs side
  4-wide; parity ("nerd trap" framing).
- Extra lesson idea from PPT analysis: hold-priority for T and I.

Ordering validated against the howtotetris book spine (mechanics → habits →
stacking → finesse → sprint → combos → downstacking → T-spins → …,
[guide](https://howtotetris.com/how-to-start-tetris-the-ultimate-beginner-guide/))
and PPT's garbage-handling-before-offense emphasis.

## 3. Fumen + finesse data assessments

- **Fumen**: community-standard board/move encoding; JS lib
  [`tetris-fumen`](https://www.npmjs.com/package/tetris-fumen) (MIT,
  knewjade). Encodes field (10×23 + garbage line), operations
  (type/rotation/x/y), pages with comments/flags (incl. `quiz`). Decision:
  interchange/import format only; engine-native types at runtime.
- **Finesse table**: no machine-readable *sequence* table exists.
  [FinesseTrainer](https://github.com/alexjohnson0123/FinesseTrainer) has
  per-placement optimal *counts* (`finesse[piece][rot][col]` — use as
  validation); harddrop has human HTML tables behind 403; galactoid
  teaches ~8 principles instead of the ~150-entry table. Decision: derive
  by BFS (inputs: taps, DAS-as-one-step, CW/CCW, drop; SRS kicks; 0G;
  no-180 primary), snapshot to JSON, cross-validate counts.

## 4. Benchmark design findings

- **Voltaic's exact pipeline** ([S4 guide](https://voltaic.medium.com/voltaic-kovaaks-benchmarks-season-4-35f3e3fb7512),
  [about](https://app.voltaic.gg/leaderboards/about)): raw score → energy
  by interpolation against per-rank thresholds (linear 100…1200, 12
  ranks); scenario→subcategory = MAX; subcategory→overall = **harmonic
  mean** (dominated by the weakest; zero until every subcategory has a
  score). Advanced-scenario energy caps prevent single-scenario vaulting.
  No decay (weakness — we add a 30-day recency window).
- **Community thresholds** (confidence: winternebs [H], TL percentiles [H]
  2022-vintage, per-rank PPS/APM [L] — fetch live if ever needed):
  - Sprint 40L: 3:00+ new / ~80s beginner / ~44s decent / ~30s
    intermediate / ~25s experienced / ~20s pro.
  - Cheese blocks/100L: 400+ new / 300–400 beginner / 250–300
    intermediate / <250 advanced.
  - KPP: 3.0 good / <2.6 elite / ~2.0 theoretical floor; finesse faults
    target 0, <15/game working ceiling.
  - VS = APP × PPS × 100; APM scales non-linearly with percentile → anchor
    energy curves to percentile-ish spacing, not even raw intervals.
- **Contamination designs**: MonkeyType randomizes content per run;
  Voltaic fixes scenarios and accepts grinding; chess uses huge adaptive
  pools. Our compromise: fixed calibrated **seed pools** (~30/skill),
  random draw per run, median-of-3 for the rating, best-ever as PB.
  Finesse test is the exception — fixed sequence is contamination-safe
  (optimal counts are invariant).
- **Presentation**: Voltaic color-banded tier table (cause adjacent to
  effect), Lichess radar lesson (radar good ≤8 axes — we have 4),
  osu!Skills polygon-shape-as-identity. → badge + worded gate callout +
  radar + tier table with next-band deltas.

## 5. Codebase map (key facts; see docs/engine.md for current API)

- Engine deterministic: seed + actions + dtMs reproduce exactly; events
  rich (ClearInfo: label/b2b/combo/PC/points) but drained and dropped at
  `src/game/controller.ts` drainEvents; nothing records inputs today.
- Existing reusable: modes (sprint/blitz/cheese already = 3 of 4
  benchmark tests), `addGarbage(rows, holeColumn)` / `insertCheese(rows)`,
  `canFit`/`ghostY` for placement math, `settings.ts` localStorage
  pattern, GameController phase machine + `useSyncExternalStore` bridge,
  `window.__tetra` scripting handle.
- Gaps (small): no setBoard / setQueue / step control (actions+ticks
  no-op unless `status === 'playing'`); no board metrics; no replay
  recording; lesson/benchmark UI surfaces don't exist.
