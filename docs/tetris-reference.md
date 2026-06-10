---
summary: The rules of modern 1v1/versus play, the skills that win it, how players improve, and what each game mode trains.
read_when: designing modes, scoring, garbage, training features, or anything pedagogy-related.
---

# Modern competitive Tetris — foundational reference

Research notes for tetra, June 2026. Covers (1) the rules of 1v1/versus play in
modern guideline clients, (2) the skills that win 1v1s, (3) the skills of general
improvement, and (4) the game-mode landscape and what each mode trains.
Primary sources: [TetrisWiki](https://tetris.wiki/TETR.IO), the
[TETR.IO wiki](https://tetrio.wiki.gg/wiki/Mechanics),
[Hard Drop wiki](https://harddrop.com/wiki/Finesse), and the community
[TETRIS-FAQ](https://winternebs.github.io/TETRIS-FAQ/). Confidence flags appear
where sources were thin.

---

## 1. The rules of versus play

### 1.1 The core loop: garbage

Clearing lines sends **garbage** — grey rows with a hole — to the bottom of the
opponent's board. Everything in versus flows from one equation: clears send
attack, incoming attack can be **cancelled** by your own outgoing attack while it
waits in your queue, and whatever isn't cancelled rises into your board. You win
by making the opponent **top out**.

The garbage lifecycle (TETR.IO and Jstris are structurally identical here):

1. **Queue** — incoming garbage shows as a meter beside your board; it does not
   enter immediately.
2. **Cancel** — lines you send first subtract from the pending queue
   ("Defend = Attack + Lines cleared" — [TETRIS-FAQ](https://winternebs.github.io/TETRIS-FAQ/versus/)).
3. **Enter** — uncancelled garbage rises when you place a piece (Jstris "full
   garbage blocking": garbage waits until you finish your current combo;
   TETR.IO has configurable garbage speed/cap and visual aging from yellow →
   red → active).
4. **Hole placement** — the hole column persists for consecutive lines of one
   attack and changes between attacks ("change on attack" in TETR.IO). The
   probability the hole moves per line is **messiness** — clean garbage is easy
   to clear with quads; messy garbage ("cheese") must be dug line by line.

### 1.2 Attack table (base lines sent)

Jstris' table (confirmed, near-identical to Tetris Friends Expert+ —
[TetrisWiki](https://tetris.wiki/Jstris)); TETR.IO uses the same base values
with its own combo/B2B systems layered on top (base values are community-
documented; the League S2 note "All Clear garbage reduced from 10 to 5"
confirms the PC baseline):

| Clear              | Lines sent |
| ------------------ | ---------- |
| Single             | 0          |
| Double             | 1          |
| Triple             | 2          |
| Quad ("Tetris")    | 4          |
| T-spin Single      | 2          |
| T-spin Double      | 4          |
| T-spin Triple      | 6          |
| Mini T-spin Single | 0          |
| Mini T-spin Double | 1 (TETR.IO) / 4 (Jstris counts it as TSD) |
| Perfect/All Clear  | 10 (Jstris; TETR.IO reduced to 5 in League S2, +B2B) |
| Back-to-Back bonus | +1 per attack |

The headline fact for training: **singles and doubles are nearly worthless;
quads and T-spin doubles dominate.** A TSD sends 4 for clearing 2 lines — the
best attack-per-line in the game; with B2B it's 5.

T-spin detection: **3-corner rule** — at least 3 of the 4 cells diagonal to the
T's center are filled and the last move was a rotation. It's a **full** T-spin if
the two front corners (the side the T points toward) are filled, otherwise a
**mini** — unless the final (5th) kick was used, which upgrades to full
([TETR.IO wiki – Spins](https://tetrio.wiki.gg/wiki/Spins)). TETR.IO also has
optional **All-Spin / All-Mini** rules where every piece can score spins;
Tetra League counts all-spins toward B2B.

### 1.3 Combos

- **Jstris**: additive combo table — +0 at 1-combo rising stepwise to +5 at
  12+ combo ([TetrisWiki](https://tetris.wiki/Jstris)). This makes 4-wide combo
  strategies strong on Jstris.
- **TETR.IO**: the **Multiplier** system, explicitly designed to nerf 4-wide:
  attack = `base × (1 + 0.25 × combo)`; if base is 0 (singles), `ln(1 + 1.25 ×
  combo)` applies from 2-combo up. Multiplying means combos amplify *big*
  clears — a combo that *ends* in a quad or TSD spikes hard, while a
  singles-only combo sends a trickle
  ([TETR.IO wiki – Mechanics](https://tetrio.wiki.gg/wiki/Mechanics)).
  Rounding is DOWN in Tetra League/Zen, weighted-RNG in Quick Play.

### 1.4 Back-to-Back: charging and Surge

"Difficult" clears (quads, T-spins, all-spins if enabled) chain B2B; any normal
single/double/triple breaks it. TETR.IO replaced flat B2B chaining with
**B2B Charging** (Beta 1.0.0, July 2024), now the default in all multiplayer:

- Each attack in a B2B streak gets **+1 line**.
- At B2B ×4 you start charging **Surge**: 4 lines base (1 in Quick Play), +1
  per additional B2B level, **no cap**.
- When the streak breaks, the entire Surge fires at once, split into three
  segments ([TetrisWiki](https://tetris.wiki/TETR.IO)).

This is the single biggest strategic difference from Jstris (flat +1 B2B):
TETR.IO rewards *sustained* difficult-clear streaks with delayed nuclear
spikes, and a 1v1 UI warning fires when one player is 8+ B2B behind.

### 1.5 Other versus mechanics worth knowing

- **Opener Phase** (TETR.IO, default on): for your first 14 pieces, if you've
  sent less than is pending, you cancel at 2× — softens opener cheese.
- **Garbage Special Bonus**: quads/spins that clear garbage send +1 flat.
- **Margin time**: in custom rooms/FFA, attack multiplies gradually after a set
  time to force games to end.
- **Passthrough**: off by default since Alpha 6.1.2 (attacks in flight cancel
  normally).
- **Attack splitting** (Quick Play): attacks over 4 lines split into chunks of
  4; 8+ line attacks trigger a **Windup** warning with delayed entry.
- **Jstris targeting**: in FFA, "Targets" rotates your garbage target around
  the room on a fixed cycle.

### 1.6 Competitive formats

- **TETR.IO Tetra League** — *the* ranked 1v1. First-to-3 (ranks ≤ A+),
  first-to-5 (S− to SS), first-to-7 (U and above). Rating is **TR (Tetra
  Rating)** on Glicko-2; letter ranks **D through X+** assigned by leaderboard
  percentile once rating deviation < 100. 10 placement matches
  ([TetrisWiki](https://tetris.wiki/TETR.IO)).
- **TETR.IO Quick Play (Zenith Tower)** — replaced the old Quick Play in 2024:
  a continuous climbing FFA with floors/altitude, height-multiplied attacks,
  hidden targeting factor, and optional difficulty mods.
- **TETR.IO Royale / custom rooms** — last-standing FFA, Tetris-99-style
  targeting, margin time; room hosts can change nearly every rule.
- **Jstris Live** — FFA rooms (Default, 1v1 Room, Slow, New players) with
  rotating-target garbage; private rooms have fully customizable attack
  tables.
- Offline/console: Tetris Effect: Connected and Puyo Puyo Tetris are the main
  non-browser versus titles; the browser clients (TETR.IO, Jstris) are where
  competitive play and training concentrate.

---

## 2. What wins 1v1s — versus skills

The [TETRIS-FAQ versus guide](https://winternebs.github.io/TETRIS-FAQ/versus/)
is blunt: efficiency is everything. "Singles literally do nothing."

1. **B2B stacking (quads + T-spins)** — the core offensive engine. Keep a
   clean stack with a well, alternate quads and TSDs, never break B2B with a
   junk clear. Under TETR.IO's Surge rules this is even more pronounced: long
   B2B chains *are* the win condition.
2. **Downstacking** — clearing garbage fast without burying yourself. The
   defining skill difference at mid ranks: garbage you clear is both defense
   and attack (garbage clears send bonus lines and feed combo). Trained
   directly by cheese race (see §4).
3. **T-spin technique** — seeing TSD shapes in the stack (forecasting),
   building overhangs, floating T-spins, donations. FAQ's prerequisite before
   investing here: 40L sprint under ~1:15.
4. **Openers** — scripted first 1–3 bags. Community consensus tiers
   ([four.lol](https://four.lol/openers/practical-openers/),
   [TETRIS-FAQ](https://winternebs.github.io/TETRIS-FAQ/versus/)):
   - **TKI-3** — most flexible, near risk-free, covers ~50% of opening
     sequences; the default recommendation.
   - **MKO** — TKI-comparable efficiency, needs strong stacking; not for
     beginners.
   - **DT Cannon** — 2-bag setup, slower, but spikes 11 (TSD + B2B TST).
   - **PCO** — ~85% PC chance with I on hold, but sends *clean* garbage that
     good opponents quad off of; FAQ advises against relying on it.
   - General advice: learn *few* openers, then invest in midgame.
5. **Midgame & timing** — when to spike vs. when to hold attack, cancelling
   into your opponent's spike, building during their downtime. "Powerstacking"
   (combo wells leveraged by a speed advantage) is the modern high-level
   pattern.
6. **4-wide awareness** — center 4-wide combo is overpowered on flat-table
   clients (Jstris has NoFW rooms for this reason); TETR.IO's multiplier
   system intentionally killed it. You mostly need to know how to *counter*
   it.

### Metrics

- **PPS** — pieces per second (raw speed).
- **APM** — attack per minute (lines sent; offense efficiency × speed).
- **VS score** — TETR.IO's combined skill stat:
  `VS = ((lines sent + garbage cleared) / pieces) × PPS × 100` — i.e. APM
  plus credit for downstacking
  ([tetrio.team2xh.net](https://tetrio.team2xh.net/faq)).
- **APP** (APM/PPS/60, attack per piece) is the derived efficiency stat the
  community watches: high PPS with low APP = fast but wasteful.
- Per-rank averages of APM/PPS/VS are published at
  [tetrio.team2xh.net](https://www.tetrio.team2xh.net/) (live, queryable per
  rank). Directional picture: TR correlates with all three; top ranks (U/X)
  sit around 2+ PPS with high APP, mid ranks (~A) around 1–1.5 PPS.
  *(Exact per-rank numbers shift each season — pull them live rather than
  hardcoding.)*

---

## 3. Getting good in general — fundamentals

From the [TETRIS-FAQ](https://winternebs.github.io/TETRIS-FAQ/general/) and
[Hard Drop](https://harddrop.com/wiki/Finesse):

1. **Finesse** — placing any piece in at most 2 inputs (plus drop) using DAS
   to walls and the correct rotation direction ("two-step finesse"). Key
   sub-skill: **DAS tap-back** (DAS to wall, tap back one) and preferring a
   rotation over a tap-back when it saves a key. Measured as **finesse
   faults** (TETR.IO 40L Pro mode shows an input counter) or **KPP** (keys
   per piece — lower is better; ~3.0–3.5 KPP is clean). Notably, the FAQ
   says perfect finesse is *optional* — top players have consistent, not
   perfect, input patterns; using both CW and CCW rotation is the
   non-negotiable part.
2. **Handling tuning** — ARR as low as possible (0–1 ms, instant-to-wall);
   DAS starting ~130 ms and lowered until control breaks down. (tetra's
   defaults — DAS 133/ARR 10/SDF 20 — sit in the standard range.)
3. **Speed via sprint** — 40 LINES is the universal speed benchmark.
   Progression milestones from the FAQ: first, finish 40L *clearing only
   quads* in 1:30–2:00 (forces clean stacking); sub-1:15 is the gate before
   investing in T-spin technique; beyond that, speed grows from planning
   ahead (using all 5 previews) more than from finger speed.
4. **Stacking shape** — keep the stack flat-ish with a single well
   (conventionally at the side), avoid creating holes and overhangs you
   didn't plan; "clean stacking" is also the core of downstacking — make
   the next placement obvious ([cheese guide](https://winternebs.github.io/TETRIS-FAQ/cheese/)).
5. **Practice methodology** — the FAQ's strongest claims are about *how* to
   practice: time-on-task plus replay review beats grinding restarts
   (sprint-restart-spam reduces effective practice per hour); a new PB is
   not the same thing as improvement; review your own replays and faster
   players'.

A defensible skill progression for a training app:
**stack clean (quads only) → finesse/handling → sprint speed → downstack
(cheese) → T-spins → openers → versus midgame** — each stage has a
measurable gate (sprint time, blocks-per-cheese-race, finesse faults, then
APM/VS).

---

## 4. The mode landscape — and what each trains

| Mode | Where | Rules | Trains |
| ---- | ----- | ----- | ------ |
| **40 Lines (Sprint)** | TETR.IO, Jstris (20/40/100/1000) | Clear 40 lines fastest; TETR.IO Pro mode adds input/finesse counters | Raw speed, clean stacking, finesse |
| **Blitz / Ultra** | TETR.IO (2 min, leveling gravity) / Jstris (2 min) | Max score in 2 minutes | Scoring efficiency, T-spins under speed |
| **Cheese Race** | Jstris (10/18/100/∞ lines) | Clear pre-laid messy garbage in fewest pieces/time; benchmark: <250 blocks per 100 lines is advanced | **Downstacking** — the versus survival skill |
| **Survival** | Jstris | Garbage rises 1 line/sec, survive | Downstacking under pressure |
| **20TSD** | Jstris | Only TSDs allowed, chain as many as possible | T-spin vision and cycling |
| **PC Mode** | Jstris | Consecutive perfect clears | PC stacking, bag math |
| **Map Downstack** | Jstris | Clear authored board puzzles | Specific shapes, PC finishes |
| **Zen** | TETR.IO | Endless, no fail, persistent score | Casual reps, B2B habits |
| **Bot matches** | Jstris (ColdClear, MisaMino, Freybot, Dellacherie) | 1v1 vs engine at chosen strength | Versus practice on demand |
| **Tetra League** | TETR.IO | Ranked 1v1, FT3/5/7, Glicko-2 TR, ranks D→X+ | The actual goal |
| **Quick Play / Zenith** | TETR.IO | Climbing FFA, floors, mods | Versus stamina, chaos management |
| **Royale / custom FFA** | TETR.IO, Jstris Live | Last standing, targeting, margin time | Multi-target versus |

The training-relevant takeaway: the community already converged on a
mode-per-skill mapping — **sprint = speed, cheese = downstacking, 20TSD = spin
vision, bots/league = integration**. A training app reproduces exactly this
ladder, instruments it (KPP, finesse faults, attack-per-piece, blocks-per-
cheese-race), and sequences it.

---

## Sources

- [TetrisWiki — TETR.IO](https://tetris.wiki/TETR.IO) (mechanics, B2B charging/Surge, Tetra League, Quick Play, solo modes)
- [TetrisWiki — Jstris](https://tetris.wiki/Jstris) (attack & combo tables, modes, rooms)
- [TETR.IO wiki — Mechanics](https://tetrio.wiki.gg/wiki/Mechanics), [Spins](https://tetrio.wiki.gg/wiki/Spins), [TETRA LEAGUE](https://tetrio.wiki.gg/wiki/TETRA_LEAGUE)
- [TETRIS-FAQ — Versus](https://winternebs.github.io/TETRIS-FAQ/versus/), [General](https://winternebs.github.io/TETRIS-FAQ/general/), [Cheese](https://winternebs.github.io/TETRIS-FAQ/cheese/), [Fundamentals](https://winternebs.github.io/TETRIS-FAQ/fundamental/)
- [Hard Drop wiki — Finesse](https://harddrop.com/wiki/Finesse)
- [four.lol — Practical Openers](https://four.lol/openers/practical-openers/)
- [TETRIO Statistics by Tenchi](https://www.tetrio.team2xh.net/) (VS formula, per-rank stat averages)

**Confidence notes.** Jstris attack/combo tables, TETR.IO combo formula, B2B
Charging/Surge, Tetra League format, and mode lists are directly sourced and
high-confidence. The TETR.IO *base* attack values are community-standard
guideline numbers consistent with all sources but not printed as a table in
any page fetched (the wikis render it as an image) — verify against the
in-game custom-room config before hardcoding into the engine. Per-rank
APM/PPS/VS averages change seasonally — treat tetrio.team2xh.net as the live
source of truth.
