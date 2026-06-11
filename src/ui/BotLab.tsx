import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { executePlan } from '../bot/execute'
import type { FeatureName } from '../bot/features'
import { PROFILES } from '../bot/profiles'
import type { ProfileName } from '../bot/profiles'
import { suggest } from '../bot/suggest'
import type { Suggestion } from '../bot/suggest'
import { Engine } from '../engine/engine'
import { VISIBLE_START } from '../engine/pieces'
import { INSTANT_SDF } from '../engine/types'
import {
  BOARD_PX_H,
  BOARD_PX_W,
  BoardRenderer,
  CELL,
  PIECE_COLORS,
  VANISH_ROWS,
  emptyFx,
} from '../render/renderer'

/**
 * Bot Lab (#/bot) — dev surface for the intelligence layer (L0–L3).
 * Watch a profile play, step it, or override it: hover a ranked
 * suggestion to see its ghost, click to place it. Headless engine +
 * suggest() + executePlan underneath — the same path the tests prove.
 */

type LabMode = 'sprint' | 'cheese' | 'endless'

const MODES: LabMode[] = ['sprint', 'cheese', 'endless']
const TOP_K = 8

function makeEngine(seed: number, mode: LabMode): Engine {
  const e =
    mode === 'endless'
      ? new Engine({ seed, mode: 'survival', sdf: INSTANT_SDF, riseStartMs: 1e9 })
      : new Engine({ seed, mode, sdf: INSTANT_SDF })
  e.start()
  return e
}

const rowToY = (row: number) => (row - VISIBLE_START + VANISH_ROWS) * CELL

