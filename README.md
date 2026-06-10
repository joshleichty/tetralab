# tetra — a minimal tetris

A minimal, aesthetic Tetris client built with React + TypeScript + Vite. Guideline-accurate
gameplay in the spirit of Jstris/TETR.IO, designed from the start so a training/RL bot can
drive the same engine the player does.

## Run it

```sh
npm install
npm run dev      # dev server
npm test         # engine test suite (vitest)
npm run build    # typecheck + production build
```

## Gameplay

- **SRS rotation** with full wall-kick tables, plus 180° rotations (TETR.IO-style kicks)
- **7-bag randomizer**, seeded and deterministic
- **Hold** (once per piece) and a **5-piece preview queue**
- **Ghost piece**, hard drop, soft drop
- **Lock delay** (500 ms) with move resets (15), reset on altitude drop
- **Scoring**: T-spins (3-corner rule with mini/full distinction), back-to-back,
  combos, perfect clears, guideline level gravity curve
- **Modes**: marathon (endless), 40 lines (sprint), blitz (2 min score attack)
- **Training modes**:
  - *cheese* — dig race through 10 / 18 / 100 lines of cheese (single-hole garbage,
    adjacent holes never align, board holds up to 9 cheese rows and refills as you dig)
  - *survival* — garbage rises on a timer (6 s, accelerating to 1.8 s); outlast it
- Personal bests persisted per mode (and per cheese race size)

## Handling

Millisecond-based handling tuned in settings (persisted to localStorage):

| setting | default | meaning |
| ------- | ------- | ------- |
| DAS     | 133 ms  | delay before auto-shift |
| ARR     | 10 ms   | auto-repeat rate (0 = instant to wall) |
| SDF     | 20×     | soft drop gravity multiplier (max = instant) |

DAS charge is preserved across direction switches (Jstris behavior), and DAS can
pre-charge during the ready/go countdown. All keys are rebindable in settings.

Default keys: ← → move · ↓ soft drop · space hard drop · z/x rotate · a 180 ·
c/shift hold · esc/p pause · r restart.

## Architecture

```
src/
  engine/    pure, headless game logic — zero DOM deps
    types.ts     actions, events, config
    pieces.ts    shapes, spawn rules, board dimensions
    srs.ts       SRS + 180 kick tables
    rng.ts       seeded PRNG + 7-bag
    engine.ts    gravity, lock delay, scoring, T-spins, garbage
  input/     DAS/ARR keyboard handling → engine actions
  render/    canvas renderers (board, previews) + visual effects
  audio/     synthesized WebAudio sfx (no assets)
  game/      GameController (RAF loop, modes, results), settings, React bridge
  ui/        React components: HUD, overlays, settings modal
```

The engine is driven entirely through `applyAction(action)` + `tick(dtMs)` and reports
back through an event queue — the keyboard, a replay file, or an RL agent are
interchangeable drivers. `window.__tetra` exposes the live controller for scripting.

### Garbage / training internals

- `Engine.insertCheese(rows)` — seeded cheese rows, adjacent holes never repeat
- `Engine.addGarbage(rows, holeColumn)` — clean-well garbage for scripted drills
- `Engine.cheeseLeft()` / `cheesePool` / `riseTimer` — race + rise state for HUDs and bots
- Seeded engines make episodes reproducible; the `Action` type is the agent's exact
  action space and the board is a flat `Uint8Array` observation (future RL bot)
