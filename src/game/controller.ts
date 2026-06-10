import { Engine } from '../engine/engine'
import { optimalInputs } from '../engine/finesse'
import { VISIBLE_START } from '../engine/pieces'
import { ReplayRecorder, STEP_MS } from '../engine/replay'
import { Match, ScriptedPressureOpponent } from '../engine/versus'
import { saveReplay } from './replays'
import { DEFAULT_ENGINE_CONFIG } from '../engine/types'
import type { Action, Mode } from '../engine/types'
import { InputHandler } from '../input/keyboard'
import type { BindableAction } from '../input/keyboard'
import { sfx } from '../audio/sfx'
import { BoardRenderer, PreviewRenderer, emptyFx, type BoardFx } from '../render/renderer'
import {
  loadBest,
  loadSettings,
  saveBest,
  saveSettings,
  type BestRecords,
  type Settings,
} from './settings'

export type Phase = 'menu' | 'countdown' | 'playing' | 'paused' | 'over'

export interface ActionLabel {
  id: number
  text: string
  sub: string[]
}

export interface GameResult {
  mode: Mode
  won: boolean
  score: number
  lines: number
  level: number
  timeMs: number
  pieces: number
  pps: number
  isPersonalBest: boolean
  /** cheese mode: race size (10/18/100) */
  cheeseTotal?: number
  /** battle mode */
  battlePreset?: BattlePreset
  opponentHp?: number
  opponentMaxHp?: number
  /** attack lines sent (battle) */
  attack?: number
  /** end-of-game summary depth (docs/parity.md §8) */
  detail: GameDetail
}

export interface GameDetail {
  /** total gameplay keypresses */
  inputs: number
  /** keys per piece */
  kpp: number
  holds: number
  maxCombo: number
  maxB2B: number
  /** pieces placed with more inputs than the finesse optimum [HD-Finesse] */
  finesseFaults: number
  /** plain clears by size, 1–4 */
  clears: [number, number, number, number]
  /** T-spin/mini clears by engine label, e.g. "T-SPIN DOUBLE" */
  spins: Record<string, number>
  perfectClears: number
}

function emptyDetail(): GameDetail {
  return {
    inputs: 0,
    kpp: 0,
    holds: 0,
    maxCombo: 0,
    maxB2B: 0,
    finesseFaults: 0,
    clears: [0, 0, 0, 0],
    spins: {},
    perfectClears: 0,
  }
}

/** battle difficulty = APM × messiness (× HP) presets, surfaced simply */
export const BATTLE_PRESETS = {
  casual: { apm: 25, messiness: 0, hp: 40 },
  steady: { apm: 50, messiness: 0.3, hp: 60 },
  fierce: { apm: 90, messiness: 0.7, hp: 80 },
} as const

export type BattlePreset = keyof typeof BATTLE_PRESETS

const COUNTDOWN_MS = 1400
const RESUME_COUNTDOWN_MS = 900
const SAFELOCK_MS = 100
/** stack within this many rows of the visible top ⇒ danger */
const DANGER_ROWS = 4
const BLITZ_MS = 120_000
const MAX_FRAME_MS = 100

export class GameController {
  settings: Settings
  best: BestRecords
  phase: Phase = 'menu'
  mode: Mode = 'marathon'
  engine: Engine | null = null
  /** battle mode: the live match (engine === match.engine) */
  match: Match | null = null
  battlePreset: BattlePreset = 'casual'
  /** attack lines sent this game (APM numerator) */
  attackSent = 0
  result: GameResult | null = null
  actionLabel: ActionLabel | null = null
  /** ms remaining in the pre-game countdown */
  countdownLeft = 0
  version = 0

  private input: InputHandler
  private recorder: ReplayRecorder | null = null
  /** fixed-step index since game start; the replay/netcode time base */
  private step = 0
  private stepAcc = 0
  private detail = emptyDetail()
  /** true while the stack is in the danger zone (drives tint + warning) */
  danger = false
  private fx: BoardFx = emptyFx()
  private boardRenderer: BoardRenderer | null = null
  private holdRenderer: PreviewRenderer | null = null
  private queueRenderer: PreviewRenderer | null = null
  private listeners = new Set<() => void>()
  private raf = 0
  private lastT = 0
  private labelId = 0
  private destroyed = false

  constructor() {
    this.settings = loadSettings()
    this.best = loadBest()
    this.input = new InputHandler(
      { das: this.settings.das, arr: this.settings.arr, dcd: this.settings.dcd },
      this.settings.bindings,
    )
    this.input.dispatch = (a) => this.applyAction(a)
    this.input.onPause = () => this.togglePause()
    this.input.onRestart = () => {
      if (this.phase !== 'menu') this.start(this.mode)
    }
    this.input.attach(window)
    window.addEventListener('blur', this.onBlur)
    document.addEventListener('visibilitychange', this.onVisibility)
    this.lastT = performance.now()
    this.raf = requestAnimationFrame(this.frame)
    sfx.enabled = this.settings.sound
    sfx.setVolume(this.settings.volume / 100)
  }

