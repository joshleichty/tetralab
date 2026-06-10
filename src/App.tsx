import { useState } from 'react'
import { useGame } from './game/useGame'
import { ActionCaption, BoardCanvas, HoldBox, QueueBox, StatsPanel } from './ui/Hud'
import { Countdown, Menu, PauseOverlay, ResultsOverlay } from './ui/Overlays'
import { SettingsModal } from './ui/SettingsModal'

export default function App() {
  const ctrl = useGame()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const inGame = ctrl.phase !== 'menu'

  return (
    <div className="app">
      <div className="grain" aria-hidden />
      <span className="corner-mark" aria-hidden>
        tetra
      </span>

      {inGame && (
        <main className="stage">
          <aside className="side side-left">
            <HoldBox ctrl={ctrl} />
            <ActionCaption ctrl={ctrl} />
            <StatsPanel ctrl={ctrl} />
          </aside>

          <div className="field-frame">
            <BoardCanvas ctrl={ctrl} />
            {ctrl.phase === 'countdown' && <Countdown ctrl={ctrl} />}
            {ctrl.phase === 'paused' && !settingsOpen && (
              <PauseOverlay ctrl={ctrl} onOpenSettings={() => setSettingsOpen(true)} />
            )}
            {ctrl.phase === 'over' && <ResultsOverlay ctrl={ctrl} />}
          </div>

          <aside className="side side-right">
            <QueueBox ctrl={ctrl} />
          </aside>
        </main>
      )}

      {ctrl.phase === 'menu' && <Menu ctrl={ctrl} onOpenSettings={() => setSettingsOpen(true)} />}
      {settingsOpen && <SettingsModal ctrl={ctrl} onClose={() => setSettingsOpen(false)} />}
    </div>
  )
}
