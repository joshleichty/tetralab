---
summary: The pure headless game engine — state, actions, ticking, garbage, and the invariants that make it an RL substrate.
read_when: touching src/engine/, building bots/training, adding modes, or anything that simulates games headlessly.
---

# Engine (`src/engine/`)

Pure TypeScript, zero DOM/React dependencies, fully deterministic given a
seed. The keyboard and a bot are interchangeable drivers — this is the
substrate for the RL training mode.

## Files
- `engine.ts` — the `Engine` class (~560 lines), all game logic
- `types.ts` — `Action`, `EngineConfig`, `GameEvent`, `ClearInfo`, cell constants
- `pieces.ts` — piece shapes/spawns; `srs.ts` — SRS kick tables
- `rng.ts` — seeded RNG (7-bag)
- `engine.test.ts` — vitest coverage; must stay green

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

## Invariants
- No DOM, no React, no `Date.now()`/`Math.random()` — seeded RNG only;
  same seed + same action/tick sequence ⇒ identical game.
- The UI drives the engine only through `applyAction` + `tick`; bots must too.
- `window.__tetra` exposes the live `GameController` in the browser for
  in-page scripting/debugging.