export function BotLab() {
  const [seed, setSeed] = useState(42)
  const [mode, setMode] = useState<LabMode>('endless')
  const [profileName, setProfileName] = useState<ProfileName>('versus')
  const [lookahead, setLookahead] = useState(false)
  const [pps, setPps] = useState(3)
  const [playing, setPlaying] = useState(false)
  const [hovered, setHovered] = useState<number | null>(null)
  const [version, setVersion] = useState(0)
  const [engine, setEngine] = useState(() => makeEngine(42, 'endless'))
  const [attack, setAttack] = useState(0)

  const boardCanvas = useRef<HTMLCanvasElement>(null)
  const overlayCanvas = useRef<HTMLCanvasElement>(null)
  const rendererRef = useRef<BoardRenderer | null>(null)
  const fxRef = useRef(emptyFx())

  const reset = useCallback(
    (s = seed, m = mode) => {
      setEngine(makeEngine(s, m))
      setAttack(0)
      setPlaying(false)
      setHovered(null)
      setVersion((v) => v + 1)
    },
    [seed, mode],
  )

  const suggestions = useMemo<Suggestion[]>(() => {
    void version
    if (engine.status !== 'playing') return []
    const pos = engine.snapshot()
    if (!pos) return []
    return suggest(pos, PROFILES[profileName], {
      context: { b2b: engine.b2b >= 0, combo: engine.combo },
      lookahead: lookahead ? 1 : undefined,
    })
  }, [engine, version, profileName, lookahead])

  const step = useCallback(
    (pick?: Suggestion) => {
      if (engine.status !== 'playing') {
        setPlaying(false)
        return
      }
      const pos = engine.snapshot()
      if (!pos) return
      const top =
        pick ??
        suggest(pos, PROFILES[profileName], {
          context: { b2b: engine.b2b >= 0, combo: engine.combo },
          lookahead: lookahead ? 1 : undefined,
        })[0]
      if (!top) return
      executePlan(engine, top.plan)
      let sent = 0
      for (const ev of engine.takeEvents()) {
        if (ev.kind === 'clear') sent += ev.info.attack
      }
      if (sent > 0) setAttack((a) => a + sent)
      setHovered(null)
      setVersion((v) => v + 1)
    },
    [engine, profileName, lookahead],
  )

  // auto-play
  useEffect(() => {
    if (!playing) return
    const id = setInterval(() => step(), 1000 / pps)
    return () => clearInterval(id)
  }, [playing, pps, step])

  // board canvas
  useEffect(() => {
    if (!boardCanvas.current) return
    if (!rendererRef.current) rendererRef.current = new BoardRenderer(boardCanvas.current)
    rendererRef.current.draw(engine, fxRef.current, performance.now(), false, false)
  }, [engine, version])

  // candidate ghosts
  useEffect(() => {
    const canvas = overlayCanvas.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    if (canvas.width !== BOARD_PX_W * dpr) {
      canvas.width = BOARD_PX_W * dpr
      canvas.height = BOARD_PX_H * dpr
      canvas.style.width = `${BOARD_PX_W}px`
      canvas.style.height = `${BOARD_PX_H}px`
      canvas.getContext('2d')!.scale(dpr, dpr)
    }
    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, BOARD_PX_W, BOARD_PX_H)
    suggestions.slice(0, TOP_K).forEach((s, i) => {
      const isHover = hovered === i
      const isBest = i === 0
      if (hovered !== null && !isHover) return // hovering isolates one ghost
      const [base] = PIECE_COLORS[3] // ghost chrome reads better in one hue
      ctx.strokeStyle = isBest || isHover ? 'rgba(95, 212, 217, 0.95)' : base
      ctx.globalAlpha = isHover ? 1 : isBest ? 0.85 : 0.18
      ctx.lineWidth = isHover || isBest ? 2 : 1.25
      for (const [x, y] of s.placement.cells) {
        const py = rowToY(y)
        if (py < 0) continue
        ctx.beginPath()
        ctx.roundRect(x * CELL + 2.5, py + 2.5, CELL - 5, CELL - 5, 3)
        ctx.stroke()
        if (isHover) {
          ctx.fillStyle = 'rgba(95, 212, 217, 0.18)'
          ctx.fill()
        }
      }
      ctx.globalAlpha = 1
    })
  }, [suggestions, hovered, version])

  const e = engine
  const pos = e.status === 'playing' ? e.snapshot() : null
  const app = e.piecesPlaced > 0 ? (attack / e.piecesPlaced).toFixed(3) : '0.000'

  return (
    <div className="app botlab">
      <span className="corner-mark" aria-hidden>
        tetra · bot lab
      </span>
      <main className="botlab-stage">
        <aside className="botlab-controls">
          <h1>bot lab</h1>
          <label>
            profile
            <select
              value={profileName}
              onChange={(ev) => {
                setProfileName(ev.target.value as ProfileName)
                setVersion((v) => v + 1)
              }}
            >
              {Object.keys(PROFILES).map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </label>
          <label>
            mode
            <select
              value={mode}
              onChange={(ev) => {
                const m = ev.target.value as LabMode
                setMode(m)
                reset(seed, m)
              }}
            >
              {MODES.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </label>
          <label>
            seed
            <input
              type="number"
              value={seed}
              onChange={(ev) => setSeed(Number(ev.target.value))}
            />
          </label>
          <label className="botlab-check">
            <input
              type="checkbox"
              checked={lookahead}
              onChange={(ev) => {
                setLookahead(ev.target.checked)
                setVersion((v) => v + 1)
              }}
            />
            lookahead 1
          </label>
          <label>
            {pps} pps
            <input
              type="range"
              min={1}
              max={15}
              value={pps}
              onChange={(ev) => setPps(Number(ev.target.value))}
            />
          </label>
          <div className="botlab-buttons">
            <button onClick={() => setPlaying((p) => !p)} disabled={e.status !== 'playing'}>
              {playing ? 'pause' : 'play'}
            </button>
            <button onClick={() => step()} disabled={e.status !== 'playing' || playing}>
              step
            </button>
            <button onClick={() => reset()}>reset</button>
          </div>
          <div className="botlab-stats">
            <div>
              pieces <b>{e.piecesPlaced}</b> · lines <b>{e.lines}</b>
            </div>
            <div>
              attack <b>{attack}</b> · app <b>{app}</b>
            </div>
            <div>
              b2b <b>{e.b2b >= 0 ? `×${e.b2b + 1}` : '—'}</b> · combo{' '}
              <b>{e.combo >= 0 ? e.combo : '—'}</b>
            </div>
            {pos && (
              <div>
                hold <b>{pos.hold ?? '—'}</b> · next <b>{pos.queue.join(' ')}</b>
              </div>
            )}
            {e.status !== 'playing' && <div className="botlab-end">{e.status}</div>}
          </div>
          <a className="botlab-back" href="#" onClick={() => window.location.reload()}>
            ← back to tetra
          </a>
        </aside>

        <div className="field-frame botlab-field">
          <canvas ref={boardCanvas} />
          <canvas ref={overlayCanvas} className="botlab-overlay" />
        </div>

        <aside className="botlab-panel">
          <h2>
            {suggestions.length} placements · top {Math.min(TOP_K, suggestions.length)}
          </h2>
          {suggestions.slice(0, TOP_K).map((s, i) => {
            const p = s.placement
            const tags = [
              p.spin !== 'none' ? p.spin : null,
              p.usedHold ? 'hold' : null,
              p.hardDropOnly ? null : 'sd',
            ]
              .filter(Boolean)
              .join(' ')
            const why = (Object.entries(s.contributions) as Array<[FeatureName, number]>)
              .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
              .slice(0, 3)
            return (
              <button
                key={i}
                className={`botlab-cand${i === 0 ? ' best' : ''}${hovered === i ? ' hover' : ''}`}
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}
                onClick={() => step(s)}
                disabled={e.status !== 'playing'}
              >
                <span className="botlab-cand-head">
                  <span>
                    {p.type} rot{p.rot} x{p.x}
                    {tags && <em> {tags}</em>}
                  </span>
                  <b>{s.score.toFixed(1)}</b>
                </span>
                <span className="botlab-cand-why">
                  {why.map(([n, c]) => (
                    <span key={n} className={c >= 0 ? 'pos' : 'neg'}>
                      {n} {c >= 0 ? '+' : ''}
                      {c.toFixed(1)}
                    </span>
                  ))}
                </span>
              </button>
            )
          })}
          {suggestions.length === 0 && e.status === 'playing' && <p>no placements</p>}
        </aside>
      </main>
    </div>
  )
}
