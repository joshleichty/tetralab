# tetra

A training instrument for competitive Tetris. VISION.md is the root — every
feature must serve it. The how (modes, bots, feedback) is open; that it
teaches, and that it is beautiful, is not.

Work runs as parallel streams (client / pedagogy / bot) building one
production app — **WORKSTREAMS.md is the map; read it every session.** Stay
in the stream you were asked to work, but build so the others can stand on
your work.

## Commands
- `npm test` — vitest; engine tests must always pass
- `npm run lint` && `npm run build` — both clean before a session ends

## Session lifecycle
1. **Start**: read WORKSTREAMS.md, the last few entries of your stream's
   `progress/<stream>.md` (PROGRESS.md for project-level work) +
   `git log --oneline -10`, run `npm test` as a smoke check.
2. **Work**: if the change can't be described as a one-sentence diff, interview
   the user and write a spec to `specs/<name>.md` first; execute the spec in a
   fresh session.
3. **End**: append an entry to your stream's progress file (what changed,
   decisions made, open threads; flag anything other streams stand on),
   leave tests/lint/build green.

## Rules
- `src/engine/` stays pure and headless: no DOM, no React, seeded RNG only.
  It is the substrate for the future RL training mode.
- New capability: headless/CLI-callable first, UI on top second.
- `docs/` holds subsystem docs — check each file's `read_when` header before
  working on that area.
- IDEAS.md is an inbox, not a queue: never execute from it unprompted.
