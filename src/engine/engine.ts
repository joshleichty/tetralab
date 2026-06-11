import type {
  Action,
  ActivePiece,
  EngineConfig,
  GameEvent,
  GameStatus,
  Mode,
  PieceType,
  Position,
  Rot,
} from './types.ts'
import { CELL_GARBAGE, DEFAULT_ENGINE_CONFIG, INSTANT_SDF } from './types.ts'
import {
  BOARD_H,
  BOARD_W,
  PIECE_CELL,
  SPAWN_Y,
  VISIBLE_START,
  cellsAt,
  fits,
  spawnX,
} from './pieces.ts'
import { kicksFor } from './srs.ts'
import { detectTSpin as tSpin3Corner } from './spin.ts'
import { SevenBag, createRng } from './rng.ts'
import { attackFor } from './attack.ts'
import { parseRows } from './board.ts'

const CLEAR_POINTS = [0, 100, 300, 500, 800]
const TSPIN_POINTS = [400, 800, 1200, 1600]
const TSPIN_MINI_POINTS = [100, 200, 400]
const PERFECT_CLEAR_POINTS = [0, 800, 1200, 1800, 2000]
const B2B_QUAD_PC_POINTS = 3200
const MARATHON_FINAL_LEVEL = 15
const COMBO_POINTS = 50
const B2B_MULT = 1.5
const SPRINT_GOAL = 40

const CLEAR_LABELS = ['', 'SINGLE', 'DOUBLE', 'TRIPLE', 'QUAD']

/** guideline gravity curve: seconds per row at a given level */
export function gravityMsPerRow(level: number): number {
  const lvl = Math.min(level, 20)
  const secs = Math.pow(0.8 - (lvl - 1) * 0.007, lvl - 1)
  return Math.max(secs * 1000, 0.5)
}

/**
 * Headless, deterministic Tetris engine.
 *
 * Drive it with `applyAction()` + `tick(dtMs)`. All gameplay rules live here;
 * input handling (DAS/ARR), rendering and audio live outside. An RL agent
 * uses exactly the same surface.
 */
export class Engine {
  readonly cfg: EngineConfig
  readonly board: Uint8Array
  active: ActivePiece | null = null
  hold: PieceType | null = null
  holdUsed = false
  queue: PieceType[] = []
  status: GameStatus = 'ready'

  score = 0
  lines = 0
  level: number
  combo = -1
  b2b = -1
  piecesPlaced = 0
  /** total ms of `tick` time elapsed while playing */
  elapsed = 0

  /** cheese mode: cheese lines not yet placed on the board */
  cheesePool = 0
  /** versus: incoming attacks waiting in the meter (queue → cancel → enter) */
  private pendingAttacks: number[] = []
  /** survival mode: ms until the next garbage rise */
  riseTimer = 0
  private riseInterval = 0
  private garbageRng: () => number
  private lastHole = -1

  private bag: SevenBag
  private gravityAcc = 0
  private lockTimer = 0
  private lockResets = 0
  private lowestY = -1
  private softDropping = false
  private lastMoveWasRotation = false
  private lastKickIndex = 0
  private events: GameEvent[] = []

  constructor(config: Partial<EngineConfig> & { seed: number; mode: Mode }) {
    this.cfg = { ...DEFAULT_ENGINE_CONFIG, ...config }
    this.board = new Uint8Array(BOARD_W * BOARD_H)
    this.level = this.hasLevels() ? this.cfg.startLevel : 1
    this.bag = new SevenBag(this.cfg.seed)
    this.garbageRng = createRng((this.cfg.seed ^ 0x9e3779b9) >>> 0)
    this.riseInterval = this.cfg.riseStartMs
    this.riseTimer = this.cfg.riseStartMs
    if (this.cfg.mode === 'cheese') this.cheesePool = this.cfg.cheeseTotal
    this.fillQueue()
  }

  private fillQueue() {
    while (this.queue.length < this.cfg.queueSize + 1) this.queue.push(this.bag.next())
  }

  private hasLevels(): boolean {
    return this.cfg.mode === 'marathon' || this.cfg.mode === 'blitz'
  }

  /** begin play (spawns the first piece) */
  start() {
    if (this.status !== 'ready') return
    this.status = 'playing'
    if (this.cfg.mode === 'cheese') this.refillCheese()
    this.spawn()
  }

  takeEvents(): GameEvent[] {
    const e = this.events
    this.events = []
    return e
  }

