import { useEffect, useRef, useState } from 'react'
import type { GameController } from '../game/controller'
import { formatTime } from '../game/useGame'
import { BOARD_PX_H, BOARD_PX_W } from '../render/renderer'
import { ActionCaption, BoardCanvas, GarbageMeter, HoldBox, QueueBox } from './Hud'
import { Countdown } from './Overlays'

/**
 * Online 1v1 (spec Phase 4) — every screen between the menu and the
 * lockstep match: nickname/create/join, the invite link, connecting,
 * the duel stage with the simulated opponent board, end states and the
 * rematch loop. Connection truth lives in ctrl.online / ctrl.room; this
 * file only renders it.
 */

export function OnlineScreen({
  ctrl,
  initialCode,
  onExit,
}: {
  ctrl: GameController
  initialCode: string | null
  onExit: () => void
}) {
  const online = ctrl.online
  const leave = () => {
    ctrl.leaveOnline()
    onExit()
  }
  if (!online) return <OnlineEntry ctrl={ctrl} initialCode={initialCode} onBack={onExit} />

  const phase = online.phase
  switch (phase.t) {
    case 'idle':
    case 'creating':
    case 'joining':
      return <OnlineStatus label={phase.t === 'joining' ? 'joining…' : 'creating room…'} onCancel={leave} />
    case 'waiting':
      return <OnlineWaiting room={phase.room} onCancel={leave} />
    case 'connecting':
      return <OnlineStatus label={`connecting to ${phase.hostName}…`} onCancel={leave} />
    case 'error':
      return <OnlineStatus label={phase.message} error onCancel={leave} />
    case 'room':
      return <OnlineStage ctrl={ctrl} onLeave={leave} />
  }
}

// ── pre-connection screens ───────────────────────────────────────

function OnlineEntry({
  ctrl,
  initialCode,
  onBack,
}: {
  ctrl: GameController
  initialCode: string | null
  onBack: () => void
}) {
  const [name, setName] = useState(ctrl.settings.nickname)
  const [code, setCode] = useState(initialCode ?? '')
  const joining = initialCode !== null
  const commitName = () => {
    const clean = name.trim().slice(0, 24)
    if (clean !== ctrl.settings.nickname) ctrl.updateSettings({ nickname: clean })
    return clean
  }
  const host = () => {
    commitName()
    ctrl.startOnlineHost()
  }
  const join = () => {
    if (!code.trim()) return
    commitName()
    ctrl.startOnlineJoin(code)
  }

  return (
    <div className="overlay menu online-entry">
      <header className="menu-brand">
        <h1 className="wordmark">1v1</h1>
        <p className="tagline">{joining ? 'you were invited' : 'invite a friend · no accounts'}</p>
      </header>

      <div className="online-form">
        <label className="online-field">
          <span className="panel-label">your name</span>
          <input
            className="online-input"
            value={name}
            maxLength={24}
            placeholder="anonymous"
            onChange={(e) => setName(e.target.value)}
            autoFocus={joining && !name}
          />
        </label>

        {joining ? (
          <button className="solid-btn" onClick={join}>
            join room {code}
          </button>
        ) : (
          <>
            <button className="solid-btn" onClick={host}>
              create a room
            </button>
            <div className="online-join-row">
              <input
                className="online-input online-code"
                value={code}
                maxLength={6}
                placeholder="room code"
                onChange={(e) => setCode(e.target.value.toLowerCase())}
                onKeyDown={(e) => e.key === 'Enter' && join()}
              />
              <button className="ghost-btn" onClick={join} disabled={!code.trim()}>
                join
              </button>
            </div>
          </>
        )}
      </div>

      <footer className="menu-footer">
        <button className="ghost-btn" onClick={onBack}>
          back
        </button>
        <span className="hint">gameplay is peer-to-peer · the link only brokers the handshake</span>
      </footer>
    </div>
  )
}

