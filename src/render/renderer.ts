import type { Engine } from '../engine/engine'
import type { PieceType } from '../engine/types'
import { CELLS, BOARD_W, BOARD_H, VISIBLE_START } from '../engine/pieces'

export const CELL = 30
/** hidden rows shown faintly above the field so spawns/top-outs read clearly */
export const VANISH_ROWS = 2
export const BOARD_PX_W = BOARD_W * CELL
export const BOARD_PX_H = (BOARD_H - VISIBLE_START + VANISH_ROWS) * CELL

/** muted-neon mino palette: [base, dim] */
export const PIECE_COLORS: Record<number, [string, string]> = {
  1: ['#5fd4d9', '#37888c'], // I
  2: ['#e0c060', '#8f7a3a'], // O
  3: ['#b87fdd', '#74508d'], // T
  4: ['#72ce6e', '#478045'], // S
  5: ['#e06e73', '#8d4548'], // Z
  6: ['#6e8fdd', '#455a8d'], // J
  7: ['#e0985f', '#8d603a'], // L
  8: ['#4a4d55', '#33353b'], // garbage
}

export interface BoardFx {
  clears: Array<{ rows: number[]; flash: boolean; t: number }>
  drops: Array<{ cells: Array<[number, number]>; distance: number; t: number }>
  locks: Array<{ cells: Array<[number, number]>; t: number }>
  shakeT: number
}

export function emptyFx(): BoardFx {
  return { clears: [], drops: [], locks: [], shakeT: -1e9 }
}

const CLEAR_FX_MS = 180
const DROP_FX_MS = 110
const LOCK_FX_MS = 90
const SHAKE_MS = 90

function rowToY(row: number): number {
  return (row - VISIBLE_START + VANISH_ROWS) * CELL
}

function drawMino(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  cellValue: number,
  alpha = 1,
  size = CELL,
) {
  const [base, dim] = PIECE_COLORS[cellValue] ?? PIECE_COLORS[8]
  const inset = Math.max(1, size * 0.04)
  const s = size - inset * 2
  ctx.globalAlpha = alpha
  ctx.fillStyle = dim
  ctx.beginPath()
  ctx.roundRect(px + inset, py + inset, s, s, size * 0.12)
  ctx.fill()
  ctx.fillStyle = base
  ctx.beginPath()
  ctx.roundRect(px + inset, py + inset, s, s - Math.max(2, size * 0.12), size * 0.12)
  ctx.fill()
  ctx.globalAlpha = 1
}

export class BoardRenderer {
  private ctx: CanvasRenderingContext2D

  constructor(canvas: HTMLCanvasElement) {
    const dpr = window.devicePixelRatio || 1
    canvas.width = BOARD_PX_W * dpr
    canvas.height = BOARD_PX_H * dpr
    canvas.style.width = `${BOARD_PX_W}px`
    canvas.style.height = `${BOARD_PX_H}px`
    this.ctx = canvas.getContext('2d')!
    this.ctx.scale(dpr, dpr)
  }

  draw(engine: Engine | null, fx: BoardFx, now: number, showGhost: boolean, vfx: boolean) {
    const ctx = this.ctx
    ctx.clearRect(0, 0, BOARD_PX_W, BOARD_PX_H)

    // subtle shake on hard drop
    ctx.save()
    if (vfx) {
      const sh = (now - fx.shakeT) / SHAKE_MS
      if (sh >= 0 && sh < 1) {
        ctx.translate(0, 2.5 * (1 - sh))
      }
    }

    this.drawGrid(ctx)
    if (engine) {
      this.drawStack(ctx, engine)
      if (engine.active && engine.status === 'playing') {
        if (showGhost) this.drawGhost(ctx, engine)
        this.drawActive(ctx, engine)
      }
      if (vfx) this.drawFx(ctx, fx, now)
    }
    ctx.restore()
  }

  private drawGrid(ctx: CanvasRenderingContext2D) {
    const top = VANISH_ROWS * CELL
    ctx.strokeStyle = 'rgba(235, 235, 245, 0.045)'
    ctx.lineWidth = 1
    ctx.beginPath()
    for (let x = 1; x < BOARD_W; x++) {
      ctx.moveTo(x * CELL + 0.5, top)
      ctx.lineTo(x * CELL + 0.5, BOARD_PX_H)
    }
    for (let y = 1; y <= BOARD_H - VISIBLE_START; y++) {
      ctx.moveTo(0, top + y * CELL - 0.5)
      ctx.lineTo(BOARD_PX_W, top + y * CELL - 0.5)
    }
    ctx.stroke()
    // hairline marking the top of the visible field
    ctx.strokeStyle = 'rgba(235, 235, 245, 0.1)'
    ctx.beginPath()
    ctx.moveTo(0, top + 0.5)
    ctx.lineTo(BOARD_PX_W, top + 0.5)
    ctx.stroke()
  }

  private drawStack(ctx: CanvasRenderingContext2D, engine: Engine) {
    const over = engine.status === 'over'
    for (let y = VISIBLE_START - VANISH_ROWS; y < BOARD_H; y++) {
      for (let x = 0; x < BOARD_W; x++) {
        const v = engine.board[y * BOARD_W + x]
        if (!v) continue
        const faded = y < VISIBLE_START ? 0.45 : 1
        drawMino(ctx, x * CELL, rowToY(y), over ? 8 : v, faded)
      }
    }
  }

