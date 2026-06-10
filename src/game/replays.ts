import type { Replay } from '../engine/replay'

/**
 * Replay persistence (D5: every finished game records; the viewer comes
 * with the pedagogy stream's Review surface). Stored like PBs, newest
 * first, capped so localStorage stays comfortably under quota.
 */

const REPLAYS_KEY = 'tetra.replays.v1'
const MAX_STORED = 20

export function loadReplays(): Replay[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(REPLAYS_KEY) ?? '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveReplay(replay: Replay) {
  const stamped: Replay = { ...replay, recordedAt: Date.now() }
  const list = [stamped, ...loadReplays()].slice(0, MAX_STORED)
  try {
    localStorage.setItem(REPLAYS_KEY, JSON.stringify(list))
  } catch {
    try {
      // quota pressure: keep only the newest game
      localStorage.setItem(REPLAYS_KEY, JSON.stringify([stamped]))
    } catch {
      /* private browsing etc. */
    }
  }
}