function OnlineStatus({
  label,
  error,
  onCancel,
}: {
  label: string
  error?: boolean
  onCancel: () => void
}) {
  return (
    <div className="overlay menu online-entry">
      <span className={`overlay-title${error ? '' : ' online-pulse'}`}>{label}</span>
      <div className="overlay-actions">
        <button className="ghost-btn" onClick={onCancel}>
          {error ? 'back' : 'cancel'}
        </button>
      </div>
    </div>
  )
}

function OnlineWaiting({ room, onCancel }: { room: string; onCancel: () => void }) {
  const link = `${location.origin}${location.pathname}#/vs/${room}`
  const [copied, setCopied] = useState(false)
  const copy = () => {
    void navigator.clipboard?.writeText(link).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    })
  }
  return (
    <div className="overlay menu online-entry">
      <span className="panel-label">room</span>
      <span className="room-code">{room}</span>
      <span className="overlay-subtitle online-pulse">waiting for a challenger…</span>
      <div className="overlay-actions">
        <button className="solid-btn" onClick={copy}>
          {copied ? 'copied' : 'copy invite link'}
        </button>
        <button className="ghost-btn" onClick={onCancel}>
          cancel
        </button>
      </div>
      <span className="hint">{link}</span>
    </div>
  )
}

// ── the duel stage ───────────────────────────────────────────────

function OnlineStage({ ctrl, onLeave }: { ctrl: GameController; onLeave: () => void }) {
  const room = ctrl.room
  if (!room) return null
  const session = room.session

  return (
    <main className="stage">
      <aside className="side side-left">
        <HoldBox ctrl={ctrl} />
        <ActionCaption ctrl={ctrl} />
        <OnlineStats ctrl={ctrl} />
      </aside>

      <div className="field-frame">
        <GarbageMeter ctrl={ctrl} />
        <BoardCanvas ctrl={ctrl} />
        {ctrl.onlineStalled && room.state === 'playing' && (
          <span className="stall-pill online-pulse">connection…</span>
        )}
        {(room.state === 'countdown' || room.state === 'lobby') && <Countdown ctrl={ctrl} />}
        {room.state === 'ended' && session && <OnlineResults ctrl={ctrl} onLeave={onLeave} />}
        {room.state === 'closed' && <OnlineClosed ctrl={ctrl} onLeave={onLeave} />}
        {ctrl.onlineLeavePrompt && room.state === 'playing' && (
          <div className="overlay dim">
            <span className="overlay-title">leave the match?</span>
            <div className="overlay-actions">
              <button className="solid-btn" onClick={() => ctrl.togglePause()}>
                keep playing
              </button>
              <button className="ghost-btn" onClick={onLeave}>
                leave
              </button>
            </div>
          </div>
        )}
      </div>

      <aside className="side side-right">
        <QueueBox ctrl={ctrl} />
        <RemoteBoard ctrl={ctrl} />
      </aside>
    </main>
  )
}

function OnlineStats({ ctrl }: { ctrl: GameController }) {
  const e = ctrl.engine
  if (!e) return null
  const time = e.elapsed
  const pps = time > 0 ? (e.piecesPlaced / (time / 1000)).toFixed(2) : '0.00'
  const apm = time > 0 ? (ctrl.attackSent / (time / 60_000)).toFixed(1) : '0.0'
  return (
    <div className="stats">
      <div className="stat stat-big">
        <span className="stat-label">time</span>
        <span className="stat-value">{formatTime(time)}</span>
      </div>
      <div className="stat">
        <span className="stat-label">apm</span>
        <span className="stat-value">{apm}</span>
      </div>
      <div className="stat">
        <span className="stat-label">attack</span>
        <span className="stat-value">{String(ctrl.attackSent)}</span>
      </div>
      <div className="stat">
        <span className="stat-label">pps</span>
        <span className="stat-value">{pps}</span>
      </div>
    </div>
  )
}