  destroy() {
    this.destroyed = true
    cancelAnimationFrame(this.raf)
    this.input.detach(window)
    window.removeEventListener('blur', this.onBlur)
    document.removeEventListener('visibilitychange', this.onVisibility)
  }

  /** stuck-input protection: alt-tab mid-DAS must not leave keys held */
  private onBlur = () => {
    this.input.reset()
  }

  /** background tab: auto-pause rather than letting pieces fall blind */
  private onVisibility = () => {
    if (document.hidden && this.phase === 'playing') this.togglePause()
  }

  // ── React bridge ───────────────────────────────────────────────

  subscribe = (fn: () => void) => {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  getVersion = () => this.version

  private emit() {
    this.version++
    for (const fn of this.listeners) fn()
  }

  attachBoard(canvas: HTMLCanvasElement | null) {
    this.boardRenderer = canvas ? new BoardRenderer(canvas) : null
  }

  attachHold(canvas: HTMLCanvasElement | null, w: number, h: number) {
    this.holdRenderer = canvas ? new PreviewRenderer(canvas, w, h) : null
  }

  attachQueue(canvas: HTMLCanvasElement | null, w: number, h: number) {
    this.queueRenderer = canvas ? new PreviewRenderer(canvas, w, h) : null
  }

  /** route an action into the engine, logging it for the replay (D5) */
  private applyAction(a: Action) {
    const e = this.engine
    if (this.phase !== 'playing' || !e) return
    // skip no-op wall shoves (instant ARR fires blind) to keep logs lean
    if (a === 'left' || a === 'right') {
      const p = e.active
      const x = p?.x
      e.applyAction(a)
      if (e.active === p && p && p.x === x) return
    } else {
      e.applyAction(a)
    }
    this.recorder?.record(this.step, a)
  }

  // ── flow control ───────────────────────────────────────────────

  /** cheese race size for the current/next cheese game */
  cheeseTotal = 18

  start(mode: Mode, opts: { cheeseTotal?: number; battlePreset?: BattlePreset } = {}) {
    sfx.ensure()
    this.mode = mode
    if (opts.cheeseTotal) this.cheeseTotal = opts.cheeseTotal
    if (opts.battlePreset) this.battlePreset = opts.battlePreset
    const seed = (Math.random() * 0xffffffff) >>> 0
    if (mode === 'battle') {
      const preset = BATTLE_PRESETS[this.battlePreset]
      this.match = new Match(
        {
          seed,
          sdf: this.settings.sdf,
          attack: { ...DEFAULT_ENGINE_CONFIG.attack, messiness: preset.messiness },
        },
        new ScriptedPressureOpponent({
          seed: (seed ^ 0x51f15eed) >>> 0,
          apm: preset.apm,
          hp: preset.hp,
        }),
      )
      this.engine = this.match.engine
    } else {
      this.match = null
      this.engine = new Engine({
        seed,
        mode,
        sdf: this.settings.sdf,
        cheeseTotal: this.cheeseTotal,
      })
    }
    this.attackSent = 0
    this.recorder = new ReplayRecorder(this.engine.cfg)
    this.step = 0
    this.stepAcc = 0
    this.detail = emptyDetail()
    this.danger = false
    this.result = null
    this.actionLabel = null
    this.fx = emptyFx()
    this.phase = 'countdown'
    this.countdownLeft = COUNTDOWN_MS
    this.input.reset()
    this.input.resetCounters()
    this.input.enabled = false
    sfx.play('ready')
    this.emit()
  }

  togglePause() {
    if (this.phase === 'playing') {
      this.phase = 'paused'
      this.emit()
    } else if (this.phase === 'paused') {
      // graceful resume: a short countdown instead of dropping the player
      // back mid-air (docs/parity.md §7)
      this.phase = 'countdown'
      this.countdownLeft = RESUME_COUNTDOWN_MS
      this.input.enabled = false
      this.lastT = performance.now()
      sfx.play('ready')
      this.emit()
    } else if (this.phase === 'over' || this.phase === 'menu') {
      this.quitToMenu()
    }
  }

  quitToMenu() {
    this.phase = 'menu'
    this.engine = null
    this.match = null
    this.recorder = null
    this.result = null
    this.emit()
  }

  updateSettings(patch: Partial<Settings>) {
    this.settings = { ...this.settings, ...patch }
    saveSettings(this.settings)
    this.input.handling = {
      das: this.settings.das,
      arr: this.settings.arr,
      dcd: this.settings.dcd,
    }
    this.input.bindings = this.settings.bindings
    sfx.enabled = this.settings.sound
    sfx.setVolume(this.settings.volume / 100)
    if (this.engine && this.engine.cfg.sdf !== this.settings.sdf) {
      this.engine.cfg.sdf = this.settings.sdf
      this.recorder?.recordSdf(this.step, this.settings.sdf)
    }
    this.emit()
  }

  /** bind an additional key to an action (stealing it from any other action) */
  addBind(action: BindableAction, code: string) {
    const bindings = { ...this.settings.bindings }
    for (const key of Object.keys(bindings) as BindableAction[]) {
      bindings[key] = bindings[key].filter((c) => c !== code)
    }
    bindings[action] = [...bindings[action], code]
    this.updateSettings({ bindings })
  }

  removeBind(action: BindableAction, code: string) {
    const bindings = { ...this.settings.bindings }
    bindings[action] = bindings[action].filter((c) => c !== code)
    this.updateSettings({ bindings })
  }

  // ── main loop ──────────────────────────────────────────────────

  private frame = (t: number) => {
    if (this.destroyed) return
    const dt = Math.min(t - this.lastT, MAX_FRAME_MS)
    this.lastT = t

    if (this.phase === 'countdown') {
      const before = this.countdownLeft
      this.countdownLeft -= dt
      this.input.update(dt) // lets DAS pre-charge during the countdown
      if (before > COUNTDOWN_MS / 2 && this.countdownLeft <= COUNTDOWN_MS / 2) sfx.play('go')
      if (this.countdownLeft <= 0) {
        this.phase = 'playing'
        this.input.enabled = true
        this.engine!.start()
      }
      this.emit()
    } else if (this.phase === 'playing' && this.engine) {
      // fixed-timestep simulation: deterministic on any refresh rate, and
      // the step grid is the replay/netcode time base (docs/quality-bar §5.2)
      this.stepAcc += dt
      while (this.stepAcc >= STEP_MS && this.phase === 'playing') {
        this.stepAcc -= STEP_MS
        this.input.update(STEP_MS)
        if (this.match) {
          this.match.tick(STEP_MS) // ticks the engine + opponent, routes attacks
        } else {
          this.engine.tick(STEP_MS)
        }
        this.step++
        if (this.engine.status !== 'playing') break
        if (this.match && this.match.status !== 'playing') break
        if (this.mode === 'blitz' && this.engine.elapsed >= BLITZ_MS) {
          this.engine.status = 'won'
          this.finish(true)
          break
        }
      }
      this.drainEvents(t)
      this.updateDanger()
      this.emit()
    }

    this.render(t)
    this.raf = requestAnimationFrame(this.frame)
  }

  /** danger when the stack reaches the top rows of the visible field */
  private updateDanger() {
    const e = this.engine
    let inDanger = false
    if (e && e.status === 'playing') {
      const limit = (VISIBLE_START + DANGER_ROWS) * 10
      for (let i = 0; i < limit && !inDanger; i++) {
        if (e.board[i] !== 0) inDanger = true
      }
    }
    if (inDanger && !this.danger && this.settings.danger) sfx.play('warning')
    this.danger = inDanger
  }

  private drainEvents(now: number) {
    const engine = this.engine!
    let prevKind = ''
    const events = this.match ? this.match.takeEvents() : engine.takeEvents()
    for (const ev of events) {
      switch (ev.kind) {
        case 'move':
          sfx.play('move')
          break
        case 'rotate':
          sfx.play(ev.spin ? 'spin' : 'rotate')
          break
        case 'harddrop':
          sfx.play('harddrop')
          this.fx.drops.push({ cells: ev.cells, distance: ev.distance, t: now })
          this.fx.shakeT = now
          break
        case 'lock': {
          sfx.play('lock')
          this.fx.locks.push({ cells: ev.cells, t: now })
          // safelock: a piece that locked on its own arms a brief hard-drop
          // guard so a queued-up drop doesn't slam the next piece [TIO]
          if (prevKind !== 'harddrop' && this.settings.safelock) {
            this.input.safelockMs = SAFELOCK_MS
          }
          const { moves, usedSoftDrop } = this.input.takePieceInputs()
          const { type, rot, x } = ev.piece
          if (!usedSoftDrop && moves > optimalInputs(type, rot, x)) {
            this.detail.finesseFaults++
          }
          break
        }
        case 'hold':
          sfx.play('hold')
          this.detail.holds++
          this.input.takePieceInputs() // inputs spent pre-hold aren't the next piece's
          break
        case 'clear': {
          const { info } = ev
          if (info.lines > 0) {
            sfx.play(info.perfectClear ? 'allclear' : info.lines === 4 || info.label ? 'quad' : 'clear')
            if (info.b2b) sfx.play('b2b')
            if (info.combo > 0) sfx.play('combo', info.combo)
            this.fx.clears.push({ rows: info.rows, flash: info.lines === 4 || !!info.label, t: now })
            if (info.label && info.label !== 'QUAD') {
              this.detail.spins[info.label] = (this.detail.spins[info.label] ?? 0) + 1
            } else {
              this.detail.clears[info.lines - 1]++
            }
            if (info.perfectClear) this.detail.perfectClears++
            this.detail.maxCombo = Math.max(this.detail.maxCombo, info.combo)
            this.detail.maxB2B = Math.max(this.detail.maxB2B, engine.b2b)
          } else if (info.label) {
            this.detail.spins[info.label] = (this.detail.spins[info.label] ?? 0) + 1
          }
          const sub: string[] = []
          if (info.b2b) sub.push('BACK-TO-BACK')
          if (info.combo > 0) sub.push(`${info.combo} COMBO`)
          let text = info.label ?? ''
          if (info.perfectClear) text = 'PERFECT CLEAR'
          if (text || sub.length > 0) {
            this.actionLabel = { id: ++this.labelId, text: text || `${info.combo} COMBO`, sub }
          }
          break
        }
        case 'levelup':
          sfx.play('levelup')
          break
        case 'gameover':
          sfx.play('gameover')
          this.finish(false)
          break
        case 'win':
          this.finish(true)
          break
        case 'garbage':
          sfx.play('garbage')
          this.fx.shakeT = now
          break
        case 'attack':
          this.attackSent += ev.lines
          break
        case 'softdrop':
          break
      }
      prevKind = ev.kind
    }
  }

  private finish(won: boolean) {
    const e = this.engine!
    if (this.recorder) {
      saveReplay(this.recorder.finish(e, this.step))
      this.recorder = null
    }
    if (won) sfx.play('win')
    const timeMs = e.elapsed
    const pps = timeMs > 0 ? e.piecesPlaced / (timeMs / 1000) : 0

    let isPersonalBest = false
    if (this.mode === 'sprint' && won) {
      if (this.best.sprint === undefined || timeMs < this.best.sprint) {
        this.best.sprint = timeMs
        isPersonalBest = true
      }
    } else if (this.mode === 'blitz' && won) {
      if (this.best.blitz === undefined || e.score > this.best.blitz) {
        this.best.blitz = e.score
        isPersonalBest = true
      }
    } else if (this.mode === 'marathon') {
      if (this.best.marathon === undefined || e.score > this.best.marathon) {
        this.best.marathon = e.score
        isPersonalBest = true
      }
    } else if (this.mode === 'cheese' && won) {
      const key = `cheese${this.cheeseTotal}` as keyof BestRecords
      const prev = this.best[key]
      if (prev === undefined || timeMs < prev) {
        this.best[key] = timeMs
        isPersonalBest = true
      }
    } else if (this.mode === 'survival') {
      if (this.best.survival === undefined || timeMs > this.best.survival) {
        this.best.survival = timeMs
        isPersonalBest = true
      }
    } else if (this.mode === 'battle' && won) {
      const key = `battle_${this.battlePreset}` as keyof BestRecords
      const prev = this.best[key]
      if (prev === undefined || timeMs < prev) {
        this.best[key] = timeMs
        isPersonalBest = true
      }
    }
    if (isPersonalBest) saveBest(this.best)

    this.result = {
      mode: this.mode,
      won,
      score: e.score,
      lines: e.lines,
      level: e.level,
      timeMs,
      pieces: e.piecesPlaced,
      pps,
      isPersonalBest,
      cheeseTotal: this.mode === 'cheese' ? this.cheeseTotal : undefined,
      battlePreset: this.mode === 'battle' ? this.battlePreset : undefined,
      opponentHp: this.match?.opponent.hp,
      opponentMaxHp: this.match?.opponent.maxHp,
      attack: this.mode === 'battle' ? this.attackSent : undefined,
      detail: {
        ...this.detail,
        inputs: this.input.keypresses,
        kpp: e.piecesPlaced > 0 ? this.input.keypresses / e.piecesPlaced : 0,
      },
    }
    this.phase = 'over'
  }

  private render(now: number) {
    this.boardRenderer?.draw(
      this.engine,
      this.fx,
      now,
      this.settings.ghost,
      this.settings.vfx,
      this.danger && this.settings.danger,
    )
    this.holdRenderer?.draw([this.engine?.hold ?? null], {
      dimFirst: this.engine?.holdUsed ?? false,
    })
    const queue = this.engine ? this.engine.queue.slice(0, this.engine.cfg.queueSize) : []
    this.queueRenderer?.draw(queue.length > 0 ? queue : [null])
  }
}
