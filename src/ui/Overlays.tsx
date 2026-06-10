import { useState } from 'react'
import type { GameController } from '../game/controller'
import type { Mode } from '../engine/types'
import type { BestRecords } from '../game/settings'
import { formatTime } from '../game/useGame'

const MODES: Array<{ mode: Mode; name: string; desc: string }> = [
  { mode: 'marathon', name: 'marathon', desc: '150 lines · gravity rises every 10' },
  { mode: 'sprint', name: '40 lines', desc: 'clear 40 lines as fast as you can' },
  { mode: 'blitz', name: 'blitz', desc: 'two minutes · highest score wins' },
]

const CHEESE_GOALS = [10, 18, 100] as const

export function Menu({
  ctrl,
  onOpenSettings,
}: {
  ctrl: GameController
  onOpenSettings: () => void
}) {
  const [cheeseGoal, setCheeseGoal] = useState(ctrl.cheeseTotal)
  const best = ctrl.best
  const bestFor = (mode: Mode) => {
    if (mode === 'sprint') return best.sprint !== undefined ? formatTime(best.sprint) : null
    const score = mode === 'blitz' ? best.blitz : best.marathon
    return score !== undefined ? score.toLocaleString() : null
  }
  const cheeseBest = best[`cheese${cheeseGoal}` as keyof BestRecords]

  return (
    <div className="overlay menu">
      <header className="menu-brand">
        <h1 className="wordmark">tetra</h1>
        <p className="tagline">a minimal tetris</p>
      </header>

      <nav className="mode-list">
        {MODES.map(({ mode, name, desc }, i) => (
          <button
            key={mode}
            className="mode-row"
            style={{ animationDelay: `${120 + i * 70}ms` }}
            onClick={() => ctrl.start(mode)}
          >
            <span className="mode-name">{name}</span>
            <span className="mode-desc">{desc}</span>
            <span className="mode-best">{bestFor(mode) ?? '—'}</span>
          </button>
        ))}

        <span className="mode-group" style={{ animationDelay: '330ms' }}>
          training
        </span>

        <button
          className="mode-row"
          style={{ animationDelay: '400ms' }}
          onClick={() => ctrl.start('cheese', { cheeseTotal: cheeseGoal })}
        >
          <span className="mode-name">cheese</span>
          <span className="mode-desc">
            dig through{' '}
            <span className="goal-chips" onClick={(e) => e.stopPropagation()}>
              {CHEESE_GOALS.map((g) => (
                <span
                  key={g}
                  role="button"
                  tabIndex={0}
                  className={`goal-chip${cheeseGoal === g ? ' active' : ''}`}
                  onClick={() => setCheeseGoal(g)}
                  onKeyDown={(e) => e.key === 'Enter' && setCheeseGoal(g)}
                >
                  {g}
                </span>
              ))}
            </span>{' '}
            lines of garbage
          </span>
          <span className="mode-best">
            {cheeseBest !== undefined ? formatTime(cheeseBest) : '—'}
          </span>
        </button>

        <button
          className="mode-row"
          style={{ animationDelay: '470ms' }}
          onClick={() => ctrl.start('survival')}
        >
          <span className="mode-name">survival</span>
          <span className="mode-desc">garbage keeps rising · outlast it</span>
          <span className="mode-best">
            {best.survival !== undefined ? formatTime(best.survival) : '—'}
          </span>
        </button>
      </nav>

      <footer className="menu-footer">
        <button className="ghost-btn" onClick={onOpenSettings}>
          settings
        </button>
        <span className="hint">arrows move · z x rotate · space drop · c hold</span>
      </footer>
    </div>
  )
}

export function Countdown({ ctrl }: { ctrl: GameController }) {
  const half = ctrl.countdownLeft <= 700
  return (
    <div className="overlay countdown" aria-live="assertive">
      <span className="countdown-word" key={half ? 'go' : 'ready'}>
        {half ? 'go' : 'ready'}
      </span>
    </div>
  )
}

