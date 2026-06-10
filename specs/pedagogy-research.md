# Spec: Pedagogy research

Produced by an interview session on 2026-06-09. Execute in a fresh session.

## Goal

Write `research/pedagogy.md` — a deep-dive research report on how people get
good at competitive Tetris and how training tools should teach. VISION.md
fixes *that* tetra teaches but leaves *how* open; this document is the
evidence base that every future training-mode spec (drills, feedback,
bot-as-teacher) will cite.

**The primary question** (user's words, paraphrased): *what are all the ways
people learn Tetris — and learn things in general — and what are all the
forms that teaching could take in tetra?* Is it a curriculum ladder that
starts with basic controls, then basic skills? Mini-games? Mini-puzzles?
Live modes? A tutor? What are the distinct types of practice modes this
should separate into? The report's center of gravity is this **taxonomy of
learning methods × delivery formats** — exhaustive first, ranked second.

The report is a two-part synthesis serving that question: (1) the
Tetris-specific skill ladder, (2) the learning-science / trainer-design
toolbox — closed out by the method/format taxonomy and concrete
implications for tetra.

## Out of scope

- No code, no UI, no engine changes. The deliverable is one markdown file.
- No feature commitments or specs — implications are ranked candidates, not
  a roadmap.
- The RL training stack decision (TS-native vs Python+gym vs heuristic-first,
  see PROGRESS.md open threads) stays open. The research covers *what a bot
  must be able to do pedagogically*; it does not choose how to build one.
- Do not execute anything from IDEAS.md.

## Design

**Deliverable**: `research/pedagogy.md`. Deep dive — multi-section reference
document with a full skill-ladder taxonomy, per-stage failure modes, and an
annotated source list. Tone and citation style like
`research/agent-driven-development.md`, but longer is fine; this is the
reference doc for the whole training phase.

**Audience framing**: the full skill ladder, from first game to high-level
competitive 1v1 (modern guideline versus play — TETR.IO / Tetra League
framing matches VISION.md).

**Execution method**: fan out parallel research subagents (Agent tool, e.g.
general-purpose with web access) — one per source family below — then
synthesize in the main session. Do NOT use the Workflow orchestration
feature; plain subagents only (user decision).

**Source families** (all four, one research pass each):

1. **Tetris community canon** — hard-drop wiki, Tetris wiki, four.lol,
   Tetra League rank discourse, guides and coaching content from top
   players. Goal: the practical skill ladder — what separates ranks, what
   skills are gated on what, what practice the community prescribes
   (finesse, flat stacking, openers, downstacking cheese, attack timing).
2. **Learning science literature** — deliberate practice (Ericsson), skill
   acquisition stages (Fitts & Posner), motor learning and automaticity,
   feedback timing (immediate vs delayed, knowledge of results vs
   performance), spaced repetition, desirable difficulties, flow/challenge
   matching. Goal: each principle stated with its evidence and a
   Tetris-shaped application.
3. **Comparable training products** — structural teardowns of chess.com
   (lessons, puzzles, game review), Aim Lab / KovaaK's, MonkeyType, osu!
   practice ecosystem. Goal: recurring design patterns in trainers that
   demonstrably retain and improve users (drill decomposition, ratings,
   review loops, streaks/progression).
4. **Existing Tetris trainers** — what already exists: TETR.IO custom rooms
   and practice tools, four-tris/fumen-based tools, finesse trainers,
   Tetris Effect drills. Goal: gap analysis — what tetra would add that the
   ecosystem lacks.

**Key decisions from the interview**:

- Bots are a *delivery method* for pedagogy, not a separate concern. The
  synthesis must cover the bot-as-teacher method explicitly: a sufficiently
  strong bot/engine enables (a) post-game mistake detection — "you made a
  mistake three pieces ago", (b) alternative-line replay — "here are ways
  you could have played that", and (c) style emulation — select a play
  style and watch the bot demonstrate it. Treat this like chess engine
  analysis as pedagogy; the research should establish what each of these
  requires pedagogically (and note evidence for/against engine-review
  learning from the chess literature).
- Bot-as-teacher is one method among several (drills, metrics, post-game
  feedback, guided modes); the report ranks methods by pedagogical value,
  it does not presuppose the bot.
- The taxonomy must be generated wide before it is ranked: enumerate every
  learning method and delivery format found across all four source
  families (curriculum/lesson ladders, mini-games, puzzle sets, spaced
  drills, live/pressure modes, tutor/coach interaction, game review,
  bot sparring, watching/imitation, style emulation, …), then organize
  into a proposed set of distinct practice-mode categories for tetra.
- **Open research question to answer explicitly**: what is the difference
  between *training* a skill (building it), *testing* it (assessing under
  pressure / measuring rank), and *refining* it (polishing an existing
  skill)? How do learning science and successful trainers draw this line
  (practice vs assessment vs review; blocked vs interleaved practice;
  ranked play vs drills), and what does the distinction imply for how
  tetra separates its modes?
- Deliverable is research only; feature specs come later in separate
  interview sessions.

## Milestones

- [x] **M1 — Source-family research**: four parallel subagent passes, one
  per source family above, each returning cited findings. Done when all
  four have produced findings with sources (URLs) attached.
- [x] **M2 — Skill ladder (Part 1)**: taxonomy of competitive-Tetris skill
  from beginner to top-level, with per-stage: defining skills, typical
  failure modes, and community-prescribed practice. Done when every stage
  has all three and claims cite community sources.
- [x] **M3 — Teaching toolbox (Part 2)**: learning-science principles +
  trainer design patterns + existing-Tetris-trainer gap analysis, each
  principle/pattern paired with a Tetris-shaped application. Done when no
  principle is stated without an application.
- [x] **M4 — Taxonomy + synthesis**: the centerpiece. (a) Exhaustive
  taxonomy of learning methods × delivery formats drawn from all four
  source families; (b) an explicit answer to the training vs testing vs
  refining question; (c) a proposed set of distinct practice-mode
  categories for tetra, with each candidate method (including the three
  bot-as-teacher capabilities) ranked by pedagogical value × evidence
  strength and mapped against the skill ladder (which method serves which
  stage). Done when the taxonomy exists, the train/test/refine question
  has a sourced answer, and every ranked method has a one-paragraph
  justification.
- [x] **M5 — Source list + landing** (shipped 2026-06-09; spec ready to archive): annotated source list appended;
  `research/pedagogy.md` committed; PROGRESS.md entry appended; promising
  ranked methods optionally dropped into IDEAS.md as inbox items.

## Verification

- `research/pedagogy.md` exists and contains all four sections (skill
  ladder, toolbox, taxonomy + synthesis/ranking, annotated sources).
- Spot-check: every skill-ladder stage names failure modes and practice;
  every learning-science principle has a Tetris application; the
  method × format taxonomy is present and broad (not just the obvious
  drills); the train/test/refine distinction is answered with sources;
  every ranked method has a justification; nontrivial claims carry
  citations.
- Self-containment check: a reader with only VISION.md context can follow it.
- `npm test`, `npm run lint`, `npm run build` still green (nothing in
  `src/` should have changed).