  private drawGhost(ctx: CanvasRenderingContext2D, engine: Engine) {
    const p = engine.active!
    const gy = engine.ghostY()
    if (gy === p.y) return
    const [base] = PIECE_COLORS[pieceCell(p.type)]
    ctx.strokeStyle = base
    ctx.globalAlpha = 0.32
    ctx.lineWidth = 1.5
    for (const [dx, dy] of CELLS[p.type][p.rot]) {
      const px = (p.x + dx) * CELL
      const py = rowToY(gy + dy)
      ctx.beginPath()
      ctx.roundRect(px + 2.5, py + 2.5, CELL - 5, CELL - 5, 3)
      ctx.stroke()
    }
    ctx.globalAlpha = 1
  }

  private drawActive(ctx: CanvasRenderingContext2D, engine: Engine) {
    const p = engine.active!
    const [base] = PIECE_COLORS[pieceCell(p.type)]
    ctx.save()
    ctx.shadowColor = base
    ctx.shadowBlur = 14
    for (const [dx, dy] of CELLS[p.type][p.rot]) {
      const y = p.y + dy
      const alpha = y < VISIBLE_START - VANISH_ROWS ? 0 : y < VISIBLE_START ? 0.6 : 1
      if (alpha > 0) drawMino(ctx, (p.x + dx) * CELL, rowToY(y), pieceCell(p.type), alpha)
    }
    ctx.restore()
  }

  private drawFx(ctx: CanvasRenderingContext2D, fx: BoardFx, now: number) {
    fx.drops = fx.drops.filter((d) => now - d.t < DROP_FX_MS)
    for (const d of fx.drops) {
      const k = 1 - (now - d.t) / DROP_FX_MS
      const cols = new Map<number, number>()
      for (const [x, y] of d.cells) {
        cols.set(x, Math.min(cols.get(x) ?? Infinity, y))
      }
      for (const [x, yTop] of cols) {
        const h = Math.min(d.distance, 12) * CELL
        const py = rowToY(yTop)
        const grad = ctx.createLinearGradient(0, py - h, 0, py)
        grad.addColorStop(0, 'rgba(235,235,245,0)')
        grad.addColorStop(1, `rgba(235,235,245,${0.14 * k})`)
        ctx.fillStyle = grad
        ctx.fillRect(x * CELL + 1, py - h, CELL - 2, h)
      }
    }

    fx.locks = fx.locks.filter((l) => now - l.t < LOCK_FX_MS)
    for (const l of fx.locks) {
      const k = 1 - (now - l.t) / LOCK_FX_MS
      ctx.fillStyle = `rgba(245,245,250,${0.22 * k})`
      for (const [x, y] of l.cells) {
        if (y < VISIBLE_START - VANISH_ROWS) continue
        ctx.beginPath()
        ctx.roundRect(x * CELL + 1, rowToY(y) + 1, CELL - 2, CELL - 2, 3)
        ctx.fill()
      }
    }

    fx.clears = fx.clears.filter((c) => now - c.t < CLEAR_FX_MS)
    for (const c of fx.clears) {
      const k = 1 - (now - c.t) / CLEAR_FX_MS
      for (const row of c.rows) {
        const py = rowToY(row)
        ctx.fillStyle = `rgba(245,245,250,${(c.flash ? 0.4 : 0.26) * k * k})`
        ctx.fillRect(0, py, BOARD_PX_W, CELL)
      }
    }
  }
}

function pieceCell(t: PieceType): number {
  return { I: 1, O: 2, T: 3, S: 4, Z: 5, J: 6, L: 7 }[t]
}

/** renders a single piece centered in a small preview canvas */
export class PreviewRenderer {
  private ctx: CanvasRenderingContext2D
  private w: number
  private h: number

  constructor(canvas: HTMLCanvasElement, w: number, h: number) {
    const dpr = window.devicePixelRatio || 1
    canvas.width = w * dpr
    canvas.height = h * dpr
    canvas.style.width = `${w}px`
    canvas.style.height = `${h}px`
    this.ctx = canvas.getContext('2d')!
    this.ctx.scale(dpr, dpr)
    this.w = w
    this.h = h
  }

  draw(pieces: Array<PieceType | null>, opts: { dimFirst?: boolean; cell?: number } = {}) {
    const ctx = this.ctx
    ctx.clearRect(0, 0, this.w, this.h)
    const cell = opts.cell ?? 15
    const slotH = this.h / pieces.length
    pieces.forEach((type, i) => {
      if (!type) return
      const cells = CELLS[type][0]
      const xs = cells.map(([x]) => x)
      const ys = cells.map(([, y]) => y)
      const pw = (Math.max(...xs) - Math.min(...xs) + 1) * cell
      const ph = (Math.max(...ys) - Math.min(...ys) + 1) * cell
      const ox = (this.w - pw) / 2 - Math.min(...xs) * cell
      const oy = i * slotH + (slotH - ph) / 2 - Math.min(...ys) * cell
      const alpha = opts.dimFirst && i === 0 ? 0.3 : 1
      for (const [dx, dy] of cells) {
        drawMino(ctx, ox + dx * cell, oy + dy * cell, pieceCell(type), alpha, cell)
      }
    })
  }
}