export function PauseOverlay({
  ctrl,
  onOpenSettings,
}: {
  ctrl: GameController
  onOpenSettings: () => void
}) {
  return (
    <div className="overlay dim">
      <span className="overlay-title">paused</span>
      <div className="overlay-actions">
        <button className="solid-btn" onClick={() => ctrl.togglePause()}>
          resume
        </button>
        <button className="ghost-btn" onClick={() => ctrl.start(ctrl.mode)}>
          restart
        </button>
        <button className="ghost-btn" onClick={onOpenSettings}>
          settings
        </button>
        <button className="ghost-btn" onClick={() => ctrl.quitToMenu()}>
          menu
        </button>
      </div>
    </div>
  )
}

export function ResultsOverlay({ ctrl }: { ctrl: GameController }) {
  const r = ctrl.result
  if (!r) return null

  const timed = r.mode === 'sprint' || r.mode === 'cheese' || r.mode === 'survival'
  const title =
    r.mode === 'survival'
      ? formatTime(r.timeMs)
      : r.won
        ? timed
          ? formatTime(r.timeMs)
          : r.score.toLocaleString()
        : 'top out'
  const d = r.detail
  const breakdown: string[] = []
  const clearNames = ['single', 'double', 'triple', 'quad']
  d.clears.forEach((n, i) => {
    if (n > 0) breakdown.push(`${clearNames[i]} ×${n}`)
  })
  for (const [label, n] of Object.entries(d.spins)) {
    breakdown.push(`${label.toLowerCase()} ×${n}`)
  }
  if (d.perfectClears > 0) breakdown.push(`perfect clear ×${d.perfectClears}`)
  const subtitle =
    r.mode === 'survival'
      ? 'survived'
      : r.won
        ? r.mode === 'sprint'
          ? '40 lines cleared'
          : r.mode === 'cheese'
            ? `${r.cheeseTotal} lines of cheese, dug`
            : r.mode === 'blitz'
              ? 'final score'
              : 'final score'
        : r.mode === 'sprint'
          ? `${r.lines} / 40 lines`
          : r.mode === 'cheese'
            ? `${r.lines} lines dug`
            : `score ${r.score.toLocaleString()}`

  return (
    <div className="overlay dim results">
      {r.isPersonalBest && <span className="pb-badge">personal best</span>}
      <span className="overlay-title">{title}</span>
      <span className="overlay-subtitle">{subtitle}</span>

      <dl className="result-grid">
        <div>
          <dt>time</dt>
          <dd>{formatTime(r.timeMs)}</dd>
        </div>
        <div>
          <dt>lines</dt>
          <dd>{r.lines}</dd>
        </div>
        <div>
          <dt>pieces</dt>
          <dd>{r.pieces}</dd>
        </div>
        <div>
          <dt>pps</dt>
          <dd>{r.pps.toFixed(2)}</dd>
        </div>
        {r.mode === 'marathon' && (
          <div>
            <dt>level</dt>
            <dd>{r.level}</dd>
          </div>
        )}
        <div>
          <dt>inputs</dt>
          <dd>{d.inputs}</dd>
        </div>
        <div>
          <dt>kpp</dt>
          <dd>{d.kpp.toFixed(2)}</dd>
        </div>
        <div>
          <dt>holds</dt>
          <dd>{d.holds}</dd>
        </div>
        <div>
          <dt>finesse faults</dt>
          <dd>{d.finesseFaults}</dd>
        </div>
        {d.maxCombo > 0 && (
          <div>
            <dt>max combo</dt>
            <dd>{d.maxCombo}</dd>
          </div>
        )}
        {d.maxB2B > 0 && (
          <div>
            <dt>max b2b</dt>
            <dd>{d.maxB2B}</dd>
          </div>
        )}
      </dl>
      {breakdown.length > 0 && <p className="result-breakdown">{breakdown.join(' · ')}</p>}

      <div className="overlay-actions">
        <button className="solid-btn" onClick={() => ctrl.start(ctrl.mode)}>
          retry
        </button>
        <button className="ghost-btn" onClick={() => ctrl.quitToMenu()}>
          menu
        </button>
      </div>
      <span className="hint">r — quick retry</span>
    </div>
  )
}
