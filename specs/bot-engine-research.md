# Spec: Bot/engine substrate research

Produced by an interview session on 2026-06-09, revised twice in the same
session as the user sharpened the idea. Execute in a fresh session.

## Goal

Write `research/bot-engine.md` — a research report on what kind of
bot/engine substrate tetra should have, and whether one substrate can
power many products. VISION.md fixes that tetra teaches; the pedagogy
research (`specs/pedagogy-research.md`) maps which learning methods exist;
this document researches the *machine* underneath.

**The working analogy** (user's): chess.com. Chess.com has an engine, and
that one engine powers many different things — game review, learning,
recommendations. Puzzles don't necessarily run the engine live, but the
engine is plausibly used to generate and grade them. The bot is **not
necessarily a coach**: the coach/recommender is one consumer of an
engine-like core, alongside sparring opponents, demonstrations, and
content generation.

**But the analogy itself is the first research question** (user's words,
paraphrased): *a chess move can be analyzed very deeply — there are
positions, lines, all these things. Tetris might be different: it's a
configuration, and its state space might very quickly merge into another
state space. Maybe it's more about pattern recognition and the practice of
patterns. This depends on how Tetris is even learned. A lot has to be done
on the research side first — and then: how could we build this bot in a
way that's extendable to all these use cases? But maybe it wouldn't be.*

The report's centers of gravity, in order:

1. **The chess-analogy stress test** — is per-decision engine analysis
   even the right primitive for Tetris? Characterize the structure of
   Tetris decisions vs chess: depth and analyzability of a single
   placement decision, whether board states transpose/merge quickly,
   the split between strategic choice and pattern
   recognition/automaticity, the motor/speed component. The verdict
   determines what an engine can contribute — deep analysis (chess-like),
   or mostly pattern/scenario *generation*, sparring, and grading.
2. **The recommender** — if and where analysis applies: a bot whose
   suggested moves/ideas/patterns a human can understand, choose between,
   and reproduce at their level (Maia-chess-style comprehensible, not
   Cold Clear-style alien-optimal).
3. **The mechanism taxonomy** — given a concept a human wants to learn
   (downstacking, well management, 3-6 stacking, attack timing), all the
   ways to express it in-game — policy shaping, heuristic detectors,
   visual language, affordances like undo/branch-replay — and how to
   decide which mechanism fits which concept.
4. **The sparring ladder** — bots at adjustable difficulty/skill that are
   believable at every level (they lose the way humans lose, not by
   random blunders), distinct strategy archetypes, side-by-side strategy
   comparison.
5. **The general-purpose architecture** — what single core (policy +
   evaluation + search + concept layer?) powers all consumers, what each
   consumer additionally requires, and a capability map of everything
   else the core could yield. The report has explicit permission to
   conclude that **a single extendable core is the wrong shape** for
   Tetris — "maybe it wouldn't be" is an acceptable, sourced answer.

## Out of scope

- No code, no UI, no engine changes. The deliverable is one markdown file.
- No feature commitments or specs — outputs are ranked candidates and a
  decision framework, not a roadmap.
- The RL training stack decision (TS-native vs Python+gym vs
  heuristic-first) stays open; the research informs it but does not make it.
- Does not redo the pedagogy research: that spec owns the broad
  learning-methods taxonomy and ranking. This spec touches "how Tetris is
  learned" only through the architecture lens — what the cognitive
  structure of Tetris skill implies about what an engine can contribute.
  If `research/pedagogy.md` exists at execution time, cite it; do not
  block on it (no ordering dependency).
- Do not execute anything from IDEAS.md.

## Design

**Deliverable**: `research/bot-engine.md`. Deep-dive reference document,
tone and citation style like `research/agent-driven-development.md`;
longer is fine.

**Execution method** (user decision, restated twice): fan out parallel
**general-purpose Opus subagents** (Agent tool, `subagent_type:
"general-purpose"`, `model: "opus"`) with web access — one per source
family below — then synthesize in the main session. Do NOT use the
Workflow orchestration feature. Subagents only.

**Source families** (one research pass each):

1. **The nature of Tetris skill** — cognitive-science literature on
   Tetris (Kirsh & Maglio on epistemic action, Gray/Lindstedt expertise
   studies, anything on chunking/pattern recognition in Tetris),
   state-space structure of stacking (transposition/convergence of board
   configurations), and high-level community discourse on how improvement
   actually happens (calculation vs recognition vs finesse/motor
   automaticity). Goal: the chess-analogy verdict's evidence base — how
   deep is a Tetris decision, and is skill analysis-shaped or
   pattern-shaped (or stage-dependent: which at which level)?
2. **Engine-as-platform teardowns** — how chess.com and lichess use one
   engine across products: game review/analysis, puzzle *generation* and
   grading (puzzles famously mined from real games by engine analysis),
   lessons, adjustable-strength bots, opening explorers. Also any other
   game with an engine-powered product family (Go/KataGo ecosystem,
   poker solvers and trainers). Goal: the consumer-product map of an
   engine substrate and which consumers need live analysis vs offline
   generation.
3. **Tetris bot landscape and technical substrate** — Cold Clear,
   MisaMino, StackRabbit, Wumbo, academic RL-for-Tetris work. How each
   generates and evaluates candidate placements (search depth, evaluation
   features, beam width), what is open-source and reusable, what runs
   headless or in-browser (WASM, ONNX Runtime Web, TF.js). Map onto
   tetra's substrate: pure seeded engine driven by `applyAction(action) +
   tick(dtMs)`, `Action` type in `src/engine/types.ts` as action space,
   flat `Uint8Array` board as observation (see `docs/engine.md`). Goal:
   what can be borrowed vs must be built, and what candidate-move
   generation costs in-browser.
4. **Human-like and skill-conditioned game AI** — Maia chess (1 and 2)
   and its rating-conditioned training, Noctie.ai, imitation/behavioral
   cloning from human replays, prior art on human-like Tetris bots. The
   data question: what human replay data is practically and legally
   obtainable (TETR.IO replay API/TTRM format, Jstris, others), at what
   volume, with what skill labels. Difficulty adjustment: how strength
   ladders are built believably (Maia's per-rating models vs chess
   engines' strength limiting and its random-blunder failure mode;
   dynamic difficulty adjustment literature), and how distinct play
   styles/strategy archetypes are induced in one system. Goal: is
   Maia-for-Tetris feasible, is human-likeness even the right target, and
   how would a credible difficulty-and-style ladder be built?
5. **Concept expression and coaching mechanisms in games** — how existing
   tools turn a concept into in-game experience: chess.com/lichess
   analysis and coach explanations, Magnus Trainer, fighting-game
   training modes (rewind, frame-data overlays, recorded dummies),
   speedrun practice tools (savestates, segment retry), racing ghosts,
   puzzle modes, constrained modes ("you may only downstack"),
   comparison surfaces (side-by-side or ghosted replays of two
   strategies handling the same situation). Enumerate mechanism
   categories: shaped/constrained policies, heuristic concept detectors
   that fire feedback, visual languages (overlays, ghosts, heatmaps,
   highlighted candidates), interaction affordances (undo,
   branch-and-replay, pause-and-choose, slow motion), environment shaping
   (curated board states, puzzle extraction from your own games). Goal:
   an exhaustive mechanism inventory with examples and evidence of
   effectiveness where it exists. Cast a wide net — the user explicitly
   wants framings we have not thought of.
6. **Evidence on choice-based and explanation-based coaching** — does
   presenting candidate moves with reasons beat presenting the single
   best move? Chess pedagogy and engine-review literature, guided
   discovery vs direct instruction, worked examples, feedback timing,
   explainable-AI work on concept-level explanations of game policies.
   Goal: evidence base for the choose-among-annotated-candidates
   interaction and for how much "why" matters.

**Key decisions and framings from the interview**:

- The bot is an **engine substrate**, chess.com-style: one core, many
  consumer products. The coach/recommender is one consumer; sparring at
  adjustable difficulty/style, demonstration, strategy comparison, and
  offline content generation (puzzles/drills mined from analysis) are
  others. Some consumers may not run the engine live but be generated by
  it.
- The chess analogy is a hypothesis to test, not an assumption. If Tetris
  decisions are shallow-but-fast and skill is mostly pattern recognition,
  the engine's pedagogical contribution shifts from "analyze my move"
  toward "generate the right practice situations and grade them" — the
  report must say which, with evidence, possibly stratified by skill
  stage.
- Candidates carry *ideas*, not just placements — "keeps the well clean",
  "banks a T-spin", "burns a line to stay safe". Whether explanations are
  essential or optional is an open question the report must answer from
  evidence (user is unsure; source family 6 decides).
- **One core, many consumers**: the report must state what each consumer
  — (a) live in-game suggestions, (b) paused decision-point mode (game
  pauses at key moments, candidates shown, player chooses, play
  continues), (c) post-game review, (d) sparring at adjustable
  difficulty/style, (e) strategy comparison, (f) offline
  puzzle/drill generation — demands of the core (latency, explanation
  depth, candidate count, strength/style conditioning, batch analysis),
  and whether one core really serves them all.
- **Open questions the report must answer explicitly** (all deferred to
  research by the user):
  - The chess-analogy verdict: is per-decision analysis meaningful in
    Tetris, does the state space merge too fast for "lines", and is
    skill analysis-shaped or pattern-shaped at each level of play?
  - Learned-from-replays vs heuristic-search-constrained-to-plausible vs
    hybrid (search generates, human-likeness filters, hand-written
    concept detectors annotate): compare on explainability, data needs,
    build cost, in-browser viability. Recommend one, with a fallback.
  - Is skill-conditioning (recommend what a slightly-better player would
    find) feasible and pedagogically worth it, or is one
    strong-but-human target level enough?
  - How are *concepts* represented computationally — shaped evaluation
    functions, constrained action spaces, detector functions over board
    states, curated scenario banks? Which representation serves which
    mechanism from source family 5?
  - How is a believable difficulty ladder built — what makes a weakened
    bot feel like a weaker *human* rather than a strong bot rolling dice
    — and how are distinct strategy archetypes (aggressive spike,
    defensive/downstack-heavy, opener-centric…) represented and selected?
  - **The capability map**: given the recommended core, enumerate
    everything it could yield — asked-for consumers and unasked-for ones
    (puzzle generation from your own games, automated drill grading,
    replay annotation, matchmaking calibration, the future RL substrate…)
    — so the architecture is judged on general-purpose value, not one
    feature. Include the honest negative case: which consumers a single
    core serves badly.
  - **The "how will I know" question**: a decision framework mapping
    concept-type → best in-game expression mechanism (e.g. motor skills →
    drill with undo; positional judgment → pause-and-choose; planning →
    post-game alternative lines). This framework and the architecture
    recommendation are the report's centerpiece deliverables.
- Undo/branch-and-replay affordances should be assessed for engine fit:
  tetra's engine is pure and seeded, so snapshot/restore and replaying
  alternative lines from any state are architecturally cheap — note where
  mechanisms depend on this.

## Milestones

- [x] **M1 — Source-family research**: six parallel general-purpose Opus
  subagent passes, one per source family. Done when all six return cited
  findings (URLs).
- [x] **M2 — Chess-analogy verdict**: sourced answer to center-of-gravity
  1 — the structure of Tetris decisions vs chess, state-space
  convergence, analysis-shaped vs pattern-shaped skill (by stage), and
  what that implies an engine can contribute (live analysis vs generation
  vs sparring vs grading). Done when the verdict is explicit and cited,
  including an honest "differs from chess in these ways" list.
- [x] **M3 — Mechanism taxonomy**: the inventory from family 5,
  organized: every in-game concept-expression mechanism found, each with
  an example product, what concept types it suits, and evidence of
  effectiveness (or "none found"). Done when the taxonomy covers at least
  policy-, detector-, visual-, and affordance-class mechanisms and is
  exhaustive before it is ranked.
- [x] **M4 — Technical approach comparison**: learned vs heuristic vs
  hybrid core, with the replay-data feasibility verdict, reusable prior
  art (family 3), in-browser inference constraints, and fit with tetra's
  engine API. Done when each approach has explainability / data / cost /
  viability assessed and one is recommended with rationale and a fallback.
- [x] **M5 — Synthesis**: (a) the concept-type → mechanism decision
  framework; (b) sourced answers to every open question listed above;
  (c) the architecture: per-consumer requirements (live / paused / review
  / sparring / comparison / generation), the capability map, and the
  explicit judgment on whether one extendable core is the right shape —
  including the negative case if the evidence points there. Done when no
  open question from the spec is left unanswered or unmarked as genuinely
  undecidable from available evidence.
- [x] **M6 — Source list + landing**: annotated source list appended;
  `research/bot-engine.md` committed; PROGRESS.md entry appended;
  promising candidates optionally dropped into IDEAS.md as inbox items.

## Verification

- `research/bot-engine.md` exists with all sections: chess-analogy
  verdict, mechanism taxonomy, technical approach comparison,
  difficulty/style ladder findings, per-consumer requirements plus
  capability map (with the negative case considered), decision framework,
  answered open questions, annotated sources.
- Spot-check: the analogy verdict cites cognitive-science or expertise
  sources, not vibes; the taxonomy is broad (not just "show best move");
  the data-feasibility claim about TETR.IO/Jstris replays cites primary
  sources; the decision framework maps at least the user's example
  concepts (downstacking, stacking technique) to mechanisms; the
  chess.com/lichess teardown distinguishes live-engine consumers from
  engine-generated content.
- Self-containment check: a reader with only VISION.md context can follow it.
- `npm test`, `npm run lint`, `npm run build` still green (nothing in
  `src/` should have changed).
