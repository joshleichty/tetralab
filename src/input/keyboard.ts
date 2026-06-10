import type { Action } from '../engine/types'

export interface Handling {
  /** delayed auto shift, ms before auto-repeat starts */
  das: number
  /** auto repeat rate, ms between shifts once DAS is charged (0 = instant to wall) */
  arr: number
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
 * is preserved when switching back.
 */
export class InputHandler {
  handling: Handling
  bindings: KeyBindings

  /** engine action sink — set by the game loop */
  dispatch: (a: Action) => void = () => {}
  onPause: () => void = () => {}
  onRestart: () => void = () => {}
  /** when false, taps/DAS still charge but no actions are dispatched (countdown) */
  enabled = true

  private held = new Set<string>()
  private dirStack: Dir[] = []
  private dasCharge = 0
  private arrAcc = 0
  private softHeld = false

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
    if (this.softHeld) {
      this.softHeld = false
      this.dispatch('softDropOff')
    }
  }

  private actionFor(code: string): BindableAction | null {
    for (const [action, codes] of Object.entries(this.bindings)) {
      if (codes.includes(code)) return action as BindableAction
    }
    return null
  }

  private onKeyDown = (e: KeyboardEvent) => {
    const action = this.actionFor(e.code)
    if (!action) return
    e.preventDefault()
    if (e.repeat || this.held.has(e.code)) return
    this.held.add(e.code)

    switch (action) {
      case 'left':
      case 'right':
        this.pressDir(action)
        break
      case 'softDrop':
        this.softHeld = true
        if (this.enabled) this.dispatch('softDropOn')
        break
      case 'hardDrop':
        if (this.enabled) this.dispatch('hardDrop')
        break
      case 'cw':
        if (this.enabled) this.dispatch('cw')
        break
      case 'ccw':
        if (this.enabled) this.dispatch('ccw')
        break
      case 'r180':
        if (this.enabled) this.dispatch('r180')
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

  private onKeyUp = (e: KeyboardEvent) => {
    const action = this.actionFor(e.code)
    if (!action) return
    this.held.delete(e.code)

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

  /** call once per frame */
  update(dtMs: number) {
    const dir = this.dirStack[this.dirStack.length - 1]
    if (!dir) return
    this.dasCharge += dtMs
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
