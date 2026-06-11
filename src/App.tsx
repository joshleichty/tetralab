import { useState } from 'react'
import { useGame } from './game/useGame'
import {
  ActionCaption,
  BoardCanvas,
  GarbageMeter,
  HoldBox,
  OpponentPanel,
  QueueBox,
  StatsPanel,
} from './ui/Hud'
import { Learn } from './ui/Learn'
import { OnlineScreen } from './ui/Online'
import { Countdown, Menu, PauseOverlay, ResultsOverlay } from './ui/Overlays'
import { SettingsModal } from './ui/SettingsModal'

/** an invite link (#/vs/code) drops straight into the join flow */
const inviteCode = window.location.hash.startsWith('#/vs/')
  ? window.location.hash.slice(5).toLowerCase()
  : null

export default function App() {
  const ctrl = useGame()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [section, setSection] = useState<'play' | 'learn' | 'online'>(
    inviteCode ? 'online' : 'play',
  )
  const inGame = section === 'play' && ctrl.phase !== 'menu'

  if (section === 'online') {
    return (
      <div className="app">
        <div className="grain" aria-hidden />
        <span className="corner-mark" aria-hidden>
          tetra
        </span>
        <OnlineScreen
          ctrl={ctrl}
          initialCode={ctrl.online ? null : inviteCode}
          onExit={() => {
            // replaceState avoids main.tsx's hashchange reload
            history.replaceState(null, '', window.location.pathname)
            setSection('play')
          }}
        />
      </div>
    )
  }

  if (section === 'learn') {
    return (
      <div className="app">
        <div className="grain" aria-hidden />
        <span className="corner-mark" aria-hidden>
          tetra
        </span>
        <Learn onExit={() => setSection('play')} />
      </div>
    )
  }

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
            {ctrl.mode === 'battle' && <GarbageMeter ctrl={ctrl} />}
            <BoardCanvas ctrl={ctrl} />
            {ctrl.phase === 'countdown' && <Countdown ctrl={ctrl} />}
            {ctrl.phase === 'paused' && !settingsOpen && (
              <PauseOverlay ctrl={ctrl} onOpenSettings={() => setSettingsOpen(true)} />
            )}
            {ctrl.phase === 'over' && <ResultsOverlay ctrl={ctrl} />}
          </div>

          <aside className="side side-right">
            <QueueBox ctrl={ctrl} />
            {ctrl.mode === 'battle' && <OpponentPanel ctrl={ctrl} />}
          </aside>
        </main>
      )}

      {ctrl.phase === 'menu' && (
        <Menu
          ctrl={ctrl}
          onOpenSettings={() => setSettingsOpen(true)}
          onLearn={() => setSection('learn')}
          onOnline={() => setSection('online')}
        />
      )}
      {settingsOpen && <SettingsModal ctrl={ctrl} onClose={() => setSettingsOpen(false)} />}
    </div>
  )
}