  cellAt(x: number, y: number): number {
    return this.board[y * BOARD_W + x]
  }

  applyAction(action: Action) {
    if (this.status !== 'playing') return
    switch (action) {
      case 'left':
        if (this.tryMove(-1, 0)) this.events.push({ kind: 'move' })
        break
      case 'right':
        if (this.tryMove(1, 0)) this.events.push({ kind: 'move' })
        break
      case 'cw':
        this.rotate(1)
        break
      case 'ccw':
        this.rotate(3)
        break
      case 'r180':
        this.rotate(2)
        break
      case 'softDropOn':
        this.softDropping = true
        break
      case 'softDropOff':
        this.softDropping = false
        break
      case 'hardDrop':
        this.hardDrop()
        break
      case 'hold':
        this.doHold()
        break
    }
  }

  /** advance time; dtMs should be a real frame delta (clamped by the caller) */
  tick(dtMs: number) {
    if (this.status !== 'playing' || !this.active) return
    this.elapsed += dtMs

    if (this.cfg.mode === 'survival') {
      this.riseTimer -= dtMs
      if (this.riseTimer <= 0) {
        this.riseInterval = Math.max(this.cfg.riseMinMs, this.riseInterval - this.cfg.riseDecayMs)
        this.riseTimer += this.riseInterval
        this.insertCheese(1)
        if (this.status !== 'playing') return
      }
    }

    const grounded = !this.canFit(this.active.x, this.active.y + 1, this.active.rot)
    // lesson mode: time passes (elapsed, soft drop) but exerts no pressure —
    // no gravity, no lock timer; only hardDrop/place() lock a piece
    const zeroG = this.cfg.mode === 'lesson'

    if (grounded) {
      this.gravityAcc = 0
      if (zeroG) return
      // post-cap: once all lock-delay resets are spent, the piece locks
      // immediately on touching a surface instead of running the timer
      if (this.lockResets >= this.cfg.maxLockResets) {
        this.lockPiece()
        return
      }
      this.lockTimer += dtMs
      if (this.lockTimer >= this.cfg.lockDelay) {
        this.lockPiece()
        return
      }
    } else if (this.softDropping && this.cfg.sdf >= INSTANT_SDF) {
      let dropped = 0
      while (this.tryMove(0, 1)) dropped++
      if (dropped > 0) {
        this.score += dropped
        this.events.push({ kind: 'softdrop' })
      }
    } else if (zeroG && !this.softDropping) {
      this.gravityAcc = 0
    } else {
      const msPerRow = gravityMsPerRow(this.level) / (this.softDropping ? this.cfg.sdf : 1)
      this.gravityAcc += dtMs
      while (this.gravityAcc >= msPerRow && this.active) {
        this.gravityAcc -= msPerRow
        if (this.tryMove(0, 1)) {
          if (this.softDropping) {
            this.score += 1
            this.events.push({ kind: 'softdrop' })
          }
        } else {
          this.gravityAcc = 0
          break
        }
      }
    }
  }

  // ── piece control ──────────────────────────────────────────────

  private tryMove(dx: number, dy: number): boolean {
    const p = this.active
    if (!p) return false
    if (!this.canFit(p.x + dx, p.y + dy, p.rot)) return false
    p.x += dx
    p.y += dy
    this.lastMoveWasRotation = false
    this.afterSuccessfulShift()
    return true
  }

  private rotate(turns: 1 | 2 | 3) {
    const p = this.active
    if (!p) return
    const to = ((p.rot + turns) % 4) as Rot
    const kicks = kicksFor(p.type, p.rot, to)
    for (let i = 0; i < kicks.length; i++) {
      const [kx, ky] = kicks[i]
      if (this.canFit(p.x + kx, p.y + ky, to)) {
        p.x += kx
        p.y += ky
        p.rot = to
        this.lastMoveWasRotation = true
        this.lastKickIndex = i
        this.afterSuccessfulShift()
        this.events.push({ kind: 'rotate', spin: this.detectTSpin() !== 'none' })
        return
      }
    }
  }

  /** shared bookkeeping after any successful move/rotate */
  private afterSuccessfulShift() {
    const p = this.active!
    if (p.y > this.lowestY) {
      // reached a new altitude: lock-delay resets are restored
      this.lowestY = p.y
      this.lockResets = 0
      this.lockTimer = 0
      return
    }
    const grounded = !this.canFit(p.x, p.y + 1, p.rot)
    if (grounded || this.lockTimer > 0) {
      if (this.lockResets < this.cfg.maxLockResets) {
        this.lockResets++
        this.lockTimer = 0
      }
    }
  }

