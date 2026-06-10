# Feature-parity runner — starter prompt

Launch a fresh agent with the prompt below (verbatim). It is self-contained:
the agent reads the real documents, works milestone by milestone, and keeps
going until its milestones pass or it hits a human gate.

---

You are working the **client stream** of tetra (`WORKSTREAMS.md`), executing
`specs/feature-parity.md`. Work autonomously, milestone by milestone, until
every milestone below passes or you are blocked on a human gate.

**Read before any work, in order:**
1. `CLAUDE.md` + `WORKSTREAMS.md` — rules, session lifecycle, your lane
2. `specs/feature-parity.md` — the plan and its invariants
3. `docs/parity.md` — the coverage contract: every row, grade, and resolved
   decision (D1–D5). This is your work list; §13 + the D-resolutions are
   binding.
4. `docs/engine.md`, `docs/quality-bar.md` — substrate + bar
5. `progress/client.md` (last entries) + `git log --oneline -10` — where the
   stream is now. Then `npm test` as a smoke check.
6. `docs/tetris-reference.md` — consult per-area as needed.

**Milestones — each must be fully done before the next starts:**

- **M0 — Green repo.** `npm test`, `npm run lint`, `npm run build` all clean.
  (Known: ~10 pre-existing lint errors in `engine.ts`/`useGame.ts`/format —
  some look semantic; fix with care, engine tests must stay green.)
- **M1 — Mechanics parity.** Implement `docs/parity.md` §13 engine fixes +
  D1 (SRS+) + D3 (marathon 15). Deliverable: a parity test suite under
  `src/engine/` where every §1–4 baseline row has a test whose comment cites
  its source; intentional divergences (D2 lift, 0-ARE) documented in
  `docs/engine.md`.
- **M2 — Replay recording (D5).** Every game records
  `{seed, config, timestamped actions}` (persisted like PBs). Headless test:
  replaying a recorded log reproduces the identical final state. No viewer.
- **M3 — Handling & QoL parity.** §13 input/QoL + stats/audio items: DCD,
  safelock, blur-clears-held-keys, resume countdown, multi-key rebind UI,
  SFX volume slider, combo/B2B/PC/danger sounds, danger warning, end-of-game
  summary depth, finesse faults + KPP (Hard Drop finesse definition).
- **M4 — Versus substrate (headless).** Per spec Phase 2: `AttackConfig`
  (guideline table), garbage queue → cancel → enter, messiness +
  change-on-attack holes, `Opponent` interface, scripted-pressure opponent,
  match layer with win/lose. Full scripted matches run in vitest. Engine
  stays pure.
- **M5 — Battle mode UI.** Spec Phase 3: one mode, three new elements
  (garbage meter, opponent HP, APM). **Human gate: feel sign-off before
  calling it done.**
- **M6 — Online 1v1.** Spec Phase 4: `Transport` interface with in-memory
  fake (scriptable latency/jitter/drop) FIRST — two-engine lockstep matches
  + desync detection fully tested headlessly — then WebRTC DataChannel +
  Vercel serverless signaling, invite-link room flow. No accounts.
- **M7 — Design pass.** Spec Phase 5: every surface to the VISION.md bar;
  motion/feedback polish. **Human gate: user reviews before close.**

**Standing rules (non-negotiable):**
- Quality beats scope: if an item can't reach the bar in this pass, cut it,
  flag it in your progress entry, and move on — never ship the janky version.
- `src/engine/` pure and headless; injectable time everywhere; state-based
  assertions (no pixel tests); parity tests cite sources; the matrix is the
  coverage contract — update `docs/parity.md` statuses as rows turn ✓.
- Verify rules against the cited sources in `docs/parity.md`/
  `docs/tetris-reference.md` — never from memory. SRS+/180 numbers are in
  the parity matrix §1 and the kick research (y-up published vs y-down
  engine: negate dy).
- End every session per CLAUDE.md: tests/lint/build green, append to
  `progress/client.md` (what changed, decisions, open threads, cross-stream
  flags).
- Human gates (stop and ask): feel sign-off (M5, M7), anything destructive,
  scope changes, decisions not already resolved in `docs/parity.md` §12.
- IDEAS.md is an inbox — never execute from it.
