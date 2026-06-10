# Bot/engine substrate: what machine should sit under tetra?

> Deep-research report, 2026-06-09. Six parallel research passes — Tetris
> cognition, engine-as-platform teardowns, the Tetris bot landscape,
> human-like/skill-conditioned AI + the replay-data question, coaching
> mechanisms across games, and the evidence on choice/explanation-based
> coaching — synthesized against VISION.md, `research/pedagogy.md`, and
> tetra's engine (`docs/engine.md`). The question under test: is the
> chess.com model — **one engine powering many products** — the right shape
> for Tetris, and if so, what kind of core?

## TL;DR

1. **The chess analogy fails at the move level and holds at the platform
   level.** A Tetris placement is a *shallow, wide* decision: ~34 candidate
   placements, evaluated almost entirely by static board-quality features,
   with lookahead value mostly captured at 1–2 pieces and a measured
   132×-cost wall at depth 3. The state space converges so heavily that
   deep distinct "lines" mostly don't exist — which is *why* one-piece
   heuristic bots clear millions of lines. There is no Tetris equivalent of
   a 20-ply variation worth showing a student.
2. **But chess platforms barely use their engines for deep live analysis
   either.** The teardown's central finding: chess.com/lichess engines are
   mostly **offline content factories** — puzzles mined once from 300M
   games, openings precomputed, difficulty graded by *humans* (Glicko over
   attempts), explanations templated over engine output. The high-volume
   products touch the engine zero times at serve time. That consumption
   pattern — evaluate, generate, grade, spar — fits a shallow-search Tetris
   engine *better* than it fits chess.
3. **The recommended core is a hybrid: heuristic search + hand-written
   concept detectors.** Handcrafted-feature search is the strongest Tetris
   approach per unit effort by two orders of magnitude over deep RL, fully
   explainable, needs zero data, and runs in-browser in microseconds.
   Hand-written detectors over its candidates produce the idea-labels
   ("keeps the well clean") the recommender needs. Learned-from-replays
   (Maia-for-Tetris) is architecturally portable but **data-gated**:
   TETR.IO has superb skill labels and keypress-level replays, but no
   official bulk replay endpoint — acquisition runs through a gray-area
   proxy plus an engine-reimplementation burden. Defer it; don't depend on it.
4. **One core does serve five of the six consumers** — paused
   decision-points, post-game review, strategy comparison, puzzle/drill
   generation, and (cheaply) live hints all consume the same
   enumerate→evaluate→detect substrate. The honest negative case, mirrored
   exactly in chess: **believably human sparring is the consumer a strong
   core serves badly.** Maia exists because weakened Stockfish feels wrong;
   human-likeness is a *separate model*, not a knob on the strong one.
   tetra should plan sparring as a second, separable system and accept a
   hand-tuned (systematic, not random-blunder) ladder initially.
5. **The evidence answers the deferred interaction questions decisively:**
   make the player commit a placement *before* showing candidates
   (pretesting + cognitive-forcing evidence, 8%→27% on cases where the AI
   is wrong); one-line idea-labels capture most of the explanation benefit
   (verification d≈0.05 → elaborated d≈0.49); explanations should fade
   with skill (expertise reversal); and explicit reasoning belongs in
   paused/review surfaces only — verbal rules measurably interfere with
   fast motor execution under pressure (reinvestment theory).

---

# Part 1 — The chess-analogy verdict

## 1.1 The structure of a single Tetris decision

A chess move opens a tree: ~35 legal moves per ply, decisive tactical
sequences 10+ plies deep, masters spending minutes calculating concrete
variations. A Tetris placement is the opposite shape — **wide and shallow**:

