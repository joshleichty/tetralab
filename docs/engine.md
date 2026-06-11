---
summary: The pure headless game engine — state, actions, ticking, garbage, and the invariants that make it an RL substrate.
read_when: touching src/engine/, building bots/training, adding modes, or anything that simulates games headlessly.
---

# Engine (`src/engine/`)

Pure TypeScript, zero DOM/React dependencies, fully deterministic given a
seed. The keyboard and a bot are interchangeable drivers — this is the
substrate for the RL training mode.

## Files
- `engine.ts` — the `Engine` class (~600 lines), all game logic
- `types.ts` — `Action`, `EngineConfig`, `GameEvent`, `ClearInfo`, cell constants
- `pieces.ts` — piece shapes/spawns; `srs.ts` — SRS+ kick tables (D1)
- `rng.ts` — seeded RNG (7-bag)
- `attack.ts` — `AttackConfig` + `attackFor()`: the guideline attack
  table ([WN]); variants become config tables, not rewrites
- `versus.ts` — `Opponent` interface, `ScriptedPressureOpponent`
  (seeded, APM × messiness presets), `Match` (win = deplete HP, lose =
  top out); the bot stream's sparring partner plugs in here
- `finesse.ts` — finesse optimum table ([HD-Finesse]): BFS over (rot, x)
  with the real kick tables; `optimalInputs(type, rot, x)` (counts a 180 key)
- `finesse-gen.ts` / `finesse-table.ts` / `data/finesse-table.json` —
  finesse *sequence* table (no-180 community standard, training-core §5):
  generator, loader (`finesseEntry(type, rot, x)`), generated artifact
  (`npm run gen:finesse`); cross-validated against FinesseTrainer counts
  and executed through the engine in tests
- `board.ts` — board specs + metrics: `parseRows` (row-string boards,
  `'XXXX___XXX'`), `holes`, `bumpiness`, `wellDepth`, `isWellPure`,
  `columnHeights`, `stackHeight` — GoalSpec substrate and bot evaluation
  features
- `goals.ts` — `GoalSpec` → `compileGoal(spec, engine)`: declarative
  lesson-challenge goals (noNewHoles, clearLines, maxBumpiness, wellPure)
  evaluated over state + events; future RL reward components
- `replay.ts` — replay recording/playback (D5): `STEP_MS` fixed-step grid,
  `ReplayRecorder`, `simulateReplay`; versioned via `REPLAY_VERSION` —
  **bump it on any state-visible rule change**. Battle replays carry
  `Replay.opponent` (the scripted opponent's config — deterministic on the
  grid, so no timing log) and play back through a `Match`; battle replays
  recorded before M6 lack it and are refused. Online match replays live in
  `src/net/lockstep.ts` (`MatchReplay`: both action streams + match config)
- `engine.test.ts` — vitest coverage; must stay green
- `parity.test.ts` — the parity suite: encodes docs/parity.md §1–4 with
  per-test source citations; the coverage contract
- `replay.test.ts` — record/replay round-trip identity across modes

## Driving the engine
```ts
const e = new Engine({ seed, mode })   // Partial<EngineConfig> accepted
e.start()
e.applyAction(action)                  // Action: left|right|cw|ccw|r180|softDropOn|softDropOff|hardDrop|hold
e.tick(dtMs)                           // advance time; gravity, lock delay, rises
e.takeEvents()                         // drain GameEvent[] (lock, clear, garbage, gameover, win…)
```

## Observation surface (for bots)
- `board: Uint8Array` (flat, 0 empty, 1–7 colors, 8 garbage), `cellAt(x, y)`
- Active piece, queue, hold on the engine instance; `ghostY()`,
  `canFit(x, y, rot)` for placement search
- `snapshot()` — plain-value `Position` copy (board/piece/previews/hold),
  the bot layer's L0 input (`docs/bot.md`); never aliases live state
- `GameEvent`s carry reward-relevant info: `ClearInfo` (lines, label, b2b,
  combo, perfectClear, points), harddrop distance, gameover/win
- `stateHash()` — FNV-1a fingerprint of the complete simulation state,
  private timers included: equal hashes ⇒ identical future evolution under
  identical input. Lockstep desync detection (`src/net/`) and replay
  verification stand on it; cheap enough for per-step assertions in tests

## Versus (battle substrate)

- Every clear computes `info.attack` from `cfg.attack` (solo modes ignore
  it); pending garbage cancels first, the remainder emits an
  `{kind:'attack'}` event.
- `queueGarbage(lines)` queues an incoming attack; `pendingGarbage()` is
  the meter. Uncancelled garbage enters when a piece locks: one hole per
  attack, re-rolled between attacks; `attack.messiness` is the per-line
  probability the hole moves within an attack.
- `Match` (versus.ts) routes attack events to an `Opponent` and opponent
  bursts into `queueGarbage`; full matches run headlessly in vitest.

## Garbage / training modes
- **`lesson` mode** (training-core M0): zero gravity, no lock timer, no
  win condition — pieces lock only via `hardDrop`/`place()`; the lesson
  runtime drives the game, not the clock
- `setBoard(rows | Uint8Array)` — load any board state (row strings are
  bottom-aligned, parsed by board.ts); throws on malformed input
- `setQueue(pieces)` — script the upcoming pieces; the seeded bag resumes
  after the script is exhausted
- `place({type, rot, x})` — apply a placement by spec: straight drop from
  the top, locks immediately (pulls via hold if needed); returns false on
  unreachable placements (kicks/tucks must be scripted as actions)
- `addGarbage(rows, holeColumn)` — direct garbage insertion (clean-well drills)
- `insertCheese(rows)`, `cheeseRows()`, `cheeseLeft()` — cheese race
  (seeded holes, adjacent rows never repeat, refills to `cheeseHeight`)
- `survival` mode rises on a timer: `riseStartMs` 6000 → `riseMinMs` 1800
- Defaults in `DEFAULT_ENGINE_CONFIG` (lock delay 500ms, 15 lock resets,
  queue 5, cheese 18/9)

## Ruleset & intentional divergences

Mechanics follow the guideline/modern-client baseline per `docs/parity.md`
(every row tested in `parity.test.ts`). Where tetra deliberately diverges:

- **SRS+** (D1): TETR.IO's default rotation system — y-symmetric I 90°
  kicks + minimal I-180 kicks — not plain SRS. JLSTZ tables are standard.
- **0 ARE** : the next piece spawns synchronously on lock. The guideline
  PDF specifies 0.2 s; modern competitive clients run 0.
- **2-row block-out lift** (D2): an obstructed spawn tries one and two rows
  higher before declaring game over (strict guideline tries none/one).
- **Marathon ends at level 15** (D3): 150 lines = win; no endless variant
  (zen territory → pedagogy stream).
- **Mini T-spin double = 400** : matches tetris.wiki "(if present)";
  harddrop's 1200 claim and the PDF's silence are documented in the matrix.

## Invariants
- No DOM, no React, no `Date.now()`/`Math.random()` — seeded RNG only;
  same seed + same action/tick sequence ⇒ identical game.
- The UI drives the engine only through `applyAction` + `tick`; bots must too.
- The whole stack simulates on the fixed `STEP_MS` grid (`replay.ts`): the
  controller accumulates frame time and runs 5 ms steps; actions are
  stamped with step indices. Replays and lockstep netcode (`src/net/`,
  docs/netcode.md) both stand on this — don't reintroduce variable-dt
  ticking.
- `window.__tetra` exposes the live `GameController` in the browser for
  in-page scripting/debugging.
