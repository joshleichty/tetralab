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
- `replay.ts` — replay recording/playback (D5): `STEP_MS` fixed-step grid,
  `ReplayRecorder`, `simulateReplay`; versioned via `REPLAY_VERSION` —
  **bump it on any state-visible rule change**
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
- `GameEvent`s carry reward-relevant info: `ClearInfo` (lines, label, b2b,
  combo, perfectClear, points), harddrop distance, gameover/win

## Garbage / training modes
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
  stamped with step indices. Replays and (future) lockstep netcode both
  stand on this — don't reintroduce variable-dt ticking.
- `window.__tetra` exposes the live `GameController` in the browser for
  in-page scripting/debugging.