- **Branching**: at most ~34 distinct (column × rotation) final placements
  per piece, roughly doubled by hold — and all of them enumerable and
  statically evaluable in microseconds
  ([codemyroad Tetris AI](https://codemyroad.wordpress.com/2013/04/14/tetris-ai-the-near-perfect-player/)).
- **Depth**: lookahead has steep diminishing returns. The canonical
  near-perfect marathon bot uses **one** lookahead piece and four features
  (height, lines, holes, bumpiness) and cleared 2,183,277 lines before
  being stopped. Heise's AI: 3-ahead → 8.9% tetris-rate, 6-ahead → 9.7% —
  ~0.8 points for doubling depth
  ([ryanheise.com](https://www.ryanheise.com/tetris/tetris_artificial_intelligence.html)).
  One measured attempt at depth 3 paid **132× the compute for ~13% more
  score** ([domslee.com](https://domslee.com/2020/04/12/high-score-tetrisai-improved.html)).
- **Time**: the decision resolves in sub-seconds at competitive speed
  (2–3+ pieces per second), versus minutes per move in chess. There is no
  room for in-game calculation even if it paid.

The strongest guideline bots confirm the shape: Cold Clear searches a
transposition-aware DAG over placements with a **hand-written linear
evaluation** (~20 board features: holes −173, height −39, T-slot patterns
+8…+407, perfect clear +999, …) — value lives in the static evaluation,
not in depth
([cold-clear standard.rs](https://github.com/MinusKelvin/cold-clear/blob/master/bot/src/evaluation/standard.rs)).

## 1.2 Does the state space merge too fast for "lines"?

Yes, mostly. Formally, the board space is astronomically large (~2^200
raw) but the *reachable, distinguishable* decision space collapses:
enormous numbers of move orders converge on identical stacks (the
"constructibility" literature treats Tetris configurations as
merge-heavy by construction —
[Kosters et al.](https://liacs.leidenuniv.nl/~kosterswa/tetris/ijigstetrisfinal.pdf);
an algebraic treatment models piece placements as a transformation
semigroup, [arXiv:2004.09022](https://arxiv.org/pdf/2004.09022)). Future
board value is largely **path-independent** — which is precisely why
one-piece heuristic evaluation works near-optimally. Chess variations have
no analogue here.

The exception — and it matters pedagogically — is that **bounded,
template-shaped multi-piece plans do exist**: openers (TKI, DT Cannon,
PCO), T-spin stacking systems (LST, ST), perfect-clear loops, 4-wide
combos ([four.lol](https://four.lol/),
[Hard Drop wiki](https://harddrop.com/wiki/Opener)). But the community is
explicit that these are **patterns to recognize, not lines to calculate**,
and warns against memorizing them too early: "it will limit your growth if
you try to just 'memorize' a list of setups"; openers are gated behind a
~1:15 40-line sprint benchmark
([winternebs FAQ](https://winternebs.github.io/TETRIS-FAQ/versus/)).

## 1.3 Analysis-shaped or pattern-shaped? Stage-dependent — but never calculation

The cognitive-science record is unusually direct for this question:

- **Kirsh & Maglio (1994)**: Tetris experts rotate pieces physically *more
  than necessary* to prime recognition rather than compute mentally —
  skill is recognition-driven, offloaded onto the world
  ([Cognitive Science 18:513–549](https://onlinelibrary.wiley.com/doi/abs/10.1207/s15516709cog1804_1)).
- **Gray & Lindstedt (2017), "Plateaus, Dips, and Leaps"** (492 players):
  improvement proceeds by *technique discoveries* — performance dips while
  a new technique is explored, then leaps. "The limit to Tetris expertise
  is not raw keypress time but the techniques acquired"
  ([Cognitive Science](https://onlinelibrary.wiley.com/doi/10.1111/cogs.12412)).
- **Lindstedt & Gray (2020), "The cognitive speed-bump"**: what separates
  world champions from regional experts is a perceptual-motor strategy —
  bi-rotational play driving wasted rotations to near zero (champions
  0.022 extraneous rotations/episode vs novices' 1.132), bought at a
  measurable per-decision reaction-time cost (57–126 ms by rotation
  complexity) that pays back seconds per game
  ([CogSci 2020](https://escholarship.org/uc/item/7gv9443c)). Not deeper
  board analysis — cheaper execution.

Chess expertise is *also* recognition-first (Chase & Simon chunking,
~50k-chunk estimates —
[Perception in Chess](https://www.sciencedirect.com/science/article/abs/pii/0010028573900042));
the difference is the second layer. Chess layers **deliberate calculation**
on top of recognition; Tetris layers **motor automaticity under time
pressure**. By stage:

| Stage | Dominant skill | What "study" looks like |
|---|---|---|
| Beginner | explicit placement reasoning, flat-stacking basics | slow, declarative — the most analysis-like phase |
| Intermediate | template acquisition (openers, T-spin shapes, well discipline) | pattern library building; the prime engine-review audience |
| Advanced/top | automatized recognition + motor efficiency (finesse, bi-rotation, queue reading) | drills, speed benchmarks, replay self-review — not analysis |

## 1.4 What chess platforms actually do with their engines

The pivotal reframe: the chess.com analogy was never really about live
deep analysis. The teardown of chess.com/lichess/KataGo/GTO Wizard finds
the engine is consumed in four modes, and **live-deep is the rarest**:

| Product | Engine consumption |
|---|---|
| Analysis board | live, client-side WASM (deliberately weakened builds — chess.com ships no-NNUE "lite" to browsers) ([chess.com engine docs](https://support.chess.com/en/articles/9462780-chess-engines-on-chess-com-how-do-they-work)) |
| Game review | offline/queued batch (lichess: 100% donated via fishnet) ([fishnet](https://github.com/lichess-org/fishnet)) |
| Puzzles | **one-time generation, zero engine at serve time** — lichess mined ~300M games (50+ CPU-years, once) into a 4.4M-puzzle static DB ([lichess-puzzler](https://github.com/ornicar/lichess-puzzler)); chess.com: 570k+ puzzles, ~900/day ([chess.com blog](https://www.chess.com/blog/CHESScom/how-we-built-a-puzzle-database-with-half-a-million-puzzles)) |
| Puzzle difficulty | **not the engine — humans**: each puzzle holds a Glicko-2 rating updated by user attempts ([lichess forum](https://lichess.org/forum/lichess-feedback/puzzle-difficultyrating)) |
| Opening explorer | precomputed statistics, no engine ([lila-openingexplorer](https://github.com/lichess-org/lila-openingexplorer)) |
| Lessons | human-authored, engine absent |
| "Coach" explanations | presentation layer templated over (eval delta, PV, moving piece) — not engine intelligence ([Game Review docs](https://support.chess.com/en/articles/8584089-how-does-game-review-work)) |
| Human-like bots | **a different engine entirely** (Maia: separate policy nets at `go nodes 1`) ([maia-chess](https://github.com/CSSLab/maia-chess)) |

Puzzle mining criteria are worth recording because tetra can copy them
directly: lichess accepts a position only on a large win-probability swing
(+0.6), a **unique** best move (best beats second-best by +0.7 win-prob),
and a clear resulting verdict
([generator.py](https://github.com/ornicar/lichess-puzzler/blob/master/generator/generator.py)).
"Mistake" is contextual, weighted by whether the position was already
lost ([Learn from your mistakes](https://lichess.org/blog/WFvLpiQAACMA8e9D/learn-from-your-mistakes)).

## 1.5 Verdict

**Per-decision deep analysis is not the right primitive for Tetris; the
engine-as-platform model still is.** Stated as the spec's checklist:

- *Is per-decision analysis meaningful?* Shallowly, yes: "your placement
  vs the eval-best placement, and why" is meaningful and is exactly what
  the beloved NES-Tetris review tool already ships
  ([Tetrisfish/nestris.org](https://github.com/AnselChang/tetrisfish),
  StackRabbit-powered) — and what `research/pedagogy.md` ranks as the #1
  teaching method for tetra. Deeply, no: there are no lines to show, and
  nothing like chess's "calculate the variation" pedagogy to transfer.
- *Does the state space merge too fast for lines?* Yes — except bounded
  named templates (openers, setups, PC loops), which function as a finite,
  curatable pattern vocabulary, not a search space.
- *Analysis-shaped or pattern-shaped skill?* Pattern + motor at every
  level, most explicit (template acquisition) at intermediate level, most
  motor at the top. The engine's pedagogical contribution therefore tilts
  from "analyze my move" toward **evaluate / generate / grade / spar**:
  shallow evaluation for review and choice-grading, generation of the
  right practice situations (the chess-puzzle pipeline transplanted), and
  graded drills — exactly the consumption modes that dominate the chess
  platforms anyway.

Honest differences from chess, collected: no deep variations; sub-second
decisions (live commentary impossible, paused surfaces required); a heavy
motor component chess lacks entirely (and with it, a class of
detector-driven drills chess never needed — finesse); hidden information
(queue beyond preview) making evaluation distributional; irreversibility
(no takeback culture); and far thinner editorial infrastructure (no
850k-game master DB, no theme taxonomy — tetra must mine or author its
own, though Fumen + four.lol supply a seed vocabulary).

---

# Part 2 — The recommender: candidates that carry ideas

The interview's flagship interaction — pause at a decision point, show N
candidates each carrying an idea, the player chooses — turns out to be the
single best-supported design in the whole evidence base. The deferred
questions resolve as follows.

**Are explanations essential?** Yes — at one-line depth, fading with
skill. The feedback meta-analysis (Van der Kleij 2015, 40 studies) puts
verification-only feedback at d≈0.05, correct-answer at d≈0.32,
**elaborated (why) at d≈0.49**, with the advantage largest for
higher-order learning
([RER 2015](https://journals.sagepub.com/doi/10.3102/0034654314564881)).
The big step is from *nothing to some reason*; no evidence found that full
variation-depth analysis beats a crisp concept label. Meanwhile low-level
"where the AI looked" explanations (saliency maps) repeatedly fail to
help humans in user studies
([Anderson et al.](https://ar5iv.labs.arxiv.org/html/1903.09708),
[Atrey et al.](https://people.cs.umass.edu/~kclary/Atrey_Exploratory19.pdf)),
while **concept-level** explanations extracted from a superhuman agent
measurably improved play even for grandmasters — all four GMs in the
AlphaZero concept-transfer study improved
([Schut et al., PNAS 2025](https://www.pnas.org/doi/10.1073/pnas.2406675122)).
Idea-labels are the right granularity; heatmaps and raw evals are not.

**Commit-first.** The player should place (or pick) their own move before
candidates appear. Three independent literatures agree: the pretesting
effect (wrong guesses still improve later learning —
[Richland, Kornell & Kao](https://learninglab.uchicago.edu/Pre-Testing_files/RichlandKornellKao.pdf)),
the generation effect, and cognitive forcing in AI decision support —
making the human decide first raised correct decisions on AI-wrong cases
from 8% to 27% (d=0.66) versus explanation-on-display
([Buçinca et al. 2021](https://arxiv.org/abs/2102.09692)). Chess coaching
lore independently converges ("enter your own candidate before revealing
the engine"). Known cost: commit-first designs are rated harder and less
pleasant — they work *because* they're effortful. Expect grumbling;
don't soften it away.

**Plausible wrong candidates are a feature.** Multiple-choice research
shows competitive lures make the interaction a multi-fact learning event —
the learner retrieves *why the alternatives are worse*
([Little & Bjork](https://bjorklab.psych.ucla.edu/wp-content/uploads/sites/13/2017/01/LittleBjorkMC2014.pdf)).
So candidates should not be the engine's top-N near-duplicates; they
should be *idea-diverse* — "build the T-spin", "burn and stay safe",
"keep the well", even when one is clearly better.

**Fading.** The expertise reversal effect (Kalyuga): explanations that
help novices become counterproductive for experts, who need bare practice
([Kalyuga 2007](https://www.uky.edu/~gmswan3/EDC608/Kalyuga2007_Article_ExpertiseReversalEffectAndItsI.pdf)).
Explanation density should be a function of player level, trending to zero.

**Where this interaction must NOT live: at speed.** Reinvestment theory:
explicit, verbalizable rules disrupt automated motor execution under
pressure ([Masters line](https://pmc.ncbi.nlm.nih.gov/articles/PMC6341961/));
the guidance hypothesis warns constant immediate feedback creates
dependency measurable at retention
([Salmoni/Schmidt/Walter line](https://pmc.ncbi.nlm.nih.gov/articles/PMC1780106/)).
Candidates-with-ideas belongs in paused decision-points and review;
in-game live overlays should stay sparse, spatial (ghosts, highlights),
and fade with mastery.

Two failure modes to design against, both evidenced: **overreliance**
(explanations increase acceptance of recommendations regardless of
correctness — [Bansal et al. 2021](https://arxiv.org/pdf/2006.14779);
mitigated by commit-first) and **fluency illusion** (watching the best
line replay feels like learning and isn't; the learner must generate).

---

# Part 3 — The mechanism taxonomy

Every mechanism found for turning a concept into in-game experience,
organized by class. Columns: what concept types it suits (MOTOR /
PATTERN / JUDGMENT / PLAN / STRAT), what it needs from the substrate
(**E** = engine intelligence: enumerate/evaluate/detect; **R** = only
replay/state infrastructure), and whether it leans on cheap
snapshot/branch (**S**) — which tetra's pure seeded engine makes nearly
free.

### (i) Shaped / constrained policies
| Mechanism | Example | Suits | Needs |
|---|---|---|---|
| Human-imitation bot at a rating band | Maia on lichess ([maia-chess](https://github.com/CSSLab/maia-chess)) | JUDGMENT, STRAT | E (separate model) |
| Personality/style bots | chess.com Komodo personalities; Chessiverse 600+ per-bot nets ([Chessiverse](https://chessiverse.com/blog/how-we-build-human-like-chess-bots/)) | STRAT | E |
| Single-behavior dummy | fighting-game dummy set to only anti-air | MOTOR, JUDGMENT | R |
| Concept-constrained bot ("downstack-only") | **not found shipped anywhere** — open gap tetra could own | JUDGMENT, PLAN | E (eval reweighting) |

### (ii) Heuristic detectors firing feedback
| Mechanism | Example | Suits | Needs |
|---|---|---|---|
| Motor-fault detector | jstris finesse flags + optional **board-reset-on-fault** ([jstris guide](https://jstris.jezevec10.com/guide)) | MOTOR | R (rule-based, no eval) |
| Missed-opportunity detector | Tekken 8 "you could have punished" ([My Replay & Tips](https://www.oneesports.gg/tekken/tekken-8-replays-and-tips/)) | JUDGMENT | E |
| Placement grader | Tetrisfish Best→Blunder vs StackRabbit eval ([tetrisfish](https://github.com/AnselChang/tetrisfish)) | JUDGMENT, PLAN | E |
| Context-weighted mistake flag | lichess: blunder threshold conditioned on position state ([blog](https://lichess.org/blog/WFvLpiQAACMA8e9D/learn-from-your-mistakes)) | JUDGMENT | E |

### (iii) Visual languages
| Mechanism | Example | Suits | Needs |
|---|---|---|---|
| Policy painted on the world | Forza driving line ([Driver Assists](https://forza.fandom.com/wiki/Driver_Assists)); Tetris' own ghost piece | MOTOR | E or R |
| Concept made spatial | chess.com coach arrows / "Show Fork" highlights ([Game Review](https://support.chess.com/en/articles/8584089-how-does-game-review-work)) | PATTERN, JUDGMENT | E |
| State visualization | hitboxes, frame-data overlays, input display | MOTOR | R |
| Position notation | **Fumen** — shareable, searchable Tetris position strings ([tetris.wiki/Fumen](https://tetris.wiki/Fumen)) | PATTERN, PLAN | R |

### (iv) Interaction affordances
| Mechanism | Example | Suits | Needs |
|---|---|---|---|
| **Replay takeover** | Tekken 8 / SF6: freeze a flagged replay moment, seize control, retry indefinitely ([eventhubs](https://www.eventhubs.com/news/2023/sep/22/tekken-8-replay-system-features/)) — closest shipped prior art to tetra's paused-decision-point | JUDGMENT | E+R, **S** |
| Retry-the-move | lichess Learn from your mistakes; chess.com Retry | JUDGMENT | E, **S** |
| Savestate segment drill | Celeste SpeedrunTool ([repo](https://github.com/DemoJameson/Celeste.SpeedrunTool)) | MOTOR | R, **S** |
| Pause-and-study, slow-down, section loop | rhythm-game practice; pausable clients | PLAN, MOTOR | R, **S** |
| Dummy recording/playback | fighting-game training | MOTOR, JUDGMENT | R |

### (v) Environment shaping
| Mechanism | Example | Suits | Needs |
|---|---|---|---|
| Procedural adversity generator | jstris cheese race (tetra already has `insertCheese`) | PLAN, JUDGMENT | R (seeded) |
| Curated scenario banks | Blockfish downstack drills, T-spin Roulette, PC trainers ([tool list](https://galactoidtetris.wordpress.com/2025/01/11/list-of-tetris-practice-tools/)) | PATTERN, PLAN | R (+E to author) |
| **Puzzles mined from your own games** | lichess/chess.com/Aimchess; Tetrisfish retry | JUDGMENT | E (offline), **S** |
| Concept-tagged puzzle DB | lichess themes, 4M+ downloadable ([themes](https://lichess.org/training/themes)) | PATTERN | E once |

### (vi) Comparison surfaces
| Mechanism | Example | Suits | Needs |
|---|---|---|---|
| Ghost racing / delta feedback | Trackmania PB + target ghosts | MOTOR, PLAN | R |
| "What the bot would have done" diff | Game Review, Tetrisfish | JUDGMENT | E, **S** |
| Ghost-of-a-rank | SF6 V-Rival: an opponent reconstructed at a target tier ([gamerant](https://gamerant.com/street-fighter-6-replay-v-rival-features-explained/)) | STRAT | E |
| Side-by-side strategy playout | fork one state under two policies and diff — barely shipped anywhere; cheap for tetra | STRAT, PLAN | E, **S** |

### (vii) Sequencing / curriculum
| Mechanism | Example | Suits | Needs |
|---|---|---|---|
| Spaced repetition over patterns | Chessable MoveTrainer; **TETRainer** (SRS + PC solver, the direct Tetris precedent — [tetrainer.com](https://tetrainer.com/)) | PATTERN | R (+E to grade) |
| Step-by-step trials / mission mode | combo trials; GG Strive missions ([eventhubs](https://www.eventhubs.com/news/2021/may/23/guilty-gear-mission-mode/)) | MOTOR→STRAT ladder | R |
| Diagnosis → daily plan | Aimchess ([review](https://www.raindropchess.com/aimchess-review-does-personalized-chess-training-actually-work/)) | STRAT | E (batch) |

**Novel framings worth keeping** (the wide-net findings): the detector
*as* the curriculum (jstris board-reset-on-finesse-fault — failure-gated
repetition); drilling into *strangers'* moments (SF6 lets you take over
anyone's replay, turning the playerbase's games into a queryable scenario
bank); ghost-of-a-rank rather than ghost-of-a-run; notation-as-data
(Fumen strings as searchable, composable artifacts); assists designed to
be outgrown (Forza line telemetry as a skill signal — the one large-scale
empirical study of assists,
[FDG 2014](https://www.microsoft.com/en-us/research/publication/off-with-their-assists-an-empirical-study-of-driving-skill-in-forza-motorsports-4/),
found segments who never disable them — dependency is real); and the
solver-graded SRS loop (TETRainer).

Effectiveness evidence is thin everywhere — replay takeover, ghosts, and
trials ship on design rationale, not RCTs. Where evidence exists it favors:
spaced repetition (strong, general), elaborated feedback (Part 2),
puzzles→pattern-recognition with no far transfer
([Sala & Gobet](https://journals.sagepub.com/doi/10.1177/0963721417712760)),
and the community's own well-replicated critique that **execution drills
don't teach decisions** ("combo trials don't teach neutral") — which maps
to: finesse drills won't teach stacking judgment, and vice versa.

---

# Part 4 — The core: learned vs heuristic vs hybrid

## 4.1 What exists

| Bot | Domain | Method | Eval | Open-source | Browser |
|---|---|---|---|---|---|
| **Cold Clear** | guideline | transposition-aware DAG, MCTS-style expansion; 11-piece PC search | handcrafted linear, published weights | **MPL-2.0**, archived 2024 | **yes** — `web.rs`, runs in Jstris ([repo](https://github.com/MinusKelvin/cold-clear)) |
| Cold Clear 2 | guideline | multithreaded transposition tree | unpublished | Apache-2.0/MIT | likely ([repo](https://github.com/MinusKelvin/cold-clear-2)) |
| MisaMino | guideline | heuristic depth search | handcrafted | license **unclear** | ported to Jstris ([repo](https://github.com/misakamm/MisaMino)) |
| StackRabbit | NES | depth-~3 search | handcrafted + value iteration | yes (license unclear) | **yes** — WASM ([repo](https://github.com/GregoryCannon/StackRabbit)) |
| Tetrisfish / nestris.org | NES review | (StackRabbit) | — | yes | yes ([repo](https://github.com/AnselChang/tetrisfish)) |
| nuno-faria/tetris-ai | simplified | DQN over enumerated placements | learned (4 features, 2×32 MLP) | yes | trivially portable ([repo](https://github.com/nuno-faria/tetris-ai)) |

Interface prior art: the **Tetris Bot Protocol** (TBP) is the de-facto
bot interface, and it is **placement-level**: board + queue + hold in,
`{orientation, x, y, spin}` suggestions out — no keypresses anywhere
([tbp-spec](https://github.com/tetris-bot-protocol/tbp-spec)).

## 4.2 The academic record

Unambiguous. Handcrafted features + optimization dominates:
Dellacherie's 6 hand-tuned features ≈ 660k lines; cross-entropy-trained
feature weights ≥ 300k–35M lines
([Szita & Lőrincz](https://direct.mit.edu/neco/article/18/12/2936),
[Thiery & Scherrer BCTS](https://inria.hal.science/inria-00418954/document),
RL Competition 2008 winner). The survey verdict: **"no deep learning
algorithm has learned to play well from raw inputs"** — DQN-style attempts
cleared *hundreds* of lines where feature methods clear *tens of millions*
([Algorta & Şimşek 2019](https://arxiv.org/abs/1905.01652)). The one
learned approach that works cheaply (DQN over **enumerated placements**
with 4 features) succeeds precisely because it borrows the
heuristic-search action abstraction. And the strongest versus bots (Cold
Clear, MisaMino) are handcrafted-feature search too. For tetra this also
de-risks the future RL phase: the placement enumerator + feature layer
*is* the observation/action abstraction an RL agent will want.

## 4.3 The replay-data verdict (Maia-for-Tetris)

The architecture transfers; the data is the gate.

- **Maia's recipe**: behavioral cloning per rating bucket (Maia-1: 12M
  games/bucket, 9 buckets, >52% move-match vs depth-limited Stockfish's
  41% — [paper](https://ar5iv.labs.arxiv.org/html/2006.01855)); Maia-2:
  one model, skill embeddings in attention, 169M games
  ([NeurIPS 2024](https://arxiv.org/html/2409.20553v1)). Chess had a
  billion-game open database; that's the part Tetris lacks.
- **TETR.IO**: *labels are better than chess's* (Glicko-2 TR + rank on
  every league player) and *replays are keypress-level with timing* —
  format-matched to tetra's `Action` space. But the TETRA CHANNEL API
  exposes stats, **not bulk replays**; the main game API threatens
  account suspension; real acquisition runs through a community
  proxy backed by a bot account
  ([inoue](https://github.com/szymonszl/inoue)) — gray area, version-fragile.
  And replays are seed+inputs, so reconstructing board states requires a
  faithful reimplementation of TETR.IO's engine semantics
  ([Triangle.js](https://github.com/Genius6942/triangle), unofficial,
  chases game updates). ([API docs](https://tetr.io/about/api/))
- **Jstris**: replays easier to fetch ([API](https://jezevec10.github.io/jstris-api-docs/)),
  labels weaker.
- No published Maia-for-Tetris exists. It is a genuine open gap — but a
  research project, not a foundation.

**Verdict: feasible-with-friction, not foundational.** Don't make any
consumer depend on learned human-likeness. Revisit if/when a sanctioned
bulk-replay path appears (or tetra accumulates its own labeled replays —
every game tetra hosts is seed+inputs by construction, the exact training
format; at sufficient scale this becomes first-party data nobody else has).

## 4.4 In-browser viability and fit with tetra's engine

Cost is a non-issue at review/paused latencies: ~34 placements × a linear
eval over ~20 board features is microseconds in JS; even small-MLP
inference is sub-millisecond in ONNX Runtime Web/TF.js; Cold Clear and
StackRabbit both already run as WASM in production web tools. A WebWorker
keeps search off the UI thread for live consumers.

The one real impedance mismatch, confirmed across the whole bot ecosystem:
**bots think in placements; tetra's `Action` type is keypresses.** Every
strong bot emits a target pose (TBP `{orientation, x, y, spin}`); tetra's
engine consumes `left|right|cw|ccw|r180|…`. The bridge — a placement
enumerator + placement→keypress pathfinder (finesse generator) validated
against tetra's own SRS tables via `canFit` — is not borrowable (it's
engine-specific by nature, folded inside `moves.rs` in Cold Clear) and is
therefore **the first thing to build**. It is also, conveniently, the
substrate three other things need: finesse detection (compare the
player's keys to the optimal sequence), the RL action abstraction, and
TBP compatibility (tetra could host external bots like Cold Clear behind
the same adapter).

## 4.5 Recommendation

**Hybrid, heuristic-first:**

1. **Core = placement enumerator + handcrafted-feature evaluation**
   (start from the published, battle-tested feature sets: Dellacherie,
   BCTS, Cold Clear's weights — all portable to a `Uint8Array` board in an
   afternoon each) + **hand-written concept detectors** that annotate
   candidates and board states with ideas: well status, T-slot
   created/wasted, hole created, B2B preserved, downstack progress,
   surface parity. Search generates, detectors explain.
2. Explainability: high (features and detectors are inspectable, the
   labels are honest); data needed: none; build cost: small; browser:
   trivial. Every Part 6 consumer except believable sparring runs on it.
3. **Fallback / escalation path**: if hand-tuned evaluation proves too
   weak for high-level review credibility, wrap **Cold Clear via WASM +
   TBP adapter** (MPL-2.0 permits it) as the strong oracle, keeping
   tetra's detectors as the explanation layer over its suggestions.
4. **Learned human-likeness stays deferred** (4.3) — slot it in later as
   the sparring model behind the same TBP-shaped interface if the data
   path materializes.

---

# Part 5 — Difficulty ladders and style archetypes

**What makes a weakened bot feel like a weaker human?** The negative case
is well documented: strength-limited engines (Stockfish skill levels —
randomized score-noise over candidates + capped depth) remain *more*
accurate at predicting strong players' moves than weak players' even when
calibrated to weak ratings — they play strong moves punctuated by random
blunders, which is exactly the uncanny pattern the Maia paper measured
and players report ([Maia paper](https://ar5iv.labs.arxiv.org/html/2006.01855),
[Stockfish docs](https://official-stockfish.github.io/docs/stockfish-wiki/UCI-&-Commands.html)).
Commercial bot-makers independently converged: believable weakness means
**systematic, level-appropriate mistakes** ("missing a fork"), not noise
([Chessiverse](https://chessiverse.com/blog/how-we-build-human-like-chess-bots/));
the DDA literature adds that difficulty adjustment must be invisible —
perceived rubber-banding reads as unfair. Human *timing* matters too
(Noctie matches human rhythm, not just move choice).

Three ladder construction patterns, in descending believability and cost:
per-level cloned models (Maia-1), one skill-conditioned model
(Maia-2 / KataGo's human-SL profile strings, sampled at policy
temperature — [KataGo docs](https://github.com/lightvector/KataGo/blob/master/docs/Analysis_Engine.md)),
and hand-tuned degradation (the chess.com personality approach). Without
replay data, tetra starts at tier three — but the failure mode is known
and avoidable. Degrade **systematically, in human-shaped dimensions**, not
by injecting random blunders:

- **Speed**: cap effective PPS / add human-scale decision latency by
  level (the single most visible Tetris skill variable).
- **Vision**: shrink the previews the bot's search consumes (weak players
  don't read 5 previews); disable hold fluency at low levels.
- **Vocabulary**: gate eval features by level — a low-tier bot simply
  *has no T-slot feature* (it never sees T-spins, like the humans at that
  level), mid-tiers misjudge well depth, only high tiers track B2B
  economy. Mistakes emerge as consistent blind spots, not dice rolls.
- **Finesse**: inject keypress inefficiency at low levels via the
  pathfinder (extra rotations — literally the expert/novice signature
  from Lindstedt & Gray).

Archetypes are eval reweightings plus constraints on the same core —
aggressive spike (attack-weighted, downstacks only under pressure),
defensive downstacker (clean-board-weighted, burns freely), opener-centric
(book-driven early game, Cold Clear already ships an opening-book module
as precedent). Tetris's community archetypes (downstacker, 4-wide,
opener-heavy) are recognized concepts but unlabeled in any dataset —
hand-authoring them as weight profiles is the only near-term path, and
the "play the same board both ways, side by side" comparison surface is
where they earn their keep. Validate believability empirically:
blind A/B "human or bot?" judgments (the BotPrize protocol) are cheap to
run inside tetra.

---

# Part 6 — Architecture: one core, many consumers?

## 6.1 What each consumer demands of the core

| Consumer | Latency | Candidates | Explanation | Strength/style conditioning | Mode |
|---|---|---|---|---|---|
| (a) Live in-game hints | <16ms frame budget (or async worker) | 1 (ghost/highlight) | none — spatial only | none | live shallow |
| (b) **Paused decision-point** | ~100ms, gameplay frozen | 3–5, idea-diverse | one-line idea labels, fading | optional ("what a slightly better player sees") | live shallow + detectors |
| (c) Post-game review | none (batch) | best + played + 1 alternative | labels + context-weighted grading | grade *relative to player level* | offline batch |
| (d) Sparring bots | real-time at human PPS | n/a (policy) | none | **essential** — the whole product | live policy |
| (e) Strategy comparison | none (batch/replay) | 2+ full playouts | archetype labels | style conditioning essential | batch + snapshot/branch |
| (f) Puzzle/drill generation | none (offline mining) | uniqueness test (lichess criteria) | concept tags from detectors | difficulty from *user attempts*, not engine | offline once |

Consumers (b), (c), (e), (f) — and (a) trivially — consume the same
substrate: **enumerate placements → evaluate → run concept detectors**,
plus the engine's native snapshot/branch (pure + seeded = replay any
state under any policy, re-serve the identical queue; the affordances
Part 3 marks **S** are nearly free, a genuine structural advantage over
every action game that had to bolt determinism on).

## 6.2 The verdict — one core, with one honest carve-out

**A single extendable core is the right shape for five of six consumers.**
The analysis/generation/grading family is one machine, and the chess
platforms' history confirms both halves: one strong engine does power
review + puzzles + comparison + hints, *and* — the negative case the spec
asked for — **none of them serve human-like sparring from the strong
engine.** Maia is a separate model; KataGo's human play is a separate
network; Chessiverse trains per-bot nets. Strength is one axis,
humanness is another, and no platform found a knob that converts one into
the other. tetra should expect the same: the core's eval can *drive* a
sparring bot (and the hand-tuned ladder of Part 5 is a respectable v1),
but a *believable* ladder is a second system behind the same interface,
not a parameter of the first. Plan the seam (TBP-shaped policy
interface), not the merger.

Second-order negatives, also honest: the core contributes little to pure
motor training (finesse drills need the pathfinder, not the evaluator)
and nothing to editorial content (lessons, theme taxonomies — chess's
were human-authored; tetra's seed vocabulary is four.lol + Fumen banks).

## 6.3 The capability map

What the recommended core (enumerator + eval + detectors + pathfinder on
a pure seeded engine) yields. Asked-for consumers in bold; the rest came
free during research:

- **Paused decision-point mode; post-game review; live hints; sparring
  v1; strategy comparison; puzzle/drill mining from the player's own
  games** (lichess criteria: eval swing + unique best + clear verdict).
- Finesse detection and grading (pathfinder alone — jstris parity, plus
  failure-gated drill variants).
- Benchmark scoring for the pedagogy report's battery: eval-graded drill
  outcomes, placement-quality metrics per skill area.
- Replay annotation: auto-tag any replay (own or imported) with concept
  events — T-spin banked, well broken, misdrop, B2B lost — searchable like
  Fumen strings.
- Scenario authoring assist: detectors verify that an authored drill
  actually exercises the intended concept; solver-graded SRS decks
  (TETRainer pattern).
- Difficulty calibration without ratings: puzzle difficulty from user
  attempts (Glicko-over-puzzles), bot-anchored placement tests.
- **The RL substrate**: the enumerator + pathfinder is the action
  abstraction, the feature layer is the observation/reward shaping, the
  archetype evals are opponents — the entire future training phase
  inherits the core rather than competing with it.
- First-party data flywheel: every tetra game is already seed + actions —
  the exact replay format a future learned model trains on, with tetra's
  own benchmark ratings as skill labels.

---

# Part 7 — The decision framework: concept-type → mechanism

The "how will I know" deliverable. Classify the concept, read off the
mechanism class; the engine column says what the core must supply.

| Concept type | Diagnostic question | Primary mechanisms | Engine needs | Evidence anchor |
|---|---|---|---|---|
| **Motor / execution** (finesse, soft-drop control, hold fluency, speed) | "Do they know what to do but execute it slowly/wastefully?" | detector + immediate sparse cue; failure-gated repetition; savestate segment drills; input display; speed ramps. **No verbal explanations at speed** | pathfinder only | reinvestment theory; guidance hypothesis; jstris finesse precedent |
| **Pattern recognition** (stack shapes, T-slot spotting, opener/PC templates) | "Do they fail to *see* it even with time?" | concept-tagged puzzle banks; SRS decks; Fumen-style notation; worked examples then faded | offline generation + detectors for tagging | retrieval practice; Little & Bjork; TETRainer/Chessable |
| **Judgment** (placement choice, burn-vs-build, well discipline, risk) | "Do they see the options but pick badly?" | **pause-and-choose with commit-first + idea labels**; retry-the-move in review; context-weighted mistake flags; what-the-bot-did diffs | full core: enumerate + eval + detectors + snapshot | Part 2 entire; Tekken/SF6 takeover; lichess retry |
| **Planning** (openers, PC routes, T-spin construction, downstack routes) | "Do they handle each piece well but build toward nothing?" | branch-and-replay alternative lines; demonstration bots; step-by-step trials; pause-and-study | eval + snapshot/branch + (for demos) archetype policies | worked-example effect (novices); mission-mode precedent |
| **Strategic awareness** (attack timing, style matchups, tempo) | "Do they play clean but lose the war?" | sparring vs distinct archetypes; side-by-side strategy comparison; post-game narrative review; ghost-of-a-rank | style-conditioned policies + batch review | sparring = community prescription at stage 3+ (pedagogy report); SF6 V-Rival |

The user's examples, worked: **Downstacking** = planning + judgment →
seeded cheese adversity (exists) for volume, paused-choice on
mid-downstack boards mined from the player's own games for judgment,
bot demonstration of the same board for contrast, review detectors
tracking holes-uncovered-per-piece. **Stacking technique (3-6 / side-well)**
= pattern + judgment → curated scenario bank + SRS for shapes,
constrained-policy demo bot ("watch it keep the well three games
straight"), well-discipline detector grading real games in review.
**Attack timing** = strategic → archetype sparring + side-by-side playouts
of spike-now vs build-more from the same snapshot.

One framework-level rule the evidence insists on: mechanisms are
**stage-gated** (Part 1.3). The same concept moves classes as the player
develops — T-spins are pattern acquisition at intermediate (drill the
shapes) but judgment at advanced (when to bank vs burn). Diagnose by
stage, not just by concept.

---

# Part 8 — The spec's open questions, answered

1. **Chess-analogy verdict** — analysis fails, platform holds; engine
   contribution = evaluate/generate/grade/spar, not deep lines. Stage-
   dependent skill structure. (Part 1.)
2. **Learned vs heuristic vs hybrid** — hybrid: heuristic search
   generates, hand-written detectors annotate; Cold Clear WASM as
   strong-oracle fallback; learned human-likeness deferred on data
   grounds. (Part 4.5.)
3. **Skill-conditioning** — pedagogically real (grade mistakes relative
   to level; "slightly-better player" candidates) but **not
   model-gated**: level-indexed feature gating + level-calibrated grading
   thresholds deliver most of it without replay data. One strong-but-
   comprehensible target eval + per-level grading is enough for v1;
   Maia-style conditioning is the upgrade path, not the foundation.
   (Parts 4.3, 5.)
4. **How concepts are represented computationally** — four
   representations, each serving different mechanism classes: *detector
   functions* over board states (→ feedback, tagging, grading: the
   workhorse); *shaped evaluations / feature gates* (→ archetype bots,
   difficulty ladders, constrained-policy demos); *constrained action
   spaces* (→ drill rules, "downstack-only" modes); *curated scenario
   banks* (→ puzzles, SRS, Fumen-shareable situations). Detectors are the
   highest-leverage: they alone power explanations, review, mining, and
   tagging. (Parts 3, 6.3.)
5. **Believable difficulty ladder** — systematic human-shaped degradation
   (speed, preview vision, feature vocabulary, finesse), never random
   blunder injection; archetypes as eval reweightings; A/B believability
   testing in-app. (Part 5.)
6. **Capability map incl. negative case** — Part 6.3; negatives: human-
   like sparring needs a second model; motor training needs only the
   pathfinder; editorial content isn't an engine product at all.
7. **"How will I know"** — the concept-type → mechanism table, stage-
   gated. (Part 7.)
8. **Are explanations essential?** — yes at one-line idea-label depth,
   commit-first, fading with expertise, never at speed. (Part 2.)

---

# Part 9 — Annotated sources

**Tetris cognition (primary)** — Kirsh & Maglio, epistemic action
([Cognitive Science 1994](https://onlinelibrary.wiley.com/doi/abs/10.1207/s15516709cog1804_1));
Gray & Lindstedt, Plateaus/Dips/Leaps
([Cognitive Science 2017](https://onlinelibrary.wiley.com/doi/10.1111/cogs.12412));
Lindstedt & Gray, cognitive speed-bump
([CogSci 2020](https://escholarship.org/uc/item/7gv9443c)); Meta-T
platform ([BRM](https://link.springer.com/article/10.3758/s13428-014-0547-y));
Tetris constructibility ([Kosters et al.](https://liacs.leidenuniv.nl/~kosterswa/tetris/ijigstetrisfinal.pdf)).
*Caveat: speed-bump/PDL figures verified via secondary extracts; primary
PDFs were paywalled.*

**Tetris community canon** — winternebs FAQ
([improvement doctrine](https://winternebs.github.io/TETRIS-FAQ/)),
four.lol ([stacking/finesse](https://four.lol/)), jstris guide
([finesse + cheese](https://jstris.jezevec10.com/guide)), practice-tool
landscape ([Galactoid's list](https://galactoidtetris.wordpress.com/2025/01/11/list-of-tetris-practice-tools/)),
Fumen ([tetris.wiki](https://tetris.wiki/Fumen)).

**Engine-as-platform (primary where it counts)** — lichess puzzler
([repo + criteria in code](https://github.com/ornicar/lichess-puzzler)),
fishnet ([repo](https://github.com/lichess-org/fishnet)), chess.com puzzle
pipeline ([blog](https://www.chess.com/blog/CHESScom/how-we-built-a-puzzle-database-with-half-a-million-puzzles)),
chess.com engines ([support doc](https://support.chess.com/en/articles/9462780-chess-engines-on-chess-com-how-do-they-work)),
GTO Wizard presolve model ([site](https://gtowizard.com/)), KaTrain
([repo](https://github.com/sanderland/katrain)).

**Bots & substrate** — Cold Clear ([repo](https://github.com/MinusKelvin/cold-clear),
[eval weights](https://github.com/MinusKelvin/cold-clear/blob/master/bot/src/evaluation/standard.rs),
[search analysis](https://komorinfo.com/blog/cold-clear-search-algorithm/));
TBP ([spec](https://github.com/tetris-bot-protocol/tbp-spec)); StackRabbit
([repo](https://github.com/GregoryCannon/StackRabbit)); Tetrisfish
([repo](https://github.com/AnselChang/tetrisfish)); ML-in-Tetris survey
([Algorta & Şimşek](https://arxiv.org/abs/1905.01652)); BCTS
([Thiery & Scherrer](https://inria.hal.science/inria-00418954/document)).

**Human-like AI & data** — Maia
([KDD 2020](https://ar5iv.labs.arxiv.org/html/2006.01855),
[repo](https://github.com/CSSLab/maia-chess)); Maia-2
([NeurIPS 2024](https://arxiv.org/html/2409.20553v1)); individual-style
scaling ([arXiv 2502.14998](https://arxiv.org/html/2502.14998v1)); KataGo
human-SL ([docs](https://github.com/lightvector/KataGo/blob/master/docs/Analysis_Engine.md));
Chessiverse design notes ([blog](https://chessiverse.com/blog/how-we-build-human-like-chess-bots/));
TETR.IO API/ToS ([api docs](https://tetr.io/about/api/),
[ToS](https://tetr.io/about/terms/)); replay tooling
([Triangle.js](https://github.com/Genius6942/triangle),
[inoue](https://github.com/szymonszl/inoue)); Jstris API
([docs](https://jezevec10.github.io/jstris-api-docs/)).

**Mechanisms** — Tekken 8 replay takeover
([eventhubs](https://www.eventhubs.com/news/2023/sep/22/tekken-8-replay-system-features/),
[director rationale](https://gamingbolt.com/tekken-8-overhauls-my-replay-and-tips-allows-for-real-time-practice));
SF6 replays/V-Rival ([gamerant](https://gamerant.com/street-fighter-6-replay-v-rival-features-explained/));
lichess Learn-from-mistakes ([blog](https://lichess.org/blog/WFvLpiQAACMA8e9D/learn-from-your-mistakes));
Forza assists study ([FDG 2014](https://www.microsoft.com/en-us/research/publication/off-with-their-assists-an-empirical-study-of-driving-skill-in-forza-motorsports-4/));
Celeste SpeedrunTool ([repo](https://github.com/DemoJameson/Celeste.SpeedrunTool));
TETRainer ([site](https://tetrainer.com/)).

**Learning science & explanation (meta-analytic spine)** — Van der Kleij
et al., feedback content ([RER 2015](https://journals.sagepub.com/doi/10.3102/0034654314564881));
Alfieri et al., enhanced discovery ([2011](https://eric.ed.gov/?id=EJ933606));
Kalyuga, expertise reversal ([2007](https://www.uky.edu/~gmswan3/EDC608/Kalyuga2007_Article_ExpertiseReversalEffectAndItsI.pdf));
pretesting ([Richland/Kornell/Kao](https://learninglab.uchicago.edu/Pre-Testing_files/RichlandKornellKao.pdf));
MC lures ([Little & Bjork](https://bjorklab.psych.ucla.edu/wp-content/uploads/sites/13/2017/01/LittleBjorkMC2014.pdf));
cognitive forcing ([Buçinca 2021](https://arxiv.org/abs/2102.09692));
explanation overreliance ([Bansal 2021](https://arxiv.org/pdf/2006.14779));
AlphaZero concept transfer to GMs ([Schut, PNAS 2025](https://www.pnas.org/doi/10.1073/pnas.2406675122));
saliency failures ([Mere Mortals](https://ar5iv.labs.arxiv.org/html/1903.09708));
far-transfer skepticism ([Sala & Gobet](https://journals.sagepub.com/doi/10.1177/0963721417712760));
reinvestment ([review](https://pmc.ncbi.nlm.nih.gov/articles/PMC6341961/)).

**Known gaps** (inherited from the research passes): no RCTs on replay
takeover, ghosts, or any Tetris trainer; no head-to-head study of
"choose among N candidates" vs "see best move"; Cold Clear nodes/sec and
MisaMino license unverified; preview-depth value measured only in
classic/marathon AI, not guideline versus; chess.com Coach's
template-vs-LLM mechanism undisclosed.
