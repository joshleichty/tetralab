import { useEffect, useRef } from 'react'
import type { GameController } from '../game/controller'
import { formatTime } from '../game/useGame'
import { BOARD_PX_W, BOARD_PX_H } from '../render/renderer'

const HOLD_W = 96
const HOLD_H = 64
const QUEUE_W = 96
const QUEUE_H = 64 * 5

export function BoardCanvas({ ctrl }: { ctrl: GameController }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    ctrl.attachBoard(ref.current)
    return () => ctrl.attachBoard(null)
  }, [ctrl])
  return (
    <canvas
      ref={ref}
      className="board-canvas"
      width={BOARD_PX_W}
      height={BOARD_PX_H}
      aria-label="playfield"
    />
  )
}

export function HoldBox({ ctrl }: { ctrl: GameController }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    ctrl.attachHold(ref.current, HOLD_W, HOLD_H)
    return () => ctrl.attachHold(null, 0, 0)
  }, [ctrl])
  return (
    <div className="panel hold-panel">
      <span className="panel-label">hold</span>
      <canvas ref={ref} />
    </div>
  )
}

export function QueueBox({ ctrl }: { ctrl: GameController }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    ctrl.attachQueue(ref.current, QUEUE_W, QUEUE_H)
    return () => ctrl.attachQueue(null, 0, 0)
  }, [ctrl])
  return (
    <div className="panel queue-panel">
      <span className="panel-label">next</span>
      <canvas ref={ref} />
    </div>
  )
}

function Stat({ label, value, big }: { label: string; value: string; big?: boolean }) {
  return (
    <div className={`stat${big ? ' stat-big' : ''}`}>
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
    </div>
  )
}

export function StatsPanel({ ctrl }: { ctrl: GameController }) {
  const e = ctrl.engine
  if (!e) return null
  const time = e.elapsed
  const pps = time > 0 ? (e.piecesPlaced / (time / 1000)).toFixed(2) : '0.00'

  if (ctrl.mode === 'sprint') {
    return (
      <div className="stats">
        <Stat label="time" value={formatTime(time)} big />
        <Stat label="lines" value={`${e.lines} / 40`} />
        <Stat label="pps" value={pps} />
      </div>
    )
  }
  if (ctrl.mode === 'cheese') {
    return (
      <div className="stats">
        <Stat label="time" value={formatTime(time)} big />
        <Stat label="cheese left" value={`${e.cheeseLeft()} / ${ctrl.cheeseTotal}`} />
        <Stat label="lines" value={String(e.lines)} />
        <Stat label="pps" value={pps} />
      </div>
    )
  }
  if (ctrl.mode === 'survival') {
    const nextRise = Math.max(0, e.riseTimer) / 1000
    return (
      <div className="stats">
        <Stat label="time" value={formatTime(time)} big />
        <Stat label="next rise" value={`${nextRise.toFixed(1)}s`} />
        <Stat label="lines" value={String(e.lines)} />
        <Stat label="pps" value={pps} />
      </div>
    )
  }
  if (ctrl.mode === 'blitz') {
    const remaining = Math.max(0, 120_000 - time)
    return (
      <div className="stats">
        <Stat label="time" value={formatTime(remaining)} big />
        <Stat label="score" value={e.score.toLocaleString()} />
        <Stat label="lines" value={String(e.lines)} />
        <Stat label="pps" value={pps} />
      </div>
    )
  }
  return (
    <div className="stats">
      <Stat label="score" value={e.score.toLocaleString()} big />
      <Stat label="level" value={String(e.level)} />
      <Stat label="lines" value={String(e.lines)} />
      <Stat label="time" value={formatTime(time)} />
      <Stat label="pps" value={pps} />
    </div>
  )
}

/** transient "T-SPIN DOUBLE / BACK-TO-BACK" caption beside the field */
export function ActionCaption({ ctrl }: { ctrl: GameController }) {
  const label = ctrl.actionLabel
  if (!label) return <div className="action-caption" />
  return (
    <div className="action-caption" key={label.id}>
      <span className="action-main">{label.text}</span>
      {label.sub.map((s) => (
        <span className="action-sub" key={s}>
          {s}
        </span>
      ))}
    </div>
  )
}
