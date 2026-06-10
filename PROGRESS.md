# Progress log

Append-only. Newest entry first. Each session that changes the repo adds an
entry: what changed, decisions made, open threads. Do not rewrite or delete
old entries.

---

## 2026-06-09 — Quality-bar research

**This session**: Researched the polish/quality bar of modern Tetris clients
(TETR.IO, Jstris, Tetris Effect: Connected, PPT2, Techmino, Cambridge,
Four-tris) via five parallel Opus research subagents — game feel/input, visual
effects inventory, audio + music sourcing/licensing, UI/UX/settings/stats,
technical craft. Synthesized into `docs/quality-bar.md` (with
summary/read_when frontmatter). No code changed.

**Decisions**:
- Quality bar lives in `docs/` (durable reference future polish sessions must
  read), not `research/` (process/meta research) — matches the specs/README
  "docs compound" rule. Added the missing frontmatter to
  `docs/tetris-reference.md` for consistency.
- Key research conclusions baked into the doc: two-axis model (feel
  non-negotiable, juice scalable to zero; data-bearing cues survive minimal
  mode); never use Korobeiniki in any arrangement (TTC trademark); SFX from
  CC0/Sonniss or synthesized; identified open niches (colorblind piece
  patterns, reduced motion, handling presets, designed-minimal aesthetic).

**Open threads**:
- Quality-bar doc feeds future feature-parity/design-pass specs; exact
  animation timings (tweens, count-ups) need frame-by-frame video study if
  ever required.
- Tests 28/28 green; build green; lint still has the 10 pre-existing errors
  (needs its own session, unchanged).

---

## 2026-06-09 — Feature-parity spec interview

**This session**: Interviewed the user and wrote `specs/feature-parity.md` —
the umbrella spec for reaching full parity with modern clients (TETR.IO/
Jstris): Phase 0 parity audit (matrix in `docs/parity.md`), mechanics
verification, versus substrate, battle mode, online invite-link 1v1, design
pass + metrics. Verified the guideline attack/combo tables against
TETRIS-FAQ and confirmed Vercel functions can't host WebSockets (signaling
via serverless + KV polling; gameplay P2P over WebRTC lockstep).

**Decisions** (full table in the spec):
- Baseline-expected features at the highest bar, not feature maximalism;
  the Phase 0 matrix grades every item and is the coverage contract.
- Standard guideline ruleset in an `AttackConfig`; TETR.IO exotica deferred.
- Opponent abstracted: scripted garbage pressure first, bot later; battle
  mode = phantom opponent with HP.
- Online baseline: invite-link 1v1, no accounts, Vercel-native.
- New standing invariant: deterministically drivable at every layer
  (injectable time, state-based assertions, abstracted transport, tests cite
  sources) — promote to CLAUDE.md when Phase 0 lands.
- Deferred to IDEAS.md: 20TSD, PC mode, real bot, Surge/multiplier, lobbies,
  accounts.

**Open threads**:
- Phase 0 open questions (in spec): replays baseline?, sprint variants/zen,
  PC attack value (10 vs 5), cosmetic-settings line.
- Execute Phase 0 in a fresh session per CLAUDE.md.

---

## 2026-06-09 — Pedagogy research executed

**This session** (continuation of the pedagogy interview session): user
signed off mid-session, so the spec ran here instead of a fresh session.
Four parallel Opus subagents (community canon / learning science / trainer
teardowns / existing Tetris trainers) synthesized into
**`research/pedagogy.md`** — the reference doc for the training phase.
No code changes; tests green (28/28), build clean.

**Headline findings**:
- Ecosystem gap #1: chess-style engine review for guideline Tetris does not
  exist — but Tetrisfish proves it for NES (existence proof). `.ttrm`
  replays + Cold Clear exist; nobody connected them.
- Keystone science: performance during practice ≠ learning (Soderstrom &
  Bjork); constant immediate feedback hurts retention (guidance
  hypothesis); elites differ in spatial cognition + decision accuracy, NOT
  reaction time.
- Train/test/refine answered: three conflicting optimal conditions → three
  separate surfaces. Proposed mode carving: Learn / Drill / Test / Play /
  Review + a tutor layer routing between them.
- Method ranking (top 3): engine review of own games; benchmark battery
  with per-skill weakest-link ratings; weakness-targeted drill generation.
  Shared dependency: engine must evaluate positions + enumerate good
  placements — that capability is the pedagogical core.

**Open threads**:
- `specs/pedagogy-research.md` has shipped — archive/delete per specs
  README once reviewed; durable knowledge lives in `research/pedagogy.md`.
