# Ideas inbox

Unsorted, uncommitted. Anything here is raw material for a future spec
interview — agents never execute from this file unprompted. Move an idea out
(into a spec or a prompt) when it's time; delete freely.

## RL / training mode
- Headless CLI runner: play N games with a given bot/policy, emit metrics
  (lines, PPS, survival time) as JSON.
- Drill modes taught by bot demonstration: 3-6 stacking, downstacking.

## From bot-engine research (research/bot-engine.md, 2026-06-09)
- Placement enumerator + placement→keypress pathfinder (finesse generator)
  against tetra's SRS — the bridge artifact everything else stands on
  (bot driving, finesse detection, RL action space, TBP adapter).
- Paused decision-point mode: pause at a key moment, player commits a
  placement first, then 3–5 idea-diverse candidates with one-line labels.
- Puzzle mining from the player's own games using the lichess criteria
  (eval swing + unique best + clear verdict); difficulty via
  Glicko-over-attempts, not engine eval.
- Concept detectors as replay annotation: auto-tag games with well-broken /
  T-spin-banked / misdrop events, searchable.
- Constrained-policy demo bots ("downstack-only") — not shipped anywhere in
  Tetris; open gap.
- Sparring ladder via systematic human-shaped degradation: speed caps,
  preview-vision limits, eval-feature gating by level, finesse-error
  injection; in-app "human or bot?" believability A/B.
- Side-by-side strategy comparison: fork one snapshot under two archetype
  evals (spike-now vs build-more) and diff the playouts.
- Cold Clear WASM behind a TBP adapter as a strong-oracle option (MPL-2.0).

## Client
- 20TSD mode (T-spin vision drill) — deferred from specs/feature-parity.md
- PC mode (consecutive perfect clears) — deferred from specs/feature-parity.md
- TETR.IO ruleset variant as AttackConfig: combo multiplier, B2B
  Charging/Surge, opener phase — deferred from specs/feature-parity.md

## Online (beyond the invite-link 1v1 baseline)
- Real bot opponent implementing the `Opponent` interface (heuristic first,
  RL later)
- Lobbies / rooms with 2+ players, spectating
- Accounts, matchmaking, leaderboards
