import { useEffect, useState } from 'react'
import type { GameController } from '../game/controller'
import type { BindableAction } from '../input/keyboard'
import { DEFAULT_BINDINGS } from '../input/keyboard'
import { INSTANT_SDF } from '../engine/types'

const BIND_ROWS: Array<{ action: BindableAction; label: string }> = [
  { action: 'left', label: 'move left' },
  { action: 'right', label: 'move right' },
  { action: 'softDrop', label: 'soft drop' },
  { action: 'hardDrop', label: 'hard drop' },
  { action: 'ccw', label: 'rotate ccw' },
  { action: 'cw', label: 'rotate cw' },
  { action: 'r180', label: 'rotate 180' },
  { action: 'hold', label: 'hold' },
  { action: 'pause', label: 'pause' },
  { action: 'restart', label: 'restart' },
]

const SPECIAL_KEYS: Record<string, string> = {
  Space: 'space',
  Escape: 'esc',
  ShiftLeft: 'shift',
  ShiftRight: 'r-shift',
  ControlLeft: 'ctrl',
  ControlRight: 'r-ctrl',
  AltLeft: 'alt',
  AltRight: 'r-alt',
  Enter: 'enter',
  Tab: 'tab',
  Backspace: 'bksp',
}

function prettyKey(code: string): string {
  if (code in SPECIAL_KEYS) return SPECIAL_KEYS[code]
  if (code.startsWith('Arrow')) return code.slice(5).toLowerCase()
  if (code.startsWith('Key')) return code.slice(3).toLowerCase()
  if (code.startsWith('Digit')) return code.slice(5)
  return code.toLowerCase()
}

export function SettingsModal({ ctrl, onClose }: { ctrl: GameController; onClose: () => void }) {
  const s = ctrl.settings
  const [rebinding, setRebinding] = useState<BindableAction | null>(null)

  useEffect(() => {
    if (!rebinding) return
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault()
      e.stopPropagation()
      if (e.code !== 'Escape') ctrl.addBind(rebinding, e.code)
      setRebinding(null)
    }
    window.addEventListener('keydown', onKey, { capture: true })
    return () => window.removeEventListener('keydown', onKey, { capture: true })
  }, [rebinding, ctrl])

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => {
      if (e.code === 'Escape' && !rebinding) {
        e.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', onEsc, { capture: true })
    return () => window.removeEventListener('keydown', onEsc, { capture: true })
  }, [onClose, rebinding])

  return (
    <div className="overlay dim settings" onClick={onClose}>
      <div className="settings-card" onClick={(e) => e.stopPropagation()}>
        <header className="settings-head">
          <h2>settings</h2>
          <button className="ghost-btn" onClick={onClose}>
            done
          </button>
        </header>

        <section>
          <h3>handling</h3>
          <Slider
            label="das"
            hint="delay before auto-shift"
            value={s.das}
            min={0}
            max={300}
            step={1}
            unit="ms"
            onChange={(das) => ctrl.updateSettings({ das })}
          />
          <Slider
            label="arr"
            hint="auto-repeat rate · 0 = instant"
            value={s.arr}
            min={0}
            max={80}
            step={1}
            unit="ms"
            onChange={(arr) => ctrl.updateSettings({ arr })}
          />
          <Slider
            label="sdf"
            hint="soft drop speed multiplier"
            value={s.sdf}
            min={5}
            max={INSTANT_SDF}
            step={1}
            unit="×"
            display={s.sdf >= INSTANT_SDF ? '∞' : `${s.sdf}×`}
            onChange={(sdf) => ctrl.updateSettings({ sdf })}
          />
          <Slider
            label="dcd"
            hint="das cut delay · pauses auto-repeat after rotate/drop"
            value={s.dcd}
            min={0}
            max={100}
            step={1}
            unit="ms"
            display={s.dcd === 0 ? 'off' : `${s.dcd}ms`}
            onChange={(dcd) => ctrl.updateSettings({ dcd })}
          />
          <Toggle
            label="safe lock"
            hint="brief hard-drop guard after a piece locks on its own"
            value={s.safelock}
            onChange={(safelock) => ctrl.updateSettings({ safelock })}
          />
        </section>

        <section>
          <h3>game</h3>
          <Toggle label="ghost piece" value={s.ghost} onChange={(ghost) => ctrl.updateSettings({ ghost })} />
          <Toggle
            label="danger warning"
            hint="red board + sound when the stack nears the top"
            value={s.danger}
            onChange={(danger) => ctrl.updateSettings({ danger })}
          />
          <Toggle label="visual effects" value={s.vfx} onChange={(vfx) => ctrl.updateSettings({ vfx })} />
          <Toggle label="sound" value={s.sound} onChange={(sound) => ctrl.updateSettings({ sound })} />
          <Slider
            label="volume"
            hint="sfx level"
            value={s.volume}
            min={0}
            max={100}
            step={1}
            unit="%"
            onChange={(volume) => ctrl.updateSettings({ volume })}
          />
        </section>

        <section>
          <h3>keys</h3>
          <p className="bind-hint">click a key to unbind it · + adds another key</p>
          <div className="bind-grid">
            {BIND_ROWS.map(({ action, label }) => (
              <div key={action} className="bind-row">
                <span>{label}</span>
                <span className="bind-keys">
                  {ctrl.settings.bindings[action].map((code) => (
                    <kbd
                      key={code}
                      className="bind-key"
                      title="unbind"
                      onClick={() => ctrl.removeBind(action, code)}
                    >
                      {prettyKey(code)}
                    </kbd>
                  ))}
                  <button
                    className={`bind-add${rebinding === action ? ' rebinding' : ''}`}
                    onClick={() => setRebinding(rebinding === action ? null : action)}
                  >
                    {rebinding === action ? 'press a key…' : '+'}
                  </button>
                </span>
              </div>
            ))}
          </div>
          <button
            className="ghost-btn reset-binds"
            onClick={() => ctrl.updateSettings({ bindings: structuredClone(DEFAULT_BINDINGS) })}
          >
            reset to defaults
          </button>
        </section>
      </div>
    </div>
  )
}

function Slider({
  label,
  hint,
  value,
  min,
  max,
  step,
  unit,
  display,
  onChange,
}: {
  label: string
  hint: string
  value: number
  min: number
  max: number
  step: number
  unit: string
  display?: string
  onChange: (v: number) => void
}) {
  return (
    <label className="slider-row">
      <span className="slider-label">
        {label}
        <em>{hint}</em>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <span className="slider-value">{display ?? `${value}${unit}`}</span>
    </label>
  )
}

function Toggle({
  label,
  hint,
  value,
  onChange,
}: {
  label: string
  hint?: string
  value: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <button className={`toggle-row${value ? ' on' : ''}`} onClick={() => onChange(!value)}>
      <span>
        {label}
        {hint && <em>{hint}</em>}
      </span>
      <span className="toggle-pill" aria-hidden>
        <span className="toggle-dot" />
      </span>
    </button>
  )
}