- `specs/bot-coach-research.md` still queued; it should cite
  `research/pedagogy.md` (now exists — esp. Part 3.4 and gap analysis).
- Pre-existing lint failures (10 errors: engine.ts, useGame.ts, format.ts)
  still untouched; needs its own fix session.

---

## 2026-06-09 — Pedagogy research spec (interview)

**This session**: Interview only — wrote `specs/pedagogy-research.md`. No
code changes. Tests green (28/28).

**The spec**: a fresh session produces `research/pedagogy.md`, a deep-dive
report on how people learn competitive Tetris and how tetra should teach.
Four parallel subagent research passes (Tetris community canon, learning
science, comparable trainers like chess.com/Aim Lab, existing Tetris
trainers), synthesized into: full skill ladder, teaching toolbox, and the
centerpiece — an exhaustive taxonomy of learning methods × delivery formats
(curriculum ladder, mini-games, puzzles, live modes, tutor, bot sparring…)
ranked and mapped to skill stages.

**Decisions**:
- Bots reframed as a *delivery method* for pedagogy, not an independent
  thread: mistake detection ("you misplayed 3 pieces ago"), alternative-line
  replay, style emulation. RL stack choice stays out of scope.
- Open question the research must answer: training vs testing vs refining a
  skill — where trainers draw that line and what it implies for mode design.
- Research doc only; feature specs come later from separate interviews.
- Execution via plain subagents, not the Workflow orchestration feature.

**Open threads**:
- Execute `specs/pedagogy-research.md` in a fresh session.
- RL training stack fork still open (unchanged from previous entry).
- `npm run lint` fails with 10 pre-existing errors (engine.ts unused
  expressions + useless `points` assignment in scoring; useGame.ts ref
  access during render; format.ts) — predates this session, left untouched
  because some look semantic, not cosmetic. Needs its own fix session.

---

## 2026-06-09 — Workflow scaffolding (initializer)

**State of the project**: Client phase complete — playable React+TS+Vite
client (`tetralab`), pure headless engine (`src/engine/`) with SRS, scoring,
modes (marathon/sprint/blitz/cheese/survival), seeded RNG, vitest coverage.
Deployed via Vercel. Next phase: RL bot training mode per VISION.md.

**This session**: Researched agent-driven development workflows
(`research/agent-driven-development.md`), then scaffolded the workflow:
CLAUDE.md (session lifecycle + rules), this progress log, IDEAS.md inbox,
docs/engine.md.

**Decisions**:
- Lifecycle: read PROGRESS.md + git log + smoke test on session start; spec
  interviews (`specs/`) for non-trivial features; append progress entry on end.
- Main-only commits, low process while solo/interactive; escalate to
  worktrees + features.json harness only when unattended/parallel runs begin.
- Engine purity is a standing invariant (RL substrate).

**Open threads**:
- RL training phase needs a spec interview: biggest fork is the training
  stack (TS-native vs Python+gym wrapper vs heuristic bot first).
- No headless CLI runner yet (`tetra-sim`-style: run N games, score a bot,
  dump metrics) — likely the first RL-phase milestone regardless of stack.

---

## 2026-06-09 — Bot/engine substrate research spec (interview)

**This session**: Interview only, no code. Produced
`specs/bot-engine-research.md` — a research spec (executes in a fresh
session) whose deliverable is `research/bot-engine.md`. The spec was
revised twice mid-session as the idea sharpened; earlier framings
("human-like bot", then "bot-as-coach") are superseded.

**Decisions**:
- Final framing: the bot is an **engine substrate**, chess.com-style — one
  core powering many consumers (recommender/coach, adjustable-difficulty
  sparring, strategy archetypes and side-by-side comparison, post-game
  review, offline puzzle/drill generation). The coach is one consumer, not
  the definition.
- The chess analogy is a hypothesis to *test*, not assume: Tetris state
  space may merge fast and skill may be pattern-recognition-shaped rather
  than analysis-shaped — the research's first deliverable is that verdict,
  which determines what an engine can even contribute. The research may
  conclude a single extendable core is the wrong shape.
- Recommendations are choosable candidates carrying *ideas* ("keeps the
  well clean"), Maia-style comprehensible, not max-strength alien play.
- Deliberately deferred to research (user unsure): are explanations
  essential, learned-from-replays vs heuristic vs hybrid,
  skill-conditioning, believable difficulty ladders.
- Execution: parallel **general-purpose Opus subagents** only, no Workflow
  orchestration (user decision, restated twice). Independent of the
  pedagogy research (cite it if it exists, don't block on it).

**Open threads**:
- Both research specs (`pedagogy-research.md`, `bot-engine-research.md`)
  are now queued and unexecuted; either can run next in a fresh session.
