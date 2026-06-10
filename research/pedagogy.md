# Pedagogy: how people learn Tetris, and how tetra should teach

*2026-06-09. Produced per `specs/pedagogy-research.md` from four parallel
research passes: Tetris community canon, learning science, teardowns of
proven trainers (chess.com, Aim Lab, MonkeyType, osu!, Duolingo), and a
survey of existing Tetris training tools. This is the reference document for
all future training-mode specs. Citations inline; annotated sources at the
end.*

---

## Executive summary

1. **The skill ladder is well understood by the community** but exists only
   as static prose (winternebs FAQ, four.lol). Five stages, each with known
   failure modes and known prescriptions. No tool walks a player up it.
2. **Learning science gives clear, sometimes counterintuitive design
   rules.** The keystone: *performance during practice is not learning*
   (Soderstrom & Bjork). Constant immediate feedback hurts retention
   (guidance hypothesis). Interleaving feels worse and works better. Elites
   are separated by spatial cognition and decision *accuracy*, not reaction
   time.
3. **Proven trainers converge on the same structure**: decompose the skill
   into named, separately-rated units; keep a hard wall between a fixed
   assessment battery and adaptive practice; aggregate by weakest link;
   generate drills from the player's own errors; grade mistakes relative to
   the player's level.
4. **The ecosystem gap is diagnosis.** Content (four.lol), venues (TETR.IO,
   Jstris), and superhuman engines (Cold Clear) all exist — but no
   guideline-Tetris tool closes the loop *play → measure → diagnose → drill
   → re-measure*. Chess-style engine review exists for NES Tetris
   (Tetrisfish) and is beloved; for guideline play it simply hasn't been
   built. tetra's headless engine is precisely the substrate it needs.
5. **Training, testing, and refining are genuinely different activities**
   with different optimal conditions, and the science says a trainer should
   present them as three distinct surfaces: scaffolded practice, standardized
   assessment, and guided review. (Full answer in Part 3.2.)

---

# Part 1 — The competitive Tetris skill ladder

## 1.1 The ladder

