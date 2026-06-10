# Progress — bot stream (engine substrate)

Append-only, newest first. What changed, decisions made, open threads.
See WORKSTREAMS.md for the stream's place in the whole.

---

## 2026-06-09 — Bot/engine substrate research executed

**This session**: Executed `specs/bot-engine-research.md` — six parallel
research passes (Tetris cognition, chess.com/lichess engine teardowns, bot
landscape, human-like AI + replay data, coaching mechanisms, choice/
explanation evidence), synthesized into `research/bot-engine.md`
(committed). No code, no engine changes; tests/lint/build green.

**Headline verdicts** (full reasoning + citations in the report):
- **Chess analogy: fails at the move level, holds at the platform level.**
  Tetris decisions are shallow-wide (lookahead saturates at 1–2 pieces,
  state space converges heavily); but chess platforms mostly use engines as
  offline content factories (puzzles mined once, difficulty graded by user
  attempts) — a consumption pattern that fits a shallow Tetris engine well.
- **Recommended core: hybrid** — placement enumerator + handcrafted-feature
  eval (Dellacherie/BCTS/Cold Clear weights are portable) + hand-written
  concept detectors producing idea-labels. Cold Clear via WASM/TBP as
  strong-oracle fallback (MPL-2.0). Deep RL from raw is two orders of
  magnitude weaker per the literature; learned human-likeness
  (Maia-for-Tetris) is data-gated (TETR.IO has no official bulk replay
  endpoint) — deferred, not foundational.
- **One core serves 5 of 6 consumers** (paused decision-points, review,
  comparison, puzzle mining, live hints). The honest negative: believable
  human-like sparring needs a *separate* model everywhere it's been done
  (Maia, KataGo human-SL); plan the seam (TBP-shaped policy interface),
  hand-tuned systematic degradation (speed/preview/feature-vocabulary
  gates, never random blunders) as sparring v1.
- **Explanations: essential at one-line idea-label depth**, commit-first
  (player places before seeing candidates), fading with skill, never at
  speed (reinvestment theory). The candidate-choice interaction is the
  best-evidenced design in the whole report.

**Decisions**: First build artifact implied by everything: the **placement
enumerator + placement→keypress pathfinder** against tetra's SRS tables —
it's the bridge every bot needs (bots think in placements, our `Action` is
keypresses), and it also powers finesse detection, the RL action
abstraction, and TBP compatibility. RL stack fork stays open but tilted
heuristic-first/TS-native by the evidence.

**Cross-stream flags**: pedagogy — the report's Part 7 decision framework
(concept-type → mechanism, stage-gated) is the bot-side complement to
pedagogy's mode carving; the paused decision-point + review surfaces are
where the two streams meet. client — versus `Opponent` interface should
stay placement-agnostic (a TBP-shaped seam) so any bot tier plugs in.

**Open threads**: tetra's own games are seed+inputs with future benchmark
labels — a first-party replay corpus for a later learned model; worth a
line in any data/telemetry design. Believability A/B ("human or bot?")
protocol when sparring ships.

## 2026-06-09 — Stream opened (docs reorg, no code)

**State at opening**: Research spec written, not yet executed —
`specs/bot-engine-research.md` → deliverable `research/bot-engine.md`.
Centerpieces: the chess-analogy verdict (is per-decision analysis even the
right primitive for Tetris?), the concept-expression mechanism taxonomy,
and the learned vs heuristic vs hybrid comparison. It should cite
`research/pedagogy.md` (now exists), and has explicit permission to conclude
that a single extendable core is the wrong shape.

**Open forks** (stay open until the research lands): RL training stack
(TS-native vs Python+gym vs heuristic-first); whether explanations are
essential; skill-conditioning.

**Likely early milestone regardless of stack**: a headless CLI runner
(`tetra-sim`-style — run N games with a policy, emit metrics as JSON). In
IDEAS.md; pull it into a spec when the time comes.