  private hardDrop() {
    const p = this.active
    if (!p) return
    let dist = 0
    while (this.canFit(p.x, p.y + 1, p.rot)) {
      p.y++
      dist++
    }
    if (dist > 0) this.lastMoveWasRotation = false
    this.score += dist * 2
    this.events.push({
      kind: 'harddrop',
      distance: dist,
      cells: cellsAt(p.type, p.rot, p.x, p.y),
    })
    this.lockPiece()
  }

  private doHold() {
    if (this.holdUsed || !this.active) return
    const current = this.active.type
    const replacement = this.hold
    this.hold = current
    this.holdUsed = true
    this.events.push({ kind: 'hold' })
    if (replacement) {
      this.spawn(replacement)
    } else {
      this.spawn()
    }
  }

  ghostY(): number {
    const p = this.active
    if (!p) return 0
    let y = p.y
    while (this.canFit(p.x, y + 1, p.rot)) y++
    return y
  }

  canFit(x: number, y: number, rot: Rot): boolean {
    const p = this.active
    if (!p) return false
    return this.pieceFits(p.type, rot, x, y)
  }

  private pieceFits(type: PieceType, rot: Rot, x: number, y: number): boolean {
    return fits(this.board, type, rot, x, y)
  }

  /**
   * Plain-value copy of the decision-relevant state (bot layer L0,
   * specs/bot-core.md); null unless a piece is active.
   */
  snapshot(): Position | null {
    const p = this.active
    if (!p) return null
    return {
      board: this.board.slice(),
      piece: p.type,
      queue: this.queue.slice(0, this.cfg.queueSize),
      hold: this.hold,
      holdUsed: this.holdUsed,
    }
  }

  /**
   * FNV-1a fingerprint of the complete simulation state, private timers
   * included: two engines hash equal iff they evolve identically under the
   * same future actions and ticks. Lockstep desync detection (src/net/)
   * and replay verification stand on this.
   */
  stateHash(): number {
    let h = 0x811c9dc5
    const mix = (b: number) => {
      h = Math.imul(h ^ (b & 0xff), 0x01000193) >>> 0
    }
    const mixInt = (n: number) => {
      mix(n)
      mix(n >>> 8)
      mix(n >>> 16)
      mix(n >>> 24)
    }
    const view = new DataView(new ArrayBuffer(8))
    const mixNum = (n: number) => {
      view.setFloat64(0, n)
      mixInt(view.getUint32(0))
      mixInt(view.getUint32(4))
    }
    for (let i = 0; i < this.board.length; i++) mix(this.board[i])
    const p = this.active
    mixInt(p ? PIECE_CELL[p.type] : -1)
    mixInt(p ? p.rot : -1)
    mixInt(p ? p.x : 0)
    mixInt(p ? p.y : 0)
    mixInt(this.queue.length)
    for (const t of this.queue) mix(PIECE_CELL[t])
    mixInt(this.hold ? PIECE_CELL[this.hold] : -1)
    mix(this.holdUsed ? 1 : 0)
    for (let i = 0; i < this.status.length; i++) mix(this.status.charCodeAt(i))
    mixNum(this.score)
    mixInt(this.lines)
    mixInt(this.level)
    mixInt(this.combo)
    mixInt(this.b2b)
    mixInt(this.piecesPlaced)
    mixNum(this.elapsed)
    mixInt(this.pendingAttacks.length)
    for (const a of this.pendingAttacks) mixInt(a)
    mix(this.softDropping ? 1 : 0)
    mixNum(this.gravityAcc)
    mixNum(this.lockTimer)
    mixInt(this.lockResets)
    mixInt(this.lowestY)
    mix(this.lastMoveWasRotation ? 1 : 0)
    mixInt(this.lastKickIndex)
    mixInt(this.lastHole)
    mixInt(this.cheesePool)
    mixNum(this.riseTimer)
    mixNum(this.riseInterval)
    return h
  }

  // ── locking & clearing ─────────────────────────────────────────

