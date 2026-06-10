# Work streams

VISION.md is the root; this file is the map. Read it at the start of every
session, whatever you were asked to do.

## The model

tetra is built by agents working **several streams in tandem**. There is no
fixed order — streams advance in parallel, sometimes one stalls while another
sprints, and the sequencing below is a current guess, not a contract.

Two rules hold everything together:

1. **Stay in your lane, build for the whole.** Do the work you were asked to
   do, in the stream it belongs to. But every stream ships into the *same
   production app* — the deployed client real players use. Nothing is a side
   project or a throwaway prototype. When your work touches shared ground
   (the engine, the docs, the UI system), build it so the other streams can
   stand on it.
2. **Soft lines.** These streams are not phases and their boundaries are not
   walls. A lot of this will change as research lands and the product
   sharpens. Be only as precise as the work in front of you requires; when a
   boundary question comes up, note it in your progress entry rather than
   inventing policy.

## The streams

### `client` — parity & quality

Get the client to **baseline**: a competitive player arriving from TETR.IO or
Jstris notices nothing missing, wrong, or off-feeling — at the quality bar,
which beats scope at every decision point.

- **Plan**: `specs/feature-parity.md` (parity audit → mechanics → versus
  substrate → battle mode → online 1v1 → design pass; ordering inside the
  spec is also soft except where it says otherwise).
- **References**: `docs/quality-bar.md`, `docs/tetris-reference.md`,
  `docs/engine.md`.
- **Progress**: `progress/client.md`.

### `pedagogy` — training that actually teaches

The advanced layer on top of baseline: the play → measure → diagnose → drill
loop that no guideline-Tetris tool closes today. This is what tetra *is* per
VISION.md; the client stream makes it a place worth training in.

- **Done**: `research/pedagogy.md` — the evidence base (skill ladder,
  learning science, trainer teardowns, mode carving: Learn / Drill / Test /
  Play / Review).
- **Next**: interview → first training-mode spec(s). No code yet.
- **Progress**: `progress/pedagogy.md`.

### `bot` — engine substrate

Its own parallel stream: research, then build, the machine underneath —
candidate generation, evaluation, sparring, content generation. It works in
tandem with pedagogy (the bot is one delivery method for teaching, and
pedagogy defines what the bot must be able to do), but it is not blocked on
it and may conclude its own shape.

- **Next**: execute `specs/bot-engine-research.md` → `research/bot-engine.md`
  (chess-analogy verdict, mechanism taxonomy, technical approach). The RL
  stack choice (TS-native vs Python+gym vs heuristic-first) stays open until
  that research lands.
- **Progress**: `progress/bot.md`.

## How the streams help each other

- **The engine is the shared substrate.** `src/engine/` stays pure, headless,
  seeded (see CLAUDE.md rules) — the keyboard, a bot, and a test are
  interchangeable drivers. Every stream both depends on and protects this.
- **client builds surfaces the others will inhabit**: the versus substrate's
  `Opponent` interface is where bot sparring plugs in; the modes, stats, and
  design system are where pedagogy's training modes will live.
- **pedagogy tells bot what matters**: `research/pedagogy.md` ranks what an
  engine must do to teach (evaluate positions, enumerate good placements,
  detect mistakes). bot research cites it; bot building serves it.
- **Quality is cross-stream.** The VISION.md bar — minimal, quiet, precise —
  applies to every surface any stream ships. Cut or defer before shipping
  janky.

## Working rules (all streams)

- **Progress lives per stream.** When you do stream work, append to that
  stream's file in `progress/` (what changed, decisions, open threads).
  Project-level work — workflow, docs reorgs, infra — logs to `PROGRESS.md`.
- **Milestones live in specs.** Each stream's executable plan, with pass/fail
  milestones, is a spec in `specs/` (see `specs/README.md`). A stream without
  a current spec gets one via an interview session before big work starts.
- **Cross-stream changes get flagged.** If you change something other streams
  stand on (engine API, shared docs, design tokens), say so in your progress
  entry so the next agent in another lane sees it.
- **IDEAS.md is an inbox, not a queue** — never execute from it unprompted.
