# Progress — client stream (parity & quality)

Append-only, newest first. What changed, decisions made, open threads.
See WORKSTREAMS.md for the stream's place in the whole.

---

## 2026-06-09 — Phase 0 parity audit complete (docs only, no code)

**This session**: Executed Phase 0 of `specs/feature-parity.md`. Three
parallel research agents pulled primary sources live (official 2009
Guideline PDF, tetris.wiki/harddrop SRS + scoring pages, TETR.IO client
source `tetr.io/js/tetrio.js`, Jstris guide/lang repos); I read every line
of the engine/input/controller/UI and cross-checked. Deliverables:
**`docs/parity.md`** (the graded matrix — coverage contract) and
**`specs/feature-parity-runner.md`** (self-contained starter prompt that
drives M0–M7 to completion).

**Headline audit results**:
- SRS 90° kicks (JLSTZ+I), TETR.IO 180 kicks (JLSTZ+T), spawn
  columns/rows, scoring table (incl. mini T-spins, B2B ×1.5 semantics,
  combo indexing, PC bonuses, flat drop points), lock-delay move-reset
  semantics, 7-bag, hold rules: **verified character-exact** against
  sources.
- Confirmed divergences/gaps (Phase 1 work list in matrix §13): T-spin-0
  preserves combo; post-cap lock not immediate; no drop-on-spawn; garbage
  push-out silently deletes row 0 instead of topping out; missing B2B-PC
  3200; missing DCD/safelock; stuck keys on window blur; no resume
  countdown; rebind UI collapses multi-key binds; stats/audio gaps
  (APM/VS/finesse/KPP, combo/B2B/PC/danger sounds, volume slider).

**Decisions (user, recorded in matrix §12)**: D1 adopt SRS+ · D2 keep
2-row block-out lift (documented divergence) · D3 marathon ends at level
15 · D4 no music · D5 replays = record now, view later.

**Open threads**:
- Launch `specs/feature-parity-runner.md` in a fresh session to execute
  M0–M7 (M0 = the known lint debt).
- CLAUDE.md promotion of the "deterministically drivable" invariant still
  pending (runner's M1 can carry it).
- Cross-stream flag: D5 means every game records `{seed, config, actions}`
  from M2 on — pedagogy's Review surface and bot's replay-analysis both
  stand on that format; coordinate before changing it.

---

## 2026-06-09 — Stream opened (docs reorg, no code)

**State at opening**: Playable client shipped and deployed (React+TS+Vite,
pure engine, SRS/scoring/modes, seeded RNG, 28/28 tests green). No parity
work has run yet.

**Next**: `specs/feature-parity.md` Phase 0 — the parity audit producing
`docs/parity.md`. Phase 0 carries four open questions to resolve with the
user (replays baseline?, sprint variants/zen?, PC attack value 10 vs 5,
cosmetic-settings line). The "deterministically drivable at every layer"
invariant gets promoted to CLAUDE.md when Phase 0 lands.

**Known debt**: `npm run lint` fails with 10 pre-existing errors (engine.ts
unused expressions + useless `points` assignment, useGame.ts ref access
during render, format.ts). Some look semantic, not cosmetic — needs its own
session.