  private lockPiece() {
    const p = this.active
    if (!p) return
    const cells = cellsAt(p.type, p.rot, p.x, p.y)
    const tspin = p.type === 'T' ? this.detectTSpin() : 'none'

    let allAboveVisible = true
    for (const [x, y] of cells) {
      this.board[y * BOARD_W + x] = PIECE_CELL[p.type]
      if (y >= VISIBLE_START) allAboveVisible = false
    }
    this.piecesPlaced++
    this.events.push({ kind: 'lock', cells, piece: { type: p.type, rot: p.rot, x: p.x } })

    if (allAboveVisible) {
      this.gameOver()
      return
    }

    this.active = null
    this.clearLines(tspin)
    if (this.status !== 'playing') return

    if (this.cfg.mode === 'cheese') {
      if (this.cheeseLeft() === 0) {
        this.status = 'won'
        this.events.push({ kind: 'win' })
        return
      }
      this.refillCheese()
    }

    // versus: uncancelled garbage enters once the piece is down
    this.enterPendingGarbage()
    if (this.status !== 'playing') return

    this.holdUsed = false
    this.spawn()
  }

  // ── versus garbage (queue → cancel → enter) ────────────────────

  /** queue an incoming attack; it cancels against outgoing attacks and
   *  enters the board on a future lock */
  queueGarbage(lines: number) {
    if (this.status !== 'playing' || lines <= 0) return
    this.pendingAttacks.push(lines)
  }

  /** total lines waiting in the incoming-garbage meter */
  pendingGarbage(): number {
    return this.pendingAttacks.reduce((a, b) => a + b, 0)
  }

  private enterPendingGarbage() {
    if (this.pendingAttacks.length === 0) return
    let total = 0
    for (const lines of this.pendingAttacks) {
      // one hole per attack; within it, each line moves the hole with
      // probability `messiness` ("change on attack" rule, spec Ruleset)
      let hole = Math.floor(this.garbageRng() * BOARD_W)
      for (let i = 0; i < lines; i++) {
        if (i > 0 && this.garbageRng() < this.cfg.attack.messiness) {
          hole = (hole + 1 + Math.floor(this.garbageRng() * (BOARD_W - 1))) % BOARD_W
        }
        if (!this.pushGarbageRow(hole)) {
          this.pendingAttacks = []
          this.gameOver()
          return
        }
        total++
      }
    }
    this.pendingAttacks = []
    this.events.push({ kind: 'garbage', rows: total })
  }

  /** 3-corner T-spin rule; the pure implementation lives in spin.ts */
  private detectTSpin(): 'none' | 'mini' | 'full' {
    const p = this.active
    if (!p || p.type !== 'T') return 'none'
    return tSpin3Corner(this.board, p, this.lastMoveWasRotation, this.lastKickIndex)
  }

  private clearLines(tspin: 'none' | 'mini' | 'full') {
    const rows: number[] = []
    for (let y = 0; y < BOARD_H; y++) {
      let full = true
      for (let x = 0; x < BOARD_W; x++) {
        if (this.board[y * BOARD_W + x] === 0) {
          full = false
          break
        }
      }
      if (full) rows.push(y)
    }

    const n = rows.length
    if (n === 0) {
      // any non-clearing lock breaks the combo, including a T-spin-0
      this.combo = -1
      if (tspin === 'none') return
    }

    // collapse
    for (const row of rows) {
      this.board.copyWithin(BOARD_W, 0, row * BOARD_W)
      this.board.fill(0, 0, BOARD_W)
    }

    const difficult = n === 4 || (tspin !== 'none' && n > 0)
    let points: number
    let label: string | null = null

    if (tspin === 'full') {
      points = TSPIN_POINTS[n]
      label = n === 0 ? 'T-SPIN' : `T-SPIN ${CLEAR_LABELS[n]}`
    } else if (tspin === 'mini') {
      points = TSPIN_MINI_POINTS[Math.min(n, 2)]
      label = n === 0 ? 'T-SPIN MINI' : `T-SPIN MINI ${CLEAR_LABELS[n]}`
    } else {
      points = CLEAR_POINTS[n]
      if (n === 4) label = 'QUAD'
    }

    let b2bActive = false
    if (n > 0) {
      this.combo++
      if (difficult) {
        this.b2b++
        b2bActive = this.b2b > 0
        if (b2bActive) points = Math.floor(points * B2B_MULT)
      } else {
        this.b2b = -1
      }
    }

    points *= this.level
    if (n > 0 && this.combo > 0) points += COMBO_POINTS * this.combo * this.level

    const perfectClear = n > 0 && this.board.every((c) => c === 0)
    if (perfectClear) {
      const bonus = n === 4 && b2bActive ? B2B_QUAD_PC_POINTS : PERFECT_CLEAR_POINTS[n]
      points += bonus * this.level
    }

    this.score += points
    this.lines += n

    // versus: compute the attack, cancel pending garbage first, send the rest
    const attack = attackFor(
      { lines: n, tspin, b2b: b2bActive, combo: this.combo, perfectClear },
      this.cfg.attack,
    )
    let send = attack
    while (send > 0 && this.pendingAttacks.length > 0) {
      const cancelled = Math.min(send, this.pendingAttacks[0])
      send -= cancelled
      this.pendingAttacks[0] -= cancelled
      if (this.pendingAttacks[0] === 0) this.pendingAttacks.shift()
    }
    if (send > 0) this.events.push({ kind: 'attack', lines: send })

    if (n > 0 || tspin !== 'none') {
      this.events.push({
        kind: 'clear',
        info: {
          lines: n,
          label,
          b2b: b2bActive,
          combo: this.combo,
          perfectClear,
          rows,
          points,
          attack,
        },
      })
    }

    if (this.cfg.mode === 'sprint' && this.lines >= SPRINT_GOAL) {
      this.status = 'won'
      this.events.push({ kind: 'win' })
      return
    }

    // marathon ends as a win on completing level 15 (10 lines per level)
    if (
      this.cfg.mode === 'marathon' &&
      this.lines >= (MARATHON_FINAL_LEVEL - this.cfg.startLevel + 1) * 10
    ) {
      this.level = MARATHON_FINAL_LEVEL
      this.status = 'won'
      this.events.push({ kind: 'win' })
      return
    }

    if (this.hasLevels()) {
      const newLevel = this.cfg.startLevel + Math.floor(this.lines / 10)
      if (newLevel > this.level) {
        this.level = newLevel
        this.events.push({ kind: 'levelup', level: newLevel })
      }
    }
  }

