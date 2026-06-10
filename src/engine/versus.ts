import { Engine } from './engine'
import { createRng } from './rng'
import type { EngineConfig, GameEvent } from './types'

/**
 * Versus substrate (spec Phase 2) — pure and headless. The match layer
 * doesn't know a script from a bot: anything implementing `Opponent`
 * plugs in (the bot stream's sparring partner lands here).
 */

export interface Opponent {
  readonly maxHp: number
  /** remaining hit points; the match is won when this reaches 0 */
  hp: number
  /** advance the opponent's clock; it may queue outgoing attacks */
  tick(dtMs: number): void
  /** absorb an attack from the player */
  receiveAttack(lines: number): void
  /** drain attacks aimed at the player (lines per attack) */
  takeOutgoing(): number[]
}

export interface ScriptedPressureConfig {
  seed: number
  /** average attack lines per minute the script sends */
  apm: number
  hp: number
  /** attack burst size range, inclusive */
  burstMin?: number
  burstMax?: number
}

/**
 * Deterministic, seeded garbage pressure: sends bursts of `burstMin`–
 * `burstMax` lines, paced so the average is `apm` lines per minute.
 * Difficulty presets = APM × messiness (messiness lives in AttackConfig).
 */
export class ScriptedPressureOpponent implements Opponent {
  readonly maxHp: number
  hp: number

  private readonly rng: () => number
  private readonly apm: number
  private readonly burstMin: number
  private readonly burstMax: number
  private timer: number
  private nextBurst: number
  private outgoing: number[] = []

  constructor(cfg: ScriptedPressureConfig) {
    this.maxHp = cfg.hp
    this.hp = cfg.hp
    this.apm = cfg.apm
    this.burstMin = cfg.burstMin ?? 1
    this.burstMax = cfg.burstMax ?? 4
    this.rng = createRng(cfg.seed)
    this.nextBurst = this.rollBurst()
    this.timer = this.intervalFor(this.nextBurst)
  }

  private rollBurst(): number {
    return this.burstMin + Math.floor(this.rng() * (this.burstMax - this.burstMin + 1))
  }

  /** ms between bursts so that lines/minute averages `apm` */
  private intervalFor(burst: number): number {
    return (burst / this.apm) * 60_000
  }

  tick(dtMs: number) {
    if (this.hp <= 0) return
    this.timer -= dtMs
    while (this.timer <= 0) {
      this.outgoing.push(this.nextBurst)
      this.nextBurst = this.rollBurst()
      this.timer += this.intervalFor(this.nextBurst)
    }
  }

  receiveAttack(lines: number) {
    this.hp = Math.max(0, this.hp - lines)
  }

  takeOutgoing(): number[] {
    const out = this.outgoing
    this.outgoing = []
    return out
  }
}

export type MatchStatus = 'playing' | 'won' | 'lost'

/**
 * One human-driven (or bot-driven) engine versus an `Opponent`.
 * Deplete the opponent's HP to win; top out to lose. Drive it with
 * `applyAction` + `tick`, drain `takeEvents` — same surface as the
 * engine, so the UI layer and tests are interchangeable drivers.
 */
export class Match {
  readonly engine: Engine
  readonly opponent: Opponent
  status: MatchStatus = 'playing'

  private events: GameEvent[] = []

  constructor(engineCfg: Partial<EngineConfig> & { seed: number }, opponent: Opponent) {
    this.engine = new Engine({ mode: 'battle', ...engineCfg })
    this.opponent = opponent
  }

  start() {
    this.engine.start()
  }

  applyAction(action: Parameters<Engine['applyAction']>[0]) {
    if (this.status !== 'playing') return
    this.engine.applyAction(action)
    this.route()
  }

  tick(dtMs: number) {
    if (this.status !== 'playing') return
    this.engine.tick(dtMs)
    this.opponent.tick(dtMs)
    for (const lines of this.opponent.takeOutgoing()) this.engine.queueGarbage(lines)
    this.route()
  }

  /** drain engine events, routing attacks/outcomes; buffer the rest for the UI */
  private route() {
    for (const ev of this.engine.takeEvents()) {
      this.events.push(ev)
      if (ev.kind === 'attack') {
        this.opponent.receiveAttack(ev.lines)
        if (this.opponent.hp <= 0 && this.status === 'playing') {
          this.status = 'won'
          this.events.push({ kind: 'win' })
        }
      } else if (ev.kind === 'gameover') {
        if (this.status === 'playing') this.status = 'lost'
      }
    }
  }

  takeEvents(): GameEvent[] {
    const out = this.events
    this.events = []
    return out
  }
}
