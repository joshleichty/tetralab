import { fits, BOARD_H, BOARD_W, CELLS, PIECE_CELL } from '../engine/pieces'
import type { LessonMachine } from '../learn/machine'
import type { Annotation, Placement, Step } from '../learn/types'
import {
  BOARD_PX_H,
  BoardRenderer,
  CELL,
  PIECE_COLORS,
  drawMino,
  emptyFx,
  rowToY,
} from './renderer'

/**
 * The lesson board: the game's exact board frame (same cell size, same
 * grid, same minos — the constant frame the cards change around) plus
 * the annotation vocabulary (learn/types.ts). Live steps delegate to
 * BoardRenderer; static steps draw the parsed board directly.
 *
 * Annotation coords are (column, rows-from-bottom); convert here, never
 * in lesson data.
 */

const TONES: Record<'good' | 'bad' | 'focus', string> = {
  good: '#72ce6e',
  bad: '#e06e73',
  focus: '#5fd4d9',
}

const fx = emptyFx()

export class LessonRenderer {
  private readonly base: BoardRenderer
  private readonly ctx: CanvasRenderingContext2D

  constructor(canvas: HTMLCanvasElement) {
    this.base = new BoardRenderer(canvas)
    this.ctx = canvas.getContext('2d')!
  }

  draw(machine: LessonMachine, now: number, showGhost: boolean) {
    const step = machine.status === 'complete' ? null : machine.current()
    if (machine.engine) {
      this.base.draw(machine.engine, fx, now, showGhost, false)
    } else {
      this.base.draw(null, fx, now, false, false)
      this.drawStatic(machine.boardView())
    }
    if (!step) return
    if ('shapes' in step && step.shapes) {
      for (const shape of step.shapes) this.drawAnnotation(shape, machine.boardView())
    }
    this.drawRecognitionState(step, machine)
  }

  /** map a canvas-space click to (column, rows-from-bottom), or null */
  cellAt(px: number, py: number): [number, number] | null {
    const x = Math.floor(px / CELL)
    const row = Math.floor(py / CELL)
    const boardRow = row + BOARD_H - BOARD_PX_H / CELL
    if (x < 0 || x >= BOARD_W || boardRow < 0 || boardRow >= BOARD_H) return null
    return [x, BOARD_H - 1 - boardRow]
  }

  private drawStatic(board: Uint8Array) {
    for (let y = 0; y < BOARD_H; y++) {
      for (let x = 0; x < BOARD_W; x++) {
        const v = board[y * BOARD_W + x]
        if (v) drawMino(this.ctx, x * CELL, rowToY(y), v)
      }
    }
  }

  private drawAnnotation(shape: Annotation, board: Uint8Array) {
    const ctx = this.ctx
    const tone = TONES[('tone' in shape ? shape.tone : undefined) ?? 'focus']
    if (shape.kind === 'cells') {
      for (const [x, y] of shape.cells) this.markCell(x, y, tone)
    } else if (shape.kind === 'column') {
      ctx.fillStyle = tone
      ctx.globalAlpha = 0.07
      ctx.fillRect(shape.column * CELL, 0, CELL, BOARD_PX_H)
      ctx.globalAlpha = 0.5
      ctx.fillRect(shape.column * CELL, BOARD_PX_H - 2, CELL, 2)
      ctx.globalAlpha = 1
    } else if (shape.kind === 'ghost') {
      this.drawGhostPlacement(shape.placement, board, tone)
    } else {
      const [fx_, fy] = shape.from
      const [tx, ty] = shape.to
      this.drawArrow(
        fx_ * CELL + CELL / 2,
        rowToY(BOARD_H - 1 - fy) + CELL / 2,
        tx * CELL + CELL / 2,
        rowToY(BOARD_H - 1 - ty) + CELL / 2,
      )
    }
  }

  private markCell(x: number, yFromBottom: number, tone: string) {
    const ctx = this.ctx
    const py = rowToY(BOARD_H - 1 - yFromBottom)
    ctx.strokeStyle = tone
    ctx.fillStyle = tone
    ctx.globalAlpha = 0.16
    ctx.beginPath()
    ctx.roundRect(x * CELL + 2, py + 2, CELL - 4, CELL - 4, 4)
    ctx.fill()
    ctx.globalAlpha = 0.85
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.roundRect(x * CELL + 2.5, py + 2.5, CELL - 5, CELL - 5, 4)
    ctx.stroke()
    ctx.globalAlpha = 1
  }

  /** outline a placement where it would come to rest — the teaching ghost */
  private drawGhostPlacement(p: Placement, board: Uint8Array, tone: string) {
    const minDy = Math.min(...CELLS[p.type][p.rot].map(([, dy]) => dy))
    let y = -minDy
    if (!fits(board, p.type, p.rot, p.x, y)) return
    while (fits(board, p.type, p.rot, p.x, y + 1)) y++
    const ctx = this.ctx
    ctx.strokeStyle = tone === TONES.focus ? PIECE_COLORS[PIECE_CELL[p.type]][0] : tone
    ctx.globalAlpha = 0.55
    ctx.lineWidth = 1.5
    ctx.setLineDash([4, 3])
    for (const [dx, dy] of CELLS[p.type][p.rot]) {
      ctx.beginPath()
      ctx.roundRect((p.x + dx) * CELL + 2.5, rowToY(y + dy) + 2.5, CELL - 5, CELL - 5, 3)
      ctx.stroke()
    }
    ctx.setLineDash([])
    ctx.globalAlpha = 1
  }

  private drawArrow(x1: number, y1: number, x2: number, y2: number) {
    const ctx = this.ctx
    ctx.strokeStyle = 'rgba(233, 231, 225, 0.6)'
    ctx.fillStyle = 'rgba(233, 231, 225, 0.6)'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(x1, y1)
    ctx.lineTo(x2, y2)
    ctx.stroke()
    const angle = Math.atan2(y2 - y1, x2 - x1)
    ctx.beginPath()
    ctx.moveTo(x2, y2)
    ctx.lineTo(x2 - 7 * Math.cos(angle - 0.45), y2 - 7 * Math.sin(angle - 0.45))
    ctx.lineTo(x2 - 7 * Math.cos(angle + 0.45), y2 - 7 * Math.sin(angle + 0.45))
    ctx.fill()
  }

  /** once a recognition step settles, show the answer on the board */
  private drawRecognitionState(step: Step, machine: LessonMachine) {
    if (step.kind !== 'recognition') return
    const phase = machine.record().phase
    if (phase !== 'solved' && phase !== 'revealed') return
    const a = step.answer
    if (a.kind === 'cell') this.markCell(a.at[0], a.at[1], TONES.good)
    else if (a.kind === 'column') {
      this.drawAnnotation({ kind: 'column', column: a.column, tone: 'good' }, machine.boardView())
    }
  }
}