/** the simulated opponent board — quiet, half scale, state only */
function RemoteBoard({ ctrl }: { ctrl: GameController }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    ctrl.attachRemoteBoard(ref.current)
    return () => ctrl.attachRemoteBoard(null)
  }, [ctrl])
  const room = ctrl.room
  const pending = room?.session?.remoteEngine.pendingGarbage() ?? 0
  return (
    <div className="panel remote-panel">
      <span className="panel-label">{room?.peerName ?? 'opponent'}</span>
      <canvas
        ref={ref}
        className="remote-canvas"
        width={BOARD_PX_W}
        height={BOARD_PX_H}
        aria-label="opponent playfield"
      />
      <span className="remote-pending">{pending > 0 ? `${pending} incoming` : ' '}</span>
    </div>
  )
}

// ── end states ───────────────────────────────────────────────────

function OnlineResults({ ctrl, onLeave }: { ctrl: GameController; onLeave: () => void }) {
  const room = ctrl.room!
  const session = room.session!
  const r = ctrl.result
  const title =
    session.status === 'won'
      ? 'victory'
      : session.status === 'lost'
        ? 'defeat'
        : session.status === 'draw'
          ? 'draw'
          : 'desync'
  const subtitle =
    session.status === 'desynced'
      ? 'the simulations diverged — this match cannot continue'
      : `versus ${room.peerName ?? 'opponent'}`
  const canRematch =
    session.status !== 'desynced' && !room.peerLeft && !room.peerDisconnected

  return (
    <div className="overlay dim results">
      <span className="overlay-title">{title}</span>
      <span className="overlay-subtitle">{subtitle}</span>

      {r && (
        <dl className="result-grid">
          <div>
            <dt>time</dt>
            <dd>{formatTime(r.timeMs)}</dd>
          </div>
          <div>
            <dt>attack</dt>
            <dd>{r.attack}</dd>
          </div>
          <div>
            <dt>apm</dt>
            <dd>{r.timeMs > 0 ? ((r.attack ?? 0) / (r.timeMs / 60_000)).toFixed(1) : '0.0'}</dd>
          </div>
          <div>
            <dt>pps</dt>
            <dd>{r.pps.toFixed(2)}</dd>
          </div>
          <div>
            <dt>lines</dt>
            <dd>{r.lines}</dd>
          </div>
          <div>
            <dt>inputs</dt>
            <dd>{r.detail.inputs}</dd>
          </div>
          <div>
            <dt>kpp</dt>
            <dd>{r.detail.kpp.toFixed(2)}</dd>
          </div>
          <div>
            <dt>finesse faults</dt>
            <dd>{r.detail.finesseFaults}</dd>
          </div>
        </dl>
      )}

      <div className="overlay-actions">
        {canRematch && (
          <button className="solid-btn" onClick={() => ctrl.onlineRematch()}>
            {room.rematchRequested ? 'waiting…' : 'rematch'}
          </button>
        )}
        <button className="ghost-btn" onClick={onLeave}>
          leave
        </button>
      </div>
      {room.rematchOffered && !room.rematchRequested && (
        <span className="hint">{room.peerName ?? 'opponent'} wants a rematch</span>
      )}
      {room.peerLeft && <span className="hint">{room.peerName ?? 'opponent'} left the room</span>}
    </div>
  )
}

function OnlineClosed({ ctrl, onLeave }: { ctrl: GameController; onLeave: () => void }) {
  const room = ctrl.room!
  const reason = room.versionClash
    ? 'your clients run different versions'
    : room.peerLeft
      ? `${room.peerName ?? 'opponent'} left the room`
      : 'connection lost'
  return (
    <div className="overlay dim">
      <span className="overlay-title">room closed</span>
      <span className="overlay-subtitle">{reason}</span>
      <div className="overlay-actions">
        <button className="solid-btn" onClick={onLeave}>
          back to menu
        </button>
      </div>
    </div>
  )
}
