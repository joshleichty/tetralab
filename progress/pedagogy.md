# Progress — pedagogy stream (training that teaches)

Append-only, newest first. What changed, decisions made, open threads.
See WORKSTREAMS.md for the stream's place in the whole.

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
