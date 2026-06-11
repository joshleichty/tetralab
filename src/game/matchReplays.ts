import type { MatchReplay } from '../net/lockstep'

/**
 * Online match-replay persistence (M6) — same shape as replays.ts:
 * newest first, capped, quota-safe. A `MatchReplay` is both action
 * streams + match config (docs/netcode.md); the viewer belongs to the
 * pedagogy Review surface, like solo replays (D5).
 */

const KEY = 'tetra.matchReplays.v1'
const MAX_STORED = 10

export interface StoredMatchReplay extends MatchReplay {
  /** wall-clock stamp added here (the net layer stays pure) */
  recordedAt: number
  /** denormalized for list display; never used in playback */
  summary: { outcome: string; peerName: string | null; steps: number }
}

export function loadMatchReplays(): StoredMatchReplay[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveMatchReplay(
  replay: MatchReplay,
  summary: StoredMatchReplay['summary'],
) {
  const stamped: StoredMatchReplay = { ...replay, recordedAt: Date.now(), summary }
  const list = [stamped, ...loadMatchReplays()].slice(0, MAX_STORED)
  try {
    localStorage.setItem(KEY, JSON.stringify(list))
  } catch {
    try {
      // quota pressure: keep only the newest match
      localStorage.setItem(KEY, JSON.stringify([stamped]))
    } catch {
      /* private browsing etc. */
    }
  }
}
