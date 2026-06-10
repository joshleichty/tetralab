---
summary: What modern Tetris clients (TETR.IO, Jstris, Tetris Effect, trainers) treat as table stakes vs top tier — game feel, every micro-interaction and animation, the full SFX/music inventory and where to source audio legally, settings/stats/training UX, and the technical craft underneath.
read_when: touching UI, input handling, animations/effects, audio, settings, stats displays, or planning any polish/feel work.
---

# The quality bar for modern Tetris clients

> Deep-research report, 2026-06-09. Five parallel Opus research agents, one per
> dimension: game feel/input, visual effects, audio + sourcing, UI/UX/settings,
> technical craft. Reference clients studied: TETR.IO, Jstris, Tetris Effect:
> Connected, Puyo Puyo Tetris 1/2, Techmino, Cambridge, Four-tris. This is an
> ecosystem survey — what the bar IS, not what tetra should build. Feature specs
> derive from this via separate interviews.

## TL;DR — the bar, distilled

The ecosystem's quality model is **two-axis separation**: *feel* (latency,
input fidelity, handling configurability) is non-negotiable and identical
across all presets; *juice* (particles, shake, escalation VFX) is cosmetic,
layered on top, and scalable to zero. Clients are punished hardest for input
lag, dropped inputs, and jittery frame pacing — and almost never for visual
austerity (Jstris is beloved *because* it's austere). Data-bearing feedback
(action text, garbage meter, danger tint) survives even in minimal modes;
spectacle does not. For a "minimal, quiet, precise" instrument this is
convenient: the table stakes ARE the minimal pole, executed perfectly.

Non-negotiables players punish: input lag, dropped/missed inputs, unstable
frame pacing on high-refresh monitors, memory/WebGL leaks over a session.
Things players configure to zero anyway: line clear animation, particles,
backgrounds, music.

---

## 1. Game feel & input handling

### 1.1 Handling settings (the four canonical knobs)

- **DAS** (Delayed Auto Shift) — hold time before auto-repeat. Lower = faster.
- **ARR** (Auto Repeat Rate) — repeat speed once DAS fires. 0 = instant wall.
- **SDF** (Soft Drop Factor) — gravity multiplier while soft-dropping. ∞ = instant.
- **DCD** (DAS Cut Delay) — pauses active DAS for N frames on rotate/spawn. 0 = off.

| Client | DAS | ARR | Soft drop | DCD | Units |
|---|---|---|---|---|---|
| TETR.IO | configurable; most players < 130 ms | min 0 | SDF up to ∞ | 1–2 frames common | frames, with "Jstris handling mode" ms toggle |
| Jstris | default 133 ms; serious players 60–100 | default 10 ms; serious players 0 | instant-capable | n/a | ms |
| Techmino | 0–20 f | 0–15 f | separate SD-DAS 0–10 f / SD-ARR 0–4 f | 0–20 f | frames |
| Tetris Effect: C | fixed slow (30 Hz) | fixed, no 0 | fixed | n/a | n/a |
| PPT 1/2 | fixed slow | fixed slow | fixed | n/a | n/a |

- Competitive standard: **ARR 0, DAS 60–130 ms, SDF ∞**. Guideline baseline
  (the *slow* official spec, for contrast): ARR 2 f (~33 ms), ARE 6 f (~100 ms).
- No user handling settings = automatically mediocre tier in community eyes
  (the standing complaint about TE:C and PPT).
- **Table stakes**: DAS/ARR/soft-drop configurable, ARR settable to 0, SDF to ∞.
- **Top tier**: ms *and* frame display modes; separate soft-drop DAS/ARR
  (Techmino); DCD as an advanced knob; live "TEST" area next to the handling
  settings (TETR.IO); toggles for *prevent accidental hard drops*, *cancel DAS
  on direction change*, *prefer soft drop over movement*.

### 1.2 Input pipeline

- **Event-driven, never polled, never OS-repeat.** Capture keydown/keyup
  immediately with `event.timeStamp`, push into an input queue; the fixed-step
  sim drains the queue. DAS/ARR computed from a held-key timer, never from the
  browser's native key repeat.
- **Sub-frame ordering.** TETR.IO runs at 600 subframes/sec (60 f × 10) so two
  presses 2 ms apart are ordered correctly even within one render frame — this
  is also what its replay format encodes.
- **Latency bar**: anything perceptible disqualifies; implicit target ≤ 1 frame
  (~16 ms) added latency. Jitter matters more than mean — fluctuating latency
  destroys muscle memory. TETR.IO's forced VSync in v10 caused an outcry; the
  expected remedy is a VSync/FPS-cap toggle, not a forced setting.
- **Every input registers, always.** PPT2 is the cautionary tale: pros misdrop
  from unregistered holds/rotates; one pro measured 3–4 s slower on 40L purely
  from feel. Key rollover and simultaneous same-frame inputs (rotate+move) must
  work.

### 1.3 Board micro-feel

- **Lock delay**: guideline 0.5 s / 30 frames, **move-reset capped at 15 moves**
  (Extended Placement Lock Down). Reset models worth knowing: step reset,
  move reset (Infinity), entry reset. Top tier: visually telegraph the lock
  timer (active piece dims/pulses as lock approaches).
- **Ghost piece**: translucent or outline projection; visibility/contrast is a
  real debated quality axis (TETR.IO issues filed over a barely-visible ghost).
  Top tier: configurable opacity *and* outline-only variant.
- **ARE (spawn delay)**: guideline 6 f / ~100 ms; competitive web clients run
  near-zero — a big part of why they feel faster than console titles.
- **IRS/IHS**: hold rotate/hold during spawn → piece spawns pre-rotated /
  pre-swapped. Expected in serious clients.
- **DAS preservation** between pieces (held direction continues at full charge)
  is the feel-critical default; DCD is the opt-out knob.
- Precise clients charge DAS on **every** held frame (Cambridge documents this;
  older games have dead-zone frames).

### 1.4 Micro-interactions per action

All cosmetic effects are zero-latency overlays — they never delay the next input.

- **Move**: instant 1-cell snap on tap; teleport-to-wall at ARR 0. **No tween
  on piece movement** — tweening reads as lag.
- **Rotate/kick**: same-frame resolution, including the kicked position.
- **Soft drop**: continuous fall at SDF rate; optional subtle streak in juicy
  clients, clean in minimal ones.
- **Hard drop**: snap + instant lock. Signature juice: a brief **drop
  trail/beam** down the dropped column, fading ~100–150 ms, plus a small
  impact/dust puff at the landing row. Communicates the column without
  slowing anything.
- **Lock**: brief cell flash/brighten, then settle; optional dust particles.
- **Hold**: instant swap, hold-box updates immediately.
- **Spawn**: rows 21–22, flat-side down, immediately controllable, near-zero ARE.

### 1.5 Restart & countdown feel

The competitive bar is near-instant re-entry. TETR.IO codifies it as **Stride
Mode**: countdown shortened from 3-2-1-GO to READY-SET-GO, **tap (not hold) to
retry**, faster forfeit, all start/end animations sped up, first piece never
S/Z/O. Conventions: dedicated restart key, sub-second back to a fresh board,
countdown shortenable or skippable (top community request for solo modes).
Trainers live or die on the reset loop.

---

## 2. Visual animation & effects inventory

### 2.1 Line clears

- TETR.IO: effectively instantaneous by default (no line-clear ARE); richness
  scales with GRAPHICS preset (MINIMAL→ULTRA) and a PARTICLE COUNT % slider.
- Jstris: clear delay defaults to **0 ms** — rows vanish instantly; configurable
  0–6000 ms but competitive standard is 0.
- Tetris Effect: light/particle bursts synced to music; Zone stacks cleared
  rows for one detonation. The maximalist pole.
- Reduce-to-zero is expected: a client that *forces* a clear animation fails
  the competitive bar.

### 2.2 Action feedback text

- Categories: T-SPIN (mini/single/double/triple), B2B, COMBO×N, PERFECT/ALL
  CLEAR — shown as text near/over the board, user-toggleable as a category
  (TETR.IO's ACTION TEXT setting).
- TETR.IO's damage numbers are styled after Persona 5; they **grow and blink**
  as attacks chain, 10+ line sends escalate further.
- **B2B "Surge" star**: a 12-point star that grows and recolors with the B2B
  streak, with sound changes at thresholds 4/8/12/24 — the canonical
  "single escalating glyph + threshold audio" pattern for chain intensity
  without screen-wide noise.

### 2.3 Combo/B2B escalation & the minimal-but-juicy split

- The TETR.IO model: data-bearing feedback (action text, damage numbers,
  garbage meter, danger tint) stays on at every preset; cosmetic spectacle
  (particles, ULTRA-only "Flash Wave" full-board effect, animated backgrounds,
  shake) is preset-gated.
- What high-level players keep ON: action text, damage numbers, garbage meter,
  danger warning. What they turn OFF/down: particles (→10%), graphics preset
  (→LOW), menu backgrounds, low-res render.
- **Cautionary lesson**: TETR.IO's MINIMAL preset drops the incoming-garbage
  indicator (issue #642), so competitive players run LOW instead — when scaling
  effects down, never drop decision-critical information with the polish.

### 2.4 Garbage & danger

- Incoming-garbage meter color state machine (the most-copied idiom):
  **transparent yellow → transparent red → opaque red** as garbage winds up,
  becomes imminent, goes live.
- Danger: board reddens when the stack is very high (TETR.IO "WARN ME WHEN I'M
  IN DANGER", toggleable).
- KO/death animations exist but are undocumented in text sources; screen shake
  on hits is expected to be disableable (TE:C does).

### 2.5 Board chrome

- Jstris's explicit taxonomy is the quiet reference: Grid = None / Standard /
  Partial / Vertical / Full; Ghost toggle; Blocks = solid-color / invisible /
  monochrome / 100+ skins. Skins visible to opponents and in replays.
- TETR.IO: backgrounds via image URL, stock Unsplash set, 4 fonts; **custom
  block skins are NOT native** — met by the TETR.IO PLUS extension (130+
  community skins). Connected/rounded block textures live in community skins.
- Performance-flavored chrome toggles double as minimalism: no menu
  backgrounds, low-res render, simplified opponent thumbnails, texture
  smoothing off (sharper pixel skins).

### 2.6 Screens & transitions

- Stride mode speeds up start/end animations; PRO MODE overlays diagnostics on
  the board (input count, finesse count, lines left, target line).
- Results screens: stats panels (Jstris "More stats": finesse, KPP); TETR.IO
  TETRA CHANNEL leaderboards. Stat count-up/graph animation timings are not
  documented anywhere — open gap, needs frame-by-frame video study.

### 2.7 Reduced motion / effects scaling

- No client ships a single "reduce motion" switch; the norm is a panel of
  granular axes (graphics preset, particle %, action text, backgrounds,
  danger warning, sound). TE:C is the accessibility high-water mark:
  38 documented features, particle/brightness sliders, disableable shake —
  but even there effects reduce rather than fully disappear.

---

## 3. Audio

### 3.1 The SFX event inventory

A complete modern client fires distinct sounds for (reconstructed from
documented mechanics + community soundpack file structures):

- **Piece manipulation** (high-frequency, must be lowest-latency): move,
  rotate (CW/CCW, optionally 180), wall-kick distinct from plain rotate,
  soft-drop tick, hard drop (the signature slam), lock (separate from hard
  drop), hold, touch-ground.
- **Clears, tiered**: single/double/triple/quad escalating in brightness;
  t-spin variants (mini/TSS/TSD/TST) as distinct "special" stingers; B2B
  (TETR.IO's ascending Surge sound, changing at streaks 4/8/12/24); perfect
  clear (biggest positive stinger); **combo ladder**.
- **Combo ladder is load-bearing**: numbered samples (`combo_1…n`) rising in
  pitch per chained clear. Jstris's combo melody literally plays a tune as you
  combo. TETR.IO pitch-shifts SFX to stay in key with the current QUICK PLAY
  floor's music.
- **Versus**: garbage incoming (telegraph), garbage lands, garbage fired.
- **State/meta**: level up, danger/top-out alarm, game over, KO, countdown +
  ready/go, menu hover/click/back.

### 3.2 Sound design character

- Two poles: quiet-clicky-tactile (TETR.IO/Jstris/trainers — short dry
  percussive transients that survive 100+ inputs/min without fatigue; SFX as
  input confirmation) vs loud-arcadey-musical (Tetris Effect/PPT — SFX as
  score). Competitive preference is firmly clicky; players run custom
  soundpacks for crisper separable cues and turn music down or off.
- Separate Music and SFX sliders are table stakes. Soundpack support is an
  expected affordance in the top tier. Board-position stereo panning is NOT an
  established convention (only TE:C's aesthetic spatial layering exists) —
  optional flourish, not a standard. TETR.IO has a STEREO slider for
  side-board audio panning in multiplayer.

### 3.3 Web Audio implementation bar

- `AudioContext` (never `<audio>` elements) with
  `{ latencyHint: 'interactive' }`.
- Decode all SFX to `AudioBuffer`s at load (never lazy-decode on first
  trigger — causes first-clear stutter); play via disposable
  `AudioBufferSourceNode`s; pool gain nodes to avoid GC glitches in the hot
  path.
- Schedule with `AudioContext.currentTime`, never `setTimeout`.
- Autoplay policy: context starts `suspended`; call `resume()` on the first
  user gesture (naturally the game's start input).
- Combo ladder: numbered samples or one sample pitch-shifted via
  `playbackRate`.

### 3.4 Music conventions

- TETR.IO: commissioned original OST (Dr Ocelot for QUICK PLAY; Chika,
  Kamoking et al.) plus copyright-free BGM from HURT RECORD; per-mode music
  (calm for ZEN/40L, battle tracks for league); QUICK PLAY is adaptive — 10
  floors, each with unique music, tempo/intensity scaling with climb, SFX
  pitch-keyed to the floor. Published OST reuse policy.
- Jstris: **no music at all** — the competitive-first, zero-cost pole.
- Tetris Effect: fully generative — inputs quantized to the beat in a fixed
  mode (B♭ Phrygian) so any action is harmonic; layers build over time; Zone
  applies a low-pass filter. The design reference, not the budget reference.
- Expected UX: per-mode assignment, shuffle, music optional/quiet by default
  in a trainer.

### 3.5 Music & SFX sourcing (licensing reality)

**Korobeiniki: do not use it, in any arrangement.** The melody is public-domain
folk, but The Tetris Company asserts a trademark on it as a brand identifier in
the video-game market and is litigious; specific arrangements carry their own
copyrights. Unofficial clients universally avoid it — TETR.IO ships zero
Korobeiniki. Original/licensed music sidesteps both issues.

| Option | License | Cost | Risk/notes |
|---|---|---|---|
| FreePD | CC0 | free | lowest-risk free music |
| Incompetech (MacLeod) | CC-BY (or $30–50 buyout/track) | free–low | attribution trap; ubiquitous tracks |
| ccMixter | mixed CC | free | filter out NC licenses |
| Epidemic Sound | subscription RF | ~£10–17/mo | **verify game/app-embed coverage — video-creator oriented** |
| Artlist | universal RF | ~$40/mo | same caveat; simplest terms |
| AudioJungle/Pond5 | per-track RF | $15–60+ | extended license needed at scale |
| OpenGameArt | CC0/BY/BY-SA/GPL | free | BY-SA copyleft contaminates bundles |
| itch.io packs | per-pack | free–$30 | read each pack's terms |
| Commission a composer | negotiated buyout | $1k–10k/piece; €25–100/hr | best fit; contract must cover public web + future commercial |
| AI (Suno/Udio Pro+) | platform commercial license | $10–30/mo | output likely uncopyrightable; litigation ongoing; placeholder only |
| Chiptune netlabels / HURT RECORD | varies | free–low | the TETR.IO model; verify per-track |
| **SFX: Kenney** | CC0 | free | ideal clicky UI/digital packs, zero risk |
| **SFX: Sonniss GDC bundles** | RF, no attribution, perpetual | free | pro-grade, ~30GB/year drops |
| SFX: freesound.org | per-clip CC | free | filter to CC0/CC-BY |
| SFX: DIY (Bfxr/jsfxr/Web Audio synth) | yours | time | fully-owned tactile identity |

What comparable clients did: TETR.IO commissioned + HURT RECORD; Jstris
shipped silence + tight SFX; Tetris Effect commissioned Hydelic. The
indie-credible path: CC0/Sonniss SFX (or synthesized in-house) immediately;
CC0 placeholder music; commission an original loop if music becomes brand.

---

## 4. UI/UX, settings, stats, training QoL

### 4.1 Settings depth (the taxonomy users expect)

- **Handling**: §1.1 knobs + the three toggles + live test area.
- **Video**: graphics preset, particle %, action text, low-res render, WebGL
  version, background toggles, danger warning, counter precision, simplified
  thumbnails, texture smoothing.
- **Audio**: master/music/SFX sliders, disable-entirely, (soundpacks top tier).
- **Gameplay/board**: grid style (None/Standard/Partial/Vertical/Full), ghost
  toggle+opacity, block skin, board background.
- **Keybinds**: every action rebindable — move L/R, soft drop, hard drop,
  rotate CW/CCW/180, hold, restart, forfeit. Defaults (Jstris): z=CCW, up=CW,
  a=180, c=hold, space=hard drop. Controller support native in TETR.IO.
  Multiple binds per action is not a documented standard (opportunity).
- **Persistence**: account-bound is the norm; local persistence for guests.
  Jstris quirk to avoid: settings only persist after an explicit re-save.

### 4.2 Stats & metrics

- **Live (fixed corner block, never floating per-piece labels)**: PPS, APM,
  VS (`(attack + garbage cleared)/pieces × PPS × 100`), finesse %, KPP,
  lines/time.
- **Derived ecosystem stats** (TetraStats/Tenchi prove the appetite): APP,
  VS/APM, DS/S, DS/P, Cheese Index, garbage efficiency, "Area" radar charts;
  rating via Glicko-2.
- **Replay-timeline analytics**: TETR.IO marks finesse faults as yellow
  triangles and **chokes** (placement >3× slower than running PPS) as red
  gradients on a scrubbable timeline; Jstris splits games into 10-placement
  segments each with its own PPS. This is the trainer-feedback bar.
- Lifetime dashboards with exposed formulas and graphs over time are expected
  by the competitive audience.

### 4.3 Training QoL (the trainer bar — Four-tris is the reference)

- **Undo/redo** (Four-tris: Ctrl+Z/Y, 100-action buffer).
- **Custom queue editing** — type piece letters into NEXT.
- **Board drawing/editing** — paint cells/stacks for setups.
- **Garbage scripting** — continuous cheese stream auto-replenished
  (Jstris Cheese Race style).
- **Finesse training, two grades**: soft (Jstris: fault counter + special
  sound on fault) and hard (Tetresse / Finesse Trainer pattern: block the
  placement and repeat the piece until correct).
- **Mode set**: Sprint (20/40/100/1000), Cheese (10/18/100/∞), Survival,
  Ultra/Blitz, PC mode, 20TSD, Maps (downstack scenarios + editor), Free play.
- **Replays for every game** (Jstris), downloadable files (.ttr/.ttrm),
  shareable URLs, event-step-level seeking.

### 4.4 Information architecture & onboarding

- Bar: **launch to first piece in well under ~15 s**, no account wall, no
  forced tutorial. Jstris: one page, mode buttons + inline settings beneath
  the board. TETR.IO: username → hub → solo/multi.
- Onboarding norm is minimal-to-none; learning is offloaded to community
  guides. No client ships a beginner/competitive handling-preset picker —
  players hand-tune (a small opportunity).
- Mode config: simple pickers (sprint length, cheese depth); TETR.IO custom
  rooms expose the full engine surface (bag type, kick set, spin bonuses,
  gravity curve, garbage params) — the ceiling for configurability.

### 4.5 Accessibility (the gap in web clients)

- TE:C leads: 3 colorblind assist types that add **patterns** to pieces,
  particle/brightness sliders, disableable shake/camera motion. PPT2 added
  colorblind support post-launch.
- TETR.IO/Jstris have **no dedicated colorblind palettes or piece patterns and
  no reduced-motion mode** — a documented complaint. Jstris's
  monochrome/solid-color blocks are incidental aids; its finesse-fault sound
  is accessibility-relevant (audio cue).
- **This is the clearest open niche for a new client**: native piece patterns,
  colorblind-safe palettes, reduced-motion, photosensitivity-safe effects.

### 4.6 Web-app polish

- Desktop-first with explicit mobile non-support is accepted (TETR.IO has no
  touch support; Jstris has basic touch areas). PWA/offline not an ecosystem
  standard. Low-end graceful-degradation toggles expected. Page basics
  (favicon, og tags, load time) assumed.

---

## 5. Technical craft

### 5.1 Rendering

- Top web client (TETR.IO, HaxeFlixel/OpenFL) **requires WebGL** and
  recommends WebGL 2; performance-credible open-source clients converge on
  pixi.js. Canvas 2D appears in toys, not in clients judged on feel — though a
  small single board can survive on Canvas 2D if text is handled well.
- **Text rendering is the named perf villain** even on GPU: cache/bitmap HUD
  text (score, timer, counters), never re-rasterize vector glyphs per frame.
- If Canvas 2D anywhere: `willReadFrequently=false` (true disables GPU
  acceleration).

### 5.2 Loop architecture & latency

- **Fixed-timestep sim decoupled from rAF render** (Gaffer "Fix Your
  Timestep"): accumulate dt, run integer-tick sim steps, clamp the
  accumulator (spiral-of-death guard). Without it, 120/144/240 Hz monitors run
  gravity 2–4× fast. TETR.IO exposes an FPS limiter in refresh-rate multiples.
- **Logic in integer ticks/subframes, never float wall-clock ms** — TETR.IO's
  600 subframes/sec is the reference. ms only drives how many ticks to run.
- **React stays out of the play loop**: game state in refs/module scope, sim
  in a rAF loop from `useEffect([])`, canvas written directly; HUD numbers via
  rAF-batched state or `ref.textContent`. Per-frame `useState` is the
  documented anti-pattern.
- Players punish unstable pacing more than low absolute fps ("90 Hz feels
  like 20fps" class of complaint).

### 5.3 Replays (determinism as a contract)

- Format: **JSON of `{engine version, seed, settings, input log}`** — replays
  re-simulate, no board-state stream. Inputs as keydown/keyup events stamped
  to subframe. (.ttr solo / .ttrm multi; Jstris exports JSON, shares URLs.)
- **Versioning is the known industry weak point** — TETR.IO officially warns
  old replays break as rules patch. Stamp engine/ruleset version, gate
  playback on match. The engine is a versioned contract.
- Same determinism (seeded 7-bag, integer ticks, ordered inputs) is exactly
  what an RL substrate and a replay system both require — one investment,
  two payoffs.

### 5.4 Loading & assets

- Preload + decode everything before first draw: fonts via
  `<link rel="preload" as="font">` + gate on `document.fonts.ready` (canvas
  text silently never updates when a font loads late — FOUT in canvas is
  invisible breakage); texture atlas for minos/skins/effects; bitmap font for
  in-game numbers; SFX decoded to buffers up front.

### 5.5 Robustness

- `visibilitychange` → auto-pause in solo play; on resume **clamp the first
  dt** so the sim doesn't fast-forward (alt-tab must not slam a piece).
- Background-tab throttling: rAF stops, timers throttled (Chrome 88+ budgets);
  audio-playing and WebSocket tabs are exempt.
- Mid-game refresh recovery: persist `{seed, settings, input-log-so-far,
  current tick}` to localStorage/IndexedDB — the replay model gives this for
  free.
- Session-long stability: WebGL context loss, texture/listener leaks, and
  progressive slowdown are heavily punished (multiple TETR.IO issue threads).

---

## 6. Synthesis: table stakes vs top tier

**Table stakes** (absent = not taken seriously):
- DAS/ARR/SDF configurable; ARR 0 and SDF ∞ reachable; event-driven input with
  zero dropped inputs; wall-clock-correct timing on any refresh rate
- 0.5 s move-reset lock delay (15-move cap), ghost piece, hold, near-zero ARE
- Instant restart key, short countdown, line clears reducible to instant
- Grid/ghost/skin/background options; every action rebindable; settings persist
- Live PPS/finesse at minimum; separate music/SFX sliders; replay per game
- Launch-to-first-piece in seconds; no forced tutorial

**Top tier** (what marks the best):
- Sub-frame input timestamping (600/sec grid); ms↔frames display; live handling
  test area; DCD + soft-drop DAS/ARR; IRS/IHS; DAS preservation
- Lock-delay telegraph on the piece; configurable ghost opacity/outline;
  hard-drop trail; tap-to-retry; skippable countdown; sped-up lifecycle
  animations (Stride)
- Two-axis effects model: data-bearing feedback always on, spectacle scalable
  to zero — without ever dropping decision-critical cues at minimal settings
- Garbage meter color-state machine; single escalating B2B glyph with
  threshold sounds; pitch-laddered combo SFX
- Replay timeline with finesse-fault and choke markers; segment analytics;
  lifetime dashboards with exposed formulas
- Trainer toolkit: undo/redo, queue editing, board painting, garbage
  scripting, hard-mode finesse lock
- Versioned deterministic replays; refresh recovery; auto-pause with dt clamp

**Open niches no web client fills** (relevant to tetra's positioning):
- Native colorblind piece patterns + reduced-motion (only the console title
  has them)
- Beginner/competitive handling presets (everyone hand-tunes)
- Multiple keybinds per action
- A client that is *designed* minimal-and-beautiful rather than
  austere-by-neglect (Jstris) or maximal-with-a-minimal-preset (TETR.IO)

**Known gaps in this research** (need frame-by-frame video or source-diving,
not wiki text): exact line-clear/action-text tween durations and easing;
KO/top-out animation specifics; results-screen count-up timings; queue-shift
and hold-swap micro-animation durations.

---

## Sources (primary)

- TETR.IO: FAQ mechanics <https://tetrio.github.io/faq/mechanics.html> ·
  performance/config <https://tetr.io/about/performance/> ·
  wiki mechanics/music <https://tetrio.wiki.gg/wiki/Mechanics>,
  <https://tetrio.wiki.gg/wiki/Music> · tetris.wiki <https://tetris.wiki/TETR.IO> ·
  issues (ghost #279/#289, garbage-on-minimal #642, countdown #537, perf
  #675/#1270/#1386/#1404, replays #972) <https://github.com/tetrio/issues> ·
  room config <https://github.com/Poyo-SSB/tetrio-bot-docs/blob/master/Room_Config.md> ·
  OST policy <https://doktorocelot.com/tetriomusicuse/>
- Jstris: guide <https://jstris.jezevec10.com/guide> · UI strings
  <https://github.com/jezevec10/jstris-multilang/blob/master/en/game.php> ·
  replays <https://jstris.jezevec10.com/replay>
- Guideline/theory: <https://tetris.wiki/Tetris_Guideline> ·
  <https://tetris.wiki/Lock_delay> · <https://harddrop.com/wiki/DAS> ·
  <https://four.lol/mid-game/finesse/>
- Trainers: Four-tris <https://tetris.wiki/Four-tris> · Cambridge
  <https://github.com/Tetro48/cambridge> · Techmino <https://tetris.wiki/Techmino> ·
  Tetresse <https://tetresse.harddrop.com/>
- Stats: TetraStats <https://github.com/dan63047/TetraStats/wiki/Meaning-and-the-essence-of-stats> ·
  Tenchi <https://www.tetrio.team2xh.net/>
- Feel case studies: PPT2 rant
  <https://galactoidtetris.wordpress.com/2020/12/10/a-rant-on-puyo-puyo-tetris-2/> ·
  TE:C accessibility <https://www.familygamingdatabase.com/accessibility/Tetris+Effect+Connected>,
  <https://www.tetriseffect.game/2022/04/27/color-deficiency-options/>
- Audio engineering: <https://web.dev/articles/webaudio-games> ·
  <https://developer.chrome.com/blog/web-audio-autoplay> ·
  Tetris Effect audio analysis
  <https://www.gamedeveloper.com/audio/game-audio-analysis---tetris-effect>
- Sourcing: Kenney <https://kenney.nl/assets/category:Audio> · Sonniss GDC
  <https://sonniss.com/gameaudiogdc/> · Incompetech FAQ
  <https://incompetech.com/music/royalty-free/faq.html> · Korobeiniki trademark
  <https://tetrisconcept.net/threads/korobeiniki-is-a-trademark-of-tetris-holding.636/> ·
  composer rates <https://www.twine.net/blog/game-composer-pricing/>
- Loop/timing engineering: <https://gafferongames.com/post/fix_your_timestep/> ·
  <https://developer.mozilla.org/en-US/docs/Games/Anatomy> ·
  <https://www.aleksandrhovhannisyan.com/blog/javascript-game-loop/> ·
  <https://developer.chrome.com/blog/timer-throttling-in-chrome-88>

> Caveat: harddrop.com and tetris.wiki block automated fetching; figures from
> those wikis were cross-confirmed via search extracts and secondary sources.
> Items flagged "not documented in text sources" were not invented — they
> genuinely require video frame analysis or client source-diving.
