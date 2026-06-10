import { DEFAULT_BINDINGS, type KeyBindings } from '../input/keyboard'

export interface Settings {
  das: number
  arr: number
  sdf: number // 41 = instant
  /** DAS cut delay, ms (0 = off; TETR.IO defaults to ~2 frames) */
  dcd: number
  /** swallow hard drops briefly after a piece auto-locks */
  safelock: boolean
  /** red board treatment + sound when the stack nears the top */
  danger: boolean
  ghost: boolean
  sound: boolean
  /** SFX volume, 0–100 */
  volume: number
  vfx: boolean
  bindings: KeyBindings
}

export const DEFAULT_SETTINGS: Settings = {
  das: 133,
  arr: 10,
  sdf: 20,
  dcd: 0,
  safelock: true,
  danger: true,
  ghost: true,
  sound: true,
  volume: 100,
  vfx: true,
  bindings: DEFAULT_BINDINGS,
}

const SETTINGS_KEY = 'tetra.settings.v1'
const BEST_KEY = 'tetra.best.v1'

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return structuredClone(DEFAULT_SETTINGS)
    const parsed = JSON.parse(raw)
    return {
      ...structuredClone(DEFAULT_SETTINGS),
      ...parsed,
      bindings: { ...DEFAULT_BINDINGS, ...(parsed.bindings ?? {}) },
    }
  } catch {
    return structuredClone(DEFAULT_SETTINGS)
  }
}

export function saveSettings(s: Settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s))
  } catch {
    /* private browsing etc. */
  }
}

export interface BestRecords {
  /** sprint: best (lowest) time in ms */
  sprint?: number
  /** blitz / marathon: best (highest) score */
  blitz?: number
  marathon?: number
  /** cheese races: best (lowest) time in ms, keyed by race size */
  cheese10?: number
  cheese18?: number
  cheese100?: number
  /** survival: longest time survived in ms */
  survival?: number
}

export function loadBest(): BestRecords {
  try {
    return JSON.parse(localStorage.getItem(BEST_KEY) ?? '{}')
  } catch {
    return {}
  }
}

export function saveBest(b: BestRecords) {
  try {
    localStorage.setItem(BEST_KEY, JSON.stringify(b))
  } catch {
    /* ignore */
  }
}
