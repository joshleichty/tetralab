import type { Action } from '../engine/types'

export interface Handling {
  /** delayed auto shift, ms before auto-repeat starts */
  das: number
  /** auto repeat rate, ms between shifts once DAS is charged (0 = instant to wall) */
  arr: number
  /** DAS cut delay, ms: pauses auto-repeat after a rotation or hard drop (0 = off) */
  dcd: number
}

export interface KeyBindings {
  left: string[]
  right: string[]
  softDrop: string[]
  hardDrop: string[]
  cw: string[]
  ccw: string[]
  r180: string[]
  hold: string[]
  pause: string[]
  restart: string[]
}

export const DEFAULT_BINDINGS: KeyBindings = {
  left: ['ArrowLeft'],
  right: ['ArrowRight'],
  softDrop: ['ArrowDown'],
  hardDrop: ['Space'],
  cw: ['ArrowUp', 'KeyX'],
  ccw: ['KeyZ'],
  r180: ['KeyA'],
  hold: ['KeyC', 'ShiftLeft'],
  pause: ['Escape', 'KeyP'],
  restart: ['KeyR'],
}

export type BindableAction = keyof KeyBindings

type Dir = 'left' | 'right'

/**
 * Translates raw key events into engine actions with ms-based DAS/ARR,
 * Jstris-style: the most recently pressed direction wins, and DAS charge
 * is preserved when switching back. DOM events feed `press`/`release`,
 * which are public so the whole pipeline tests headlessly.
 */
export class InputHandler {
  handling: Handling
  bindings: KeyBindings

  /** engine action sink — set by the game loop */
  dispatch: (a: Action) => void = () => {}
  /**
   * fires once per physical gameplay keydown (exactly when `keypresses`
   * increments) with the engine action it maps to — no DAS/ARR repeats.
   * The replay press log (stats fidelity) hangs off this.
   */
  onPress: (a: Action) => void = () => {}
  onPause: () => void = () => {}
  onRestart: () => void = () => {}
  /** when false, taps/DAS still charge but no actions are dispatched (countdown) */
  enabled = true
  /** safelock: while > 0, hard drop presses are swallowed (set after auto-locks) */
  safelockMs = 0

  /** total gameplay keypresses this game (KPP numerator) */
  keypresses = 0

  private held = new Set<string>()
  private dirStack: Dir[] = []
  private dasCharge = 0
  private arrAcc = 0
  private dcdLeft = 0
  private softHeld = false
  private pieceMoves = 0
  private pieceUsedSoftDrop = false

  constructor(handling: Handling, bindings: KeyBindings) {
    this.handling = handling
    this.bindings = bindings
  }

  attach(target: HTMLElement | Window) {
    target.addEventListener('keydown', this.onKeyDown as EventListener)
    target.addEventListener('keyup', this.onKeyUp as EventListener)
  }

  detach(target: HTMLElement | Window) {
    target.removeEventListener('keydown', this.onKeyDown as EventListener)
    target.removeEventListener('keyup', this.onKeyUp as EventListener)
    this.reset()
  }

  reset() {
    this.held.clear()
    this.dirStack = []
    this.dasCharge = 0
    this.arrAcc = 0
    this.dcdLeft = 0
    this.safelockMs = 0
    if (this.softHeld) {
      this.softHeld = false
      this.dispatch('softDropOff')
    }
  }

  /** start-of-game counter reset */
  resetCounters() {
    this.keypresses = 0
    this.pieceMoves = 0
    this.pieceUsedSoftDrop = false
  }

  /**
   * Movement/rotation presses spent on the current piece + whether soft
   * drop was involved (those placements aren't finesse-graded). Resets
   * the per-piece counters; call on lock and on hold.
   */
  takePieceInputs(): { moves: number; usedSoftDrop: boolean } {
    const out = { moves: this.pieceMoves, usedSoftDrop: this.pieceUsedSoftDrop }
    this.pieceMoves = 0
    this.pieceUsedSoftDrop = false
    return out
  }

  private actionFor(code: string): BindableAction | null {
    for (const [action, codes] of Object.entries(this.bindings)) {
      if (codes.includes(code)) return action as BindableAction
    }
    return null
  }

  private onKeyDown = (e: KeyboardEvent) => {
    if (!this.actionFor(e.code)) return
    e.preventDefault()
    if (e.repeat) return
    this.press(e.code)
  }

  private onKeyUp = (e: KeyboardEvent) => {
    this.release(e.code)
  }

  press(code: string) {
    const action = this.actionFor(code)
    if (!action || this.held.has(code)) return
    this.held.add(code)
    if (action !== 'pause' && action !== 'restart') {
      this.keypresses++
      this.onPress(action === 'softDrop' ? 'softDropOn' : action)
    }

    switch (action) {
      case 'left':
      case 'right':
        this.pieceMoves++
        this.pressDir(action)
        break
      case 'softDrop':
        this.softHeld = true
        this.pieceUsedSoftDrop = true
        if (this.enabled) this.dispatch('softDropOn')
        break
      case 'hardDrop':
        if (this.safelockMs > 0) break
        this.dcdLeft = this.handling.dcd
        if (this.enabled) this.dispatch('hardDrop')
        break
      case 'cw':
      case 'ccw':
      case 'r180':
        this.pieceMoves++
        this.dcdLeft = this.handling.dcd
        if (this.enabled) this.dispatch(action)
        break
      case 'hold':
        if (this.enabled) this.dispatch('hold')
        break
      case 'pause':
        this.onPause()
        break
      case 'restart':
        this.onRestart()
        break
    }
  }

  release(code: string) {
    const action = this.actionFor(code)
    if (!action) return
    this.held.delete(code)

    if (action === 'left' || action === 'right') {
      if (!this.isDirHeld(action)) {
        this.dirStack = this.dirStack.filter((d) => d !== action)
        this.arrAcc = 0
        // DAS charge is preserved for the remaining direction (Jstris behavior)
        if (this.dirStack.length === 0) this.dasCharge = 0
      }
    } else if (action === 'softDrop' && !this.isDirHeld('softDrop')) {
      this.softHeld = false
      this.dispatch('softDropOff')
    }
  }

  private isDirHeld(action: BindableAction): boolean {
    return this.bindings[action].some((c) => this.held.has(c))
  }

  private pressDir(dir: Dir) {
    this.dirStack = this.dirStack.filter((d) => d !== dir)
    this.dirStack.push(dir)
    this.dasCharge = 0
    this.arrAcc = 0
    if (this.enabled) this.dispatch(dir)
  }

  /** call once per fixed simulation step */
  update(dtMs: number) {
    if (this.safelockMs > 0) this.safelockMs -= dtMs
    const dir = this.dirStack[this.dirStack.length - 1]
    if (!dir) return
    this.dasCharge += dtMs // charge accumulates even through DCD
    if (this.dcdLeft > 0) {
      // DAS cut delay: auto-repeat pauses after rotate/hard-drop [FAQ]
      this.dcdLeft -= dtMs
      return
    }
    if (this.dasCharge < this.handling.das) return
    if (!this.enabled) return

    if (this.handling.arr <= 0) {
      // instant: shove to the wall
      for (let i = 0; i < 10; i++) this.dispatch(dir)
      return
    }
    this.arrAcc += dtMs
    while (this.arrAcc >= this.handling.arr) {
      this.arrAcc -= this.handling.arr
      this.dispatch(dir)
    }
  }
}
