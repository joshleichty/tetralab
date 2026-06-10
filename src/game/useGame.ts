import { useEffect, useRef, useSyncExternalStore } from 'react'
import { GameController } from './controller'

/**
 * Owns a single GameController for the app's lifetime and re-renders
 * the React tree whenever the controller's version bumps (once per frame
 * during play — components read controller fields directly).
 */
export function useGame(): GameController {
  const ref = useRef<GameController | null>(null)
  if (ref.current === null) {
    ref.current = new GameController()
    // handy for debugging and for driving the engine from scripts/bots
    ;(window as unknown as { __tetra: GameController }).__tetra = ref.current
  }
  const ctrl = ref.current

  useSyncExternalStore(ctrl.subscribe, ctrl.getVersion)

  useEffect(() => {
    return () => {
      ctrl.destroy()
      ref.current = null
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