  // ── spawning / topping out ─────────────────────────────────────

  private spawn(type?: PieceType) {
    const t = type ?? this.nextFromQueue()
    const piece: ActivePiece = { type: t, rot: 0, x: spawnX(t), y: SPAWN_Y }
    this.active = piece
    this.gravityAcc = 0
    this.lockTimer = 0
    this.lockResets = 0
    this.lowestY = piece.y
    this.lastMoveWasRotation = false

    // block out: try the spawn cell, then one and two rows higher
    // (the 2-row lift is an intentional lenient divergence — D2 in docs/parity.md)
    for (let lift = 0; lift <= 2; lift++) {
      if (this.canFit(piece.x, piece.y - lift, piece.rot)) {
        piece.y -= lift
        // guideline: a freshly generated piece immediately drops one row
        // if nothing obstructs it [PDF §3.4 / tetris.wiki Tetris_Guideline]
        if (this.canFit(piece.x, piece.y + 1, piece.rot)) {
          piece.y += 1
          this.lowestY = piece.y
        }
        return
      }
    }
    this.gameOver()
  }

  private nextFromQueue(): PieceType {
    const t = this.queue.shift()!
    this.fillQueue() // no-op while a scripted queue (setQueue) is longer than the preview
    return t
  }

  private gameOver() {
    this.status = 'over'
    this.events.push({ kind: 'gameover' })
  }

  // ── training hooks ─────────────────────────────────────────────

  /**
   * Load an arbitrary board state: bottom-aligned row strings
   * (`'LLL_______'`, see board.ts) or a full flat array. Replaces the
   * whole board; lifts the active piece clear if it now overlaps.
   * Throws on malformed input — lesson authoring errors should fail loudly.
   */
  setBoard(rows: string[] | Uint8Array) {
    let next: Uint8Array
    if (rows instanceof Uint8Array) {
      if (rows.length !== BOARD_W * BOARD_H) {
        throw new Error(`board array has ${rows.length} cells (want ${BOARD_W * BOARD_H})`)
      }
      for (const v of rows) {
        if (v > CELL_GARBAGE) throw new Error(`bad cell value ${v}`)
      }
      next = rows
    } else {
      next = parseRows(rows)
    }
    this.board.set(next)
    if (this.active) this.liftActive()
  }

  /**
   * Script the upcoming pieces, replacing the current preview; the seeded
   * bag resumes once the scripted run is exhausted. Affects pieces not yet
   * spawned — call before `start()` to control the first piece.
   */
  setQueue(pieces: PieceType[]) {
    if (pieces.length === 0) throw new Error('setQueue needs at least one piece')
    this.queue = [...pieces]
    this.fillQueue()
  }

