import { useEffect, useState, useSyncExternalStore } from 'react'
import { GameController } from './controller'

/**
 * Owns a single GameController for the app's lifetime and re-renders
 * the React tree whenever the controller's version bumps (once per frame
 * during play — components read controller fields directly).
 */
export function useGame(): GameController {
  const [ctrl] = useState(() => new GameController())

  useSyncExternalStore(ctrl.subscribe, ctrl.getVersion)

  useEffect(() => {
    // handy for debugging and for driving the engine from scripts/bots
    ;(window as unknown as { __tetra: GameController }).__tetra = ctrl
    return () => {
      ctrl.destroy()
    }
  }, [ctrl])

  return ctrl
}

export function formatTime(ms: number): string {
  const totalSecs = Math.floor(ms / 1000)
  const mins = Math.floor(totalSecs / 60)
  const secs = totalSecs % 60
  const hundredths = Math.floor((ms % 1000) / 10)
  return `${mins}:${String(secs).padStart(2, '0')}.${String(hundredths).padStart(2, '0')}`
}