The de facto ladder is TETR.IO's Tetra League, ranks D through X+
([tetrio.wiki.gg/wiki/TETRA_LEAGUE](https://tetrio.wiki.gg/wiki/TETRA_LEAGUE)).
Ranks are **percentile-based** (top ~1% are X, bottom ~2.5% are D —
[tetrio.team2xh.net](https://www.tetrio.team2xh.net/)), so absolute skill
per rank inflates over time; benchmarks (sprint times, cheese block counts,
KPP) are more stable stage markers than rank letters. The community's most
concrete gates come from the winternebs TETRIS-FAQ
([winternebs.github.io/TETRIS-FAQ](https://winternebs.github.io/TETRIS-FAQ/)).

| Stage | ~Rank | Defining skills | Failure modes | Prescribed practice |
|---|---|---|---|---|
| 0 Absolute beginner | pre-D/D | knows pieces, hard drop, hold exists | holes everywhere, no well concept, tops out fast | marathon for mechanics; 40L sprint with Tetrises only (1:30–2:00 gate before versus) |
| 1 Learning to stack | D–C | flat stack + dedicated well, uses hold/preview, sprint 44–80s | overhangs, can't downstack garbage, panics | flat-stacking drills (9-0 well), basic finesse, cheese race (300–400 blocks/100 lines) |
| 2 Core competence | B–A | consistent stacking, basic TSDs, one opener (TKI), sprint ~30s | inefficient attack (low APP), poor garbage management, dies to combos | T-spin setups, B2B maintenance, versus theory, cheese to 250–300 blocks |
| 3 Advanced | S–SS | forecasting/donation T-spins, B2B while downstacking, deliberate spiking, sprint ~25s | opponent reading, spike timing, style matchups | replay review, sparring stronger players, style study, spiking practice |
| 4 Top/pro | U–X+ | sprint ~20s, KPP < 2.6, fluent in all attack forms, playstyle flexibility | marginal: matchup theory, consistency, mental game | high-level sparring (MMC Discord), tournaments, coaching (~$30–35/hr) |

Sources: [winternebs sprint](https://winternebs.github.io/TETRIS-FAQ/sprint/),
[cheese](https://winternebs.github.io/TETRIS-FAQ/cheese/),
[versus](https://winternebs.github.io/TETRIS-FAQ/versus/),
[general](https://winternebs.github.io/TETRIS-FAQ/general/).

Two structural facts about how the community curriculum is organized:

- **winternebs FAQ is progression-ordered** (benchmarks and gates) —
  the closest thing to a stage-by-stage curriculum.
- **four.lol is concept-ordered** (openers → methods → mid-game → stacking
  → PCs), deliberately *not* mapped to ranks
  ([four.lol](https://four.lol/)). It is an encyclopedia, not a course.

A trainer has to supply the mapping between the two — "you are at stage 2,
therefore study these four.lol pages and drill these scenarios" — which no
existing tool does.

## 1.2 The skill components

The trainable units, roughly in order of when they matter:

- **Handling/tuning (stage 0–1)** — DAS ~130ms then lower, ARR 0–1, learn
  both rotation directions
  ([winternebs general](https://winternebs.github.io/TETRIS-FAQ/general/)).
  Tune once, early.
- **Finesse (stage 1+)** — minimum-keypress placement; "2-step finesse"
  reaches every column/orientation in ≤2 directional inputs via DAS + SRS
  ([four.lol/mid-game/finesse](https://four.lol/mid-game/finesse/)).
  Measured as KPP (aim 3.0, elite < 2.6). Trained by reset-on-error drills
  (Tetresse, Jstris finesse-fault). Caveat: many top players have imperfect
  finesse — it's a multiplier, not a gate.
- **Flat stacking (stage 1, the bedrock)** — single well, flat surface.
  9-0 (right well) easiest to execute; freestyle lowest-KPP but most
  cognitively demanding
  ([winternebs sprint](https://winternebs.github.io/TETRIS-FAQ/sprint/)).
  The governing heuristic: "in a good stack the next move should be obvious."
- **Downstacking/cheese (stage 1+, the defensive backbone)** — clear
  garbage in minimal pieces. Benchmarks: 300–400 blocks beginner, 250–300
  intermediate, <250 advanced
  ([winternebs cheese](https://winternebs.github.io/TETRIS-FAQ/cheese/)).
  Principles: plan ~5 pieces ahead, "there is almost always an easier
  solution" than a fancy spin.
- **T-spins (stage 2+)** — TSS/TSD/TST; 3-corner rule; technique ladder:
  spot existing T-shapes → build overhangs → donations → forecasting →
  floating spins → STSD
  ([winternebs tspin](https://winternebs.github.io/TETRIS-FAQ/tspin/)).
- **Openers (stage 2+)** — TKI recommended first (most flexible); PCO, DT
  cannon, MKO later
  ([four.lol/openers/practical-openers](https://four.lol/openers/practical-openers/)).
  Notably the FAQ warns *against* memorizing openers for sprint — pattern
  memorization can substitute for understanding.
- **Perfect clears (stage 2–3)** — PCO succeeds 84.64% with I held
  ([four.lol/perfect-clears/opener](https://four.lol/perfect-clears/opener/));
  heavy on memorized patterns; high reward (10 garbage).
- **Garbage management (stage 2+)** — canceling (clears defend ~4× better
  than they attack), spiking (10+ line bursts), counter-spiking, TETR.IO's
  Surge mechanic
  ([winternebs versus](https://winternebs.github.io/TETRIS-FAQ/versus/),
  [tetrio.wiki.gg/wiki/Terms](https://tetrio.wiki.gg/wiki/Terms)).
  Attack-value theory: combos under 5 are worse than a triple; B2B
  T-spins/Tetrises are the efficiency backbone.
- **Opponent reading (stage 3+)** — anticipating spikes, exploiting
  downstack vulnerability, matchup theory.

**Stats vocabulary** (used throughout the community, from Tenchi's FAQ —
[tetrio.team2xh.net/faq](https://tetrio.team2xh.net/faq)): PPS (speed),
APM (attack), APP = attack/piece (efficiency), VS = APP × PPS × 100. The
speed/efficiency tradeoff defines the style space.

## 1.3 Play styles

Formally recognized archetypes
([tetrio.wiki.gg/wiki/Terms](https://tetrio.wiki.gg/wiki/Terms)):

- **Stride** — fast but inefficient (high PPS, low APP); wins on pace.
- **Plonk** — slow but efficient; wins on burst counter-spikes.
- **Opener style** — pre-planned upstack offense; win before downstacking.
- **InfDS** — infinite downstack; wins by converting received garbage.
- **Hybrid** — switches style to counter the opponent; the top-tier ideal.
- Plus stacking-method styles: T-spin factory, 4-wide combo
  ([four.lol/stacking/4-wide](https://four.lol/stacking/4-wide/)).

Styles are learned by **imitation** — watching and copying named players'
replays. This matters for tetra: "style" is a real, recognized, teachable
artifact, which is what makes bot style-emulation a coherent feature.

---

# Part 2 — The teaching toolbox

## 2.1 Learning science (claim → evidence → Tetris application)

The keystone finding, which organizes everything else:

**Performance ≠ learning** (Soderstrom & Bjork 2015,
[Perspectives on Psychological Science](https://journals.sagepub.com/doi/abs/10.1177/1745691615569000)).
What you observe during practice is an unreliable index of durable learning.
Conditions that inflate practice scores (blocked drills, massed sessions,
constant feedback, comfortable difficulty) often *impair* retention and
transfer, and vice versa. → tetra must never headline practice-session score
as progress; progress is measured by spaced, standardized assessments.

**Stages of skill acquisition** (Fitts & Posner; moderate evidence,
descriptive). Cognitive (verbal, slow, error-prone) → associative →
autonomous (fast, automatic, attention freed). → Teaching should change by
stage: explicit rules and scaffolding early; strip scaffolding and drive
automaticity later. Verbose tutorials actively harm advanced players.

**Deliberate practice** (Ericsson; contested). Structured, effortful,
feedback-rich practice at the edge of ability beats unstructured play — but
the meta-analytic share of variance is ~26% in games
([Macnamara et al. 2014](https://gwern.net/doc/psychology/2014-macnamara.pdf)),
not the dominant factor. → Build structured edge-of-ability drills; don't
promise hours guarantee mastery; expect large individual variance.

**Chunking** (Chase & Simon 1973; strong, foundational). Experts recognize
domain configurations as units — chess masters recall real positions far
better than novices but show *no advantage on random boards*. → Tetris
expertise is a vocabulary of board-state chunks. Drill **recognition**:
"given this board + this piece, place it" flash-card reps are directly
supported by this literature.

**Automaticity & perceptual learning** (strong). Tetris-specific research
confirms experts differ in an *integrated* perceptual-decision-motor complex
(Lindstedt & Gray, ["Mind's Hand and Mind's Eye"](https://pubmed.ncbi.nlm.nih.gov/30543908/);
the Meta-T paradigm is the closest scientific scaffold for this app). →
Finesse must be automatized so attention goes to strategy; and "training the
eye" (fast reading of surface shape, well state, garbage holes) is a
distinct drillable skill.

**Interleaving / contextual interference** (strong in lab —
[2024 meta-analysis](https://www.nature.com/articles/s41598-024-65753-3)).
Random/interleaved practice depresses acquisition performance but improves
retention and transfer vs blocked practice. → Mix scenario types within a
session; warn the player that feeling worse is the signature of it working.

**Part-task vs whole-task** (moderate, context-dependent). Whole-task wins
when components interact heavily — and Tetris is highly interactive
(placement depends on stack, queue, hold, opponent, speed simultaneously).
→ The core surface should be whole-game play; part-task drills surgically,
for genuinely separable bottlenecks (finesse, setups, PCs), then
reintegrate.

**Desirable difficulties** (Bjork; strong as a family). Spacing, retrieval,
variation, reduced feedback — difficulties that slow acquisition improve
retention, *if* the learner can cope. → Hard modes (faster gravity, fewer
previews, novel garbage) are learning modes; calibrate to "hard but
achievable."

**Spaced practice** (strong —
[Cepeda et al. 2006](https://augmentingcognition.com/assets/Cepeda2006.pdf)).
Distributed beats massed at equal volume, large effects. → Short daily
sessions over marathons; recurring scheduled drills; spaced re-tests of
weak skills.

**Speed-accuracy** (moderate). Build accurate placement/decisions at low
speed first, ramp speed as accuracy holds — but include genuine at-speed
practice (specificity). → Gravity/pace should ramp as a *function of
measured accuracy*, not a timer.

**Feedback — the guidance hypothesis** (strong; the most-violated rule in
trainer design). Constant immediate feedback becomes a crutch: better
acquisition, worse retention, collapse when feedback is removed — i.e., in
real matches. Faded (taper with skill), bandwidth (only flag errors beyond
tolerance), summary, and **delayed** feedback all beat constant immediate
feedback for retention
([PMC6698475](https://pmc.ncbi.nlm.nih.gov/articles/PMC6698475/)). →
**Do not pop a tip after every piece.** Post-game summaries; more feedback
for beginners, tapering; let the player self-assess before revealing
analysis.

**Self-controlled feedback** (moderate). Learners who choose *when* to get
feedback retain better and need less of it. → Review is on-demand ("show me
my mistakes"), never force-fed.

**Errorless → errorful gradient** (moderate). Implicit/near-errorless motor
learning is robust under pressure; explicit error-driven analysis suits
strategic learning. → Finesse drills near-errorless (constrained, then
loosened); strategy learning via explicit review.

**Replay/video review** (moderate). Works best slowed at the critical
moment, guided by questioning, focused on few key moments, self-controlled
([video + questioning develops decision expertise](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC3858278/)).
→ Replay review: frame-step the critical moment, ask "what cost you this?"
before explaining.

**Testing effect** (strong, hundreds of replications — Roediger & Karpicke
2006). Retrieval is itself one of the most potent learning events (~d 0.5–0.6).
→ Assessments double as the best practice: spaced "board + piece → best
move" retrieval challenges.

**Flow / dynamic difficulty** (moderate, for engagement). Challenge ≈ skill
keeps players in; but flow optimizes comfort while desirable difficulties
require discomfort. → DDA on the *play* surface for engagement; bias
*training* surfaces slightly harder than comfortable.

**Goal setting** (strong — Locke & Latham). Specific challenging goals beat
"do your best" by large margins. → "Sub-40s sprint," "2.0 PPS for 60s," not
"get better." Process goals early ("keep the stack flat"), outcome goals
later.

**Gamification** (moderate; engagement ≠ learning —
[Sailer & Homner 2020](https://link.springer.com/article/10.1007/s10648-019-09498-w)).
Streaks drive retention via loss aversion (Duolingo) but can substitute for
pedagogy. → Gamify the *behavior that produces learning* (showing up for
spaced drills), never raw score; pair every loop with a real assessment.

**Tutoring / ITS** (strong that it helps; the 2-sigma myth is not robust —
realistic effect d≈0.4–0.8, [VanLehn 2011 / Kulik & Fletcher](https://journals.sagepub.com/doi/abs/10.3102/0034654315581420)).
The mechanism is **mastery gating**: diagnose → targeted drill → mastery
check → spaced review, don't advance until the check passes. → An adaptive
coach loop is the single highest-leverage structure available.

**Esports evidence redirect** (moderate —
[esports expertise meta-analysis](https://pmc.ncbi.nlm.nih.gov/articles/PMC11316462/)).
What separates elites: **spatial cognition (g=0.82) and decision accuracy
(g=0.56), not reaction time (g=0.22, n.s.)**. StarCraft players' RT declines
from age 24 with no performance loss. → Train board-reading and placement
accuracy over twitch drills; anticipation beats reaction.

## 2.2 Design patterns from proven trainers

Nine patterns recur across chess.com/Lichess, Aim Lab/KovaaK's,
MonkeyType/keybr, osu!, and Duolingo:

1. **Named skill taxonomy, separately rated.** Lichess slices "tactics"
   into ~30 motif tags × phase × depth, each with its own visible rating
   ([lichess.org/training/themes](https://lichess.org/training/themes));
   Voltaic slices aim into 3 families × 2 sub-skills. Never let a user just
   "practice Tetris."
2. **Hard wall: fixed assessment battery vs adaptive practice.** Voltaic
   benchmarks (Iron→Celestial) vs VDIM daily playlists
   ([voltaic.gg](https://voltaic.gg/)); rated chess vs puzzles. Assessment
   is fixed and repeatable so it's comparable over time; practice is
   adjacent but distinct.
3. **Weakest-link aggregation.** Voltaic rank is bottlenecked by your worst
   sub-skill; keybr won't advance until a key is mastered; Lichess flags
   "Improvement Areas." The scoring system structurally points at
   weaknesses so they can't be farmed around.
4. **Drills generated from the player's own errors.** keybr literally
   generates lesson text from your weak keys
   ([keybr.com](https://www.keybr.com/)); chess.com auto-creates puzzles
   from your blunders. The strongest personalization pattern.
5. **Modifiers slide one scenario across difficulty.** osu!'s DT/HT mods;
   puzzle depth; target-size scaling. For tetra: gravity, garbage rate,
   preview count, hold-disable as knobs on the same drill.
6. **Game Review: graded, level-calibrated mistake classification.**
   chess.com classifies every move Brilliant→Blunder by **win-probability
   swing** (not raw engine eval), with severity calibrated to player rating
   ([chess.com Game Review](https://www.chess.com/blog/Duckfest/game-review-common-confusion)),
   plus accuracy % and auto-generated puzzles from your own mistakes.
7. **Accuracy-first doctrine; beware farmable metrics.** Typing trainers
   refuse to let speed outrun accuracy; osu!'s pp produced "farm maps" —
   when the headline number is farmable, players optimize the number, not
   the skill ([pp.bcs.dev](https://pp.bcs.dev/)).
8. **The transfer/passivity caveat.** Aim-trainer gains are reliable but
   task-specific ([Frontiers pilot](https://pmc.ncbi.nlm.nih.gov/articles/PMC10925653/));
   chess coaches warn "watching red/green arrows isn't analysis"; engine
   best-lines can "exceed the cognitive limits" of players
   ([arxiv 2505.03251](https://arxiv.org/abs/2505.03251)). Drills must
   bridge back to live play; review must force *re-solving*, not watching.
9. **Spaced repetition for memorizable material.** Chessable's MoveTrainer
   (expand interval on success, reset on miss) for openings
   ([chessable.com/movetrainer](https://www.chessable.com/movetrainer/)) —
   directly portable to openers, PC patterns, and T-spin templates.

## 2.3 Existing Tetris trainers: landscape and gaps

What exists (full survey in sources):

- **TETR.IO** — competition venue + sandbox. Sprint/Blitz/Zen/Custom +
  Zenith roguelike. Exportable `.ttrm` replays. **Zero pedagogy**: no
  lessons, drills, mistake detection, or replay analysis
  ([tetris.wiki/TETR.IO](https://tetris.wiki/TETR.IO)).
- **Jstris** — the most training-aware client: cheese race, user-authored
  Maps with difficulty percentiles, usermodes, and **live finesse-fault
  feedback** (reset on suboptimal keys) — the only real-time mistake
  detection in mainstream guideline Tetris, and it covers only finesse
  ([jstris.jezevec10.com](https://jstris.jezevec10.com/guide)).
- **four.lol + fumen ecosystem** — the encyclopedia. Interactive setups,
  openers, PCs; **sfinder** computes PC probabilities and T-spin operations
  ([github.com/knewjade/solution-finder](https://github.com/knewjade/solution-finder)).
  Reference, never drill: shows the setup, never tests retention.
- **Finesse trainers** — isolated reset-on-error drills
  ([alexanderjohnson.dev/FinesseTrainer](https://alexanderjohnson.dev/FinesseTrainer/)).
- **Bots** — Cold Clear ([github](https://github.com/MinusKelvin/cold-clear)),
  MisaMino: superhuman opponents, used pedagogically only by *watching
  videos and guessing heuristics*
  ([Learning to Play like Cold Clear](https://galactoidtetris.wordpress.com/2021/02/06/learning-to-play-like-cold-clear/)).
- **NES Tetris has what guideline lacks**: **Tetrisfish** is a
  Stockfish-style review tool — OCR a VOD, grade every placement
  Best→Blunder with accuracy % via StackRabbit
  ([github.com/AnselChang/tetrisfish](https://github.com/AnselChang/tetrisfish)).
  Existence proof that Tetris players want and use engine review.
- **Coaching** — Fiverr coaches ~$30/hr; Discord VOD review by hand;
  Galactoid's "Tetris journaling" in spreadsheets — manual labor signaling
  the missing tool.
- **Stat sites** — Tenchi/TetraStats report aggregates (APM/PPS/VS history)
  with zero guidance attached.

**Ranked gaps** (each verified absent, with demand signals):

1. **Engine review for guideline Tetris** — replay in, per-placement
   grading + better-line suggestions out. All raw materials exist
   (`.ttrm` + Cold Clear); nobody has connected them. Proven paradigm
   (chess, Tetrisfish-on-NES). *The headline gap.*
2. **Integrated adaptive curriculum** — diagnose → assign → re-test.
   Curricula are static prose/video; personalization is what people pay
   coaches for.
3. **Bot-as-coach / style emulation** — live or post-hoc suggestions on
   *your* board; "play like X" demonstration bots.
4. **Spaced repetition for setups/openers** — mature tech (FSRS), never
   applied to Tetris pattern memory.
5. **Finesse feedback inside real games** — beyond Jstris's reset: track
   *which* placements you personally fumble, over time.
6. **Adaptive drill generation** — auto-build the cheese/board states you
   are measurably worst at (Jstris Maps are human-authored).
7. **Unified loop** — stats, replays, reference, and drills live on four
   different sites; no tool closes play → measure → diagnose → drill →
   re-measure.

---

# Part 3 — Taxonomy and synthesis

## 3.1 The taxonomy: learning methods × delivery formats

Every way people learn this skill (or skills like it), crossed with the
forms tetra could deliver. **Methods** are what causes learning; **formats**
are the surfaces they're delivered through. Most formats can carry several
methods.

**Methods (what produces the learning):**

| Method | Mechanism | Evidence |
|---|---|---|
| Whole-game play (volume) | integration, specificity, automaticity | necessary, not sufficient — unstructured play plateaus |
| Part-task drill | isolate a bottleneck sub-skill | strong, *if* reintegrated (transfer caveat) |
| Retrieval/recognition practice | testing effect; chunk vocabulary | strong (d≈0.5–0.6) |
| Spaced repetition | distributed practice; fights decay | strong |
| Graduated challenge (DDA/ramps) | edge-of-ability; flow | moderate |
| Post-hoc review (replay/engine) | KP feedback, error diagnosis | moderate; strong when guided + active |
| Worked examples / demonstration | imitation, perceptual modeling | moderate (how styles are actually learned today) |
| Explicit instruction (lessons) | declarative knowledge, cognitive stage | effective early, harmful late |
| Self-explanation / journaling | metacognition, error detection | moderate |
| Sparring (calibrated opponents) | at-speed specificity, pressure inoculation | community-credited at stage 3+ |
| Mastery-gated tutoring loop | diagnose → drill → check → review | strong (d≈0.4–0.8) |
| Assessment itself | retrieval + calibration + motivation | strong (testing effect) |

**Formats (the surfaces that deliver them):**

- **Curriculum ladder** — ordered lessons + mastery gates, controls → basic
  skills → setups → versus theory. (Carries: explicit instruction,
  mastery gating.)
- **Drill** — repeatable scenario with a measurable target: finesse drill,
  cheese race, sprint segment, B2B-hold drill. (Part-task practice,
  graduated challenge.)
- **Puzzle** — fixed board + queue, find the best placement/sequence:
  "T-spin here," "PC in 4," "survive this garbage." Fumen is the substrate;
  sfinder can generate/verify. (Retrieval practice, chunking.)
- **Mini-game** — a drill with game framing and score: downstack rush,
  finesse streak, opener speedrun. (Same methods, engagement wrapper.)
- **Live modes** — full versus/solo play, optionally instrumented: ranked,
  vs-bot sparring at calibrated strength, survival. (Whole-game,
  sparring, assessment.)
- **Benchmark battery** — fixed, repeatable test set producing per-skill
  ratings. (Assessment, weakest-link diagnosis.)
- **Review surface** — post-game replay with engine grading, guided
  questions, re-solve prompts. (Post-hoc review, self-explanation.)
- **Demonstration surface** — watch a bot or replay play a position/style,
  possibly side-by-side with your own attempt. (Worked examples,
  imitation/style learning.)
- **Tutor/coach layer** — the orchestrator that watches everything, picks
  the next activity, and explains why. (Mastery-gated tutoring loop.)
- **SRS deck** — scheduled re-tests of memorizable patterns: openers, PC
  patterns, T-spin templates. (Spaced repetition + retrieval.)

The bot/engine capabilities the user identified map onto formats like so:
**mistake detection** powers the review surface and benchmark diagnosis;
**alternative-line replay** powers review re-solving and puzzle generation
("here's the position you misplayed — find the better line"); **style
emulation** powers the demonstration surface and calibrated sparring.

## 3.2 Training vs testing vs refining — the answer

The literature distinguishes three activities, and the distinction is real,
not bookkeeping:

- **Training (acquisition)** builds skill that doesn't yet exist. Optimal
  conditions: scaffolding, near-errorless motor drills, frequent-then-fading
  feedback, slow-then-fast, blocked-then-interleaved. Performance here is
  *expected to look good and mean little*.
- **Testing (assessment)** measures durable skill — and is itself a potent
  learning event (testing effect). Optimal conditions: standardized,
  spaced, effortful retrieval, no help, at speed. Performance here is the
  *only* trustworthy progress signal (Soderstrom & Bjork: practice
  performance systematically lies).
- **Refining (maintenance/polish)** improves a skill that already exists.
  Optimal conditions: high interleaving, variable at-speed practice, sparse
  bandwidth feedback, spaced review against decay, pressure exposure.

The key consequences for tetra:

1. **They need separate surfaces** — practice, benchmark, and review/ranked
   — because their optimal conditions *conflict* (training wants
   scaffolding and feedback; testing must withhold both).
2. **Scores from training surfaces should never headline.** A player
   feeling worse in interleaved practice while their benchmark climbs is
   the system working.
3. **Ranked/live play is neither training nor testing** — it's the
   integration and motivation surface (specificity, pressure, fun), closest
   to refinement. Chess, Voltaic, and typing trainers all converged on this
   three-way split (rated play / fixed benchmarks / practice).
4. **Testing is cheap learning.** Spaced "board + piece → best move"
   assessments double as the most efficient practice available, so the
   benchmark battery is not overhead — it's a teaching mode.

## 3.3 Proposed practice-mode categories for tetra

Carving the format taxonomy into the smallest set of distinct surfaces that
respects the train/test/refine boundaries:

1. **Learn** (curriculum ladder + lessons + first-touch drills) — stage 0–2
   acquisition; mastery-gated; verbose early, silent later.
2. **Drill** (drills, puzzles, mini-games, SRS deck) — part-task practice
   generated/weighted by the player's measured weaknesses; modifier knobs
   (gravity, garbage, previews) slide difficulty.
3. **Test** (benchmark battery) — fixed, repeatable, per-skill ratings with
   weakest-link aggregation; the only headline progress number.
4. **Play** (live solo/versus, bot sparring at calibrated strength/style) —
   whole-game integration, minimal in-game feedback.
5. **Review** (engine-graded replay + guided re-solve + demonstration) —
   on-demand, delayed, self-assessment first; feeds mistakes back into
   Drill as generated content.

The **tutor/coach layer** sits above all five, routing the player ("your
downstacking benchmark is the bottleneck — here's a 10-minute drill set")
— this is the ITS mastery loop, the highest-leverage structure in the
evidence.

## 3.4 Ranked teaching methods (pedagogical value × evidence × gap)

1. **Engine review of the player's own games** (bot capability a + b:
   mistake detection + alternative lines). Strongest combination of proven
   paradigm (chess Game Review), strong feedback science (delayed,
   on-demand, KP-style), direct dependence on tetra's headless engine, and
   the #1 ecosystem gap. Must be built actively (re-solve flagged
   positions) and level-calibrated (grade by win-relevant swing, not
   stacking perfection). *Serves stages 1–4.*
2. **Benchmark battery with per-skill ratings.** The testing effect makes
   it a learning mode; weakest-link aggregation makes it a diagnosis
   engine; it's the precondition for every adaptive feature. Cheap to build
   on existing modes (sprint, cheese, blitz already exist). *All stages.*
3. **Weakness-targeted drill/puzzle generation** (incl. from the player's
   own reviewed mistakes — keybr/chess.com pattern). Retrieval practice +
   personalization; fumen + sfinder + the engine make generation tractable.
   *Stages 1–3.*
4. **Mastery-gated curriculum (Learn surface).** Tutoring-loop evidence is
   strong and nothing like it exists for Tetris; but it's content-heavy to
   author and serves mostly stages 0–2. The winternebs benchmarks supply
   the gate structure for free.
5. **Calibrated bot sparring.** Sparring is the community's prescription
   for stage 3+, and adjustable-strength opponents implement DDA on the
   play surface. Requires a competent bot but not a superhuman one.
   *Stages 2–4.*
6. **SRS deck for setups/openers/PCs.** Cheap, proven mechanism
   (MoveTrainer), clear gap; narrower payoff (memorizable material only).
   *Stages 2–3.*
7. **Style emulation** (bot capability c). Coherent (styles are real,
   learned by imitation today) and differentiating, but the evidence base
   (worked examples/imitation) is more moderate and it demands the most
   from the bot (style-conditioned play, not just strong play). Best as a
   later layer on the demonstration/review surfaces. *Stages 3–4.*
8. **Pure gamification (streaks/XP/leagues).** Use only in service of
   spacing and showing up; never as the progress signal. Evidence says
   engagement ≠ learning, and Duolingo shows the failure mode.

A note on sequencing implied but not mandated by this ranking: methods 1–3
share one dependency — the engine must be able to *evaluate a position and
enumerate good placements*. That capability, not any single mode, is the
pedagogical core. This is consistent with PROGRESS.md's standing open
thread (headless CLI runner first) without committing to an RL stack.

---

# Part 4 — Annotated sources

**Tetris community canon**
- [winternebs TETRIS-FAQ](https://winternebs.github.io/TETRIS-FAQ/) — the
  canonical progression curriculum: benchmarks, gates, versus theory,
  attack tables. The skill-ladder backbone. Mine hardest.
- [four.lol](https://four.lol/) — the canonical technique encyclopedia
  (openers/methods/stacking/PCs), concept-ordered, no rank mapping.
- [tetrio.wiki.gg — TETRA LEAGUE](https://tetrio.wiki.gg/wiki/TETRA_LEAGUE)
  / [Terms](https://tetrio.wiki.gg/wiki/Terms) — rank system; definitive
  playstyle glossary (stride/plonk/opener/InfDS/hybrid).
- [tetrio.team2xh.net](https://www.tetrio.team2xh.net/) (+ /faq) — rank
  percentile distributions; APM/PPS/APP/VS definitions.
- [harddrop.com/wiki](https://harddrop.com/wiki/Perfect_Clear_Opener) —
  legacy reference; PCO math; glossary.
- [Galactoid's guides](https://galactoidtetris.wordpress.com/) — deep
  individual-authored guides (finesse, PCs, Cold Clear imitation,
  journaling/coaching).
- [howtotetris.com](https://howtotetris.com/) — curated 60+ video
  curriculum, beginner→expert, passive.

**Learning science** (key items; full citations in Part 2.1)
- Soderstrom & Bjork 2015, *Learning vs Performance* — the keystone.
- Macnamara et al. 2014 — deliberate-practice meta-analysis (the corrective).
- Chase & Simon 1973 + successors — chunking.
- Cepeda et al. 2006 — spacing. Nature 2024 meta-analysis — interleaving.
- Guidance hypothesis line ([PMC6698475](https://pmc.ncbi.nlm.nih.gov/articles/PMC6698475/)) — faded/delayed feedback.
- Roediger & Karpicke 2006 + meta-analyses — testing effect.
- VanLehn 2011; Kulik & Fletcher 2016 — tutoring/ITS realistic effects.
- [Esports cognitive expertise meta-analysis](https://pmc.ncbi.nlm.nih.gov/articles/PMC11316462/) — spatial cognition + accuracy > RT.
- Lindstedt & Gray ([PubMed 30543908](https://pubmed.ncbi.nlm.nih.gov/30543908/)); Meta-T — Tetris-specific expertise science.

**Trainer teardowns**
- [chess.com Game Review explained](https://www.chess.com/blog/Duckfest/game-review-common-confusion) — win-probability grading, rating-relative severity, coach unreliability.
- [Lichess puzzle themes](https://lichess.org/training/themes) — the taxonomy exemplar.
- [Chessable MoveTrainer](https://www.chessable.com/movetrainer/) — SRS for game patterns.
- [Voltaic](https://voltaic.gg/) / [benchmarks](https://app.voltaic.gg/benchmarks) — benchmark battery, energy/weakest-link ranks, VDIM.
- [Aim-trainer transfer pilot study](https://pmc.ncbi.nlm.nih.gov/articles/PMC10925653/) — reliable measurement, task-specific gains.
- [keybr](https://www.keybr.com/) — error-profile-generated lessons.
- [osu! performance points](https://osu.ppy.sh/wiki/en/Performance_points) — difficulty scalars, mods, the farm-map failure ([pp.bcs.dev](https://pp.bcs.dev/)).
- [Duolingo gamification critique](https://dev.to/pocket_linguist/why-duolingos-gamification-works-and-when-it-doesnt-1d4); [arxiv 2203.16175](https://arxiv.org/abs/2203.16175) — engagement ≠ learning.
- [arxiv 2505.03251](https://arxiv.org/abs/2505.03251) — engine output exceeding human cognitive limits.

**Existing Tetris trainers**
- [TETR.IO wiki](https://tetris.wiki/TETR.IO); [.ttr format](https://docs.fileformat.com/game/ttr/) — modes, replay substrate.
- [Jstris guide](https://jstris.jezevec10.com/guide) — cheese, maps, finesse-fault.
- [sfinder](https://github.com/knewjade/solution-finder) — PC/T-spin solver, fumen I/O.
- [Cold Clear](https://github.com/MinusKelvin/cold-clear) / [CC2](https://github.com/MinusKelvin/cold-clear-2); [MisaMino](https://tetris.fandom.com/wiki/MisaMino) — the engines.
- [Tetrisfish](https://github.com/AnselChang/tetrisfish) / [StackRabbit](https://github.com/GregoryCannon/StackRabbit) — NES engine review: the existence proof.
- [TetraStats](https://git.dan63.by/dan63/TetraStats); [Inoue](https://github.com/szymonszl/inoue) — stats and replay tooling, guidance-free.

**Survey caveats**: several primary pages (Tetresse, nestris.org wiki, some
four.lol subpages) 403'd to automated fetch and were corroborated via search
summaries; Reddit demand-signal threads were characterized from secondary
sources. A human pass through r/Tetris would strengthen the demand evidence
for the top gaps.