  /**
   * Apply a placement by spec: drop `type` straight down at (rot, x) and
   * lock it — the primitive for demo scripts and lesson auto-verification.
   * Uses the active piece, or pulls the type via hold when that yields it.
   * Returns false (state untouched) if the piece isn't available or the
   * placement isn't reachable by a straight drop from the board top —
   * placements that need kicks or tucks must be scripted as actions.
   */
  place(spec: { type: PieceType; rot: Rot; x: number }): boolean {
    if (this.status !== 'playing' || !this.active) return false
    let minDy = 4
    for (const [, dy] of cellsAt(spec.type, spec.rot, 0, 0)) minDy = Math.min(minDy, dy)
    let y = -minDy // topmost in-bounds position
    if (!this.pieceFits(spec.type, spec.rot, spec.x, y)) return false

    if (this.active.type !== spec.type) {
      const viaHold = !this.holdUsed && (this.hold ?? this.queue[0]) === spec.type
      if (!viaHold) return false
      this.doHold()
      if (!this.active || (this.active as ActivePiece).type !== spec.type) return false
    }

    while (this.pieceFits(spec.type, spec.rot, spec.x, y + 1)) y++
    this.active = { type: spec.type, rot: spec.rot, x: spec.x, y }
    this.lastMoveWasRotation = false
    this.lockPiece()
    return true
  }

  /**
   * Push garbage rows in from the bottom, all sharing one hole column
   * (a clean "well" — useful for scripted drills).
   */
  addGarbage(rows: number, holeColumn: number) {
    if (this.status !== 'playing' || rows <= 0) return
    const hole = Math.max(0, Math.min(BOARD_W - 1, holeColumn))
    for (let r = 0; r < rows; r++) {
      if (!this.pushGarbageRow(hole)) {
        this.gameOver()
        return
      }
    }
    this.liftActive()
    if (this.status === 'playing') this.events.push({ kind: 'garbage', rows })
  }

  /**
   * Push "cheese" rows in from the bottom: each row's hole is random
   * (seeded) and never matches the row below it, forcing real downstacking.
   */
  insertCheese(rows: number) {
    if (this.status !== 'playing' || rows <= 0) return
    for (let r = 0; r < rows; r++) {
      let hole = Math.floor(this.garbageRng() * BOARD_W)
      if (hole === this.lastHole) {
        hole = (hole + 1 + Math.floor(this.garbageRng() * (BOARD_W - 1))) % BOARD_W
      }
      this.lastHole = hole
      if (!this.pushGarbageRow(hole)) {
        this.gameOver()
        return
      }
    }
    this.liftActive()
    if (this.status === 'playing') this.events.push({ kind: 'garbage', rows })
  }

  /** garbage rows currently on the board */
  cheeseRows(): number {
    let count = 0
    for (let y = 0; y < BOARD_H; y++) {
      for (let x = 0; x < BOARD_W; x++) {
        if (this.board[y * BOARD_W + x] === CELL_GARBAGE) {
          count++
          break
        }
      }
    }
    return count
  }

  /** cheese mode: lines left to dig (on the board + still queued) */
  cheeseLeft(): number {
    return this.cheesePool + this.cheeseRows()
  }

  private refillCheese() {
    const want = Math.min(this.cfg.cheeseHeight - this.cheeseRows(), this.cheesePool)
    if (want <= 0) return
    this.insertCheese(want)
    this.cheesePool -= want
  }

  /**
   * @returns false on a push-out top-out: a block shoved above the top of
   * the buffer ends the game [tetris.wiki Top_out] instead of vanishing.
   */
  private pushGarbageRow(hole: number): boolean {
    for (let x = 0; x < BOARD_W; x++) {
      if (this.board[x] !== 0) return false
    }
    this.board.copyWithin(0, BOARD_W)
    const y = BOARD_H - 1
    for (let x = 0; x < BOARD_W; x++) {
      this.board[y * BOARD_W + x] = x === hole ? 0 : CELL_GARBAGE
    }
    return true
  }

  /** after a rise, lift the active piece out of the stack if it got buried */
  private liftActive() {
    const p = this.active
    if (!p) return
    while (!this.canFit(p.x, p.y, p.rot) && p.y > 0) p.y--
    if (!this.canFit(p.x, p.y, p.rot)) this.gameOver()
  }
}
