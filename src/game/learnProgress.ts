/**
 * Learn progress persistence (settings.ts pattern): one record per
 * completed lesson, keyed by lesson id. Lives in the app shell —
 * src/learn stays storage-free and headless.
 */

export interface LessonResult {
  completedAt: number
  /** total wrong attempts across the run */
  mistakes: number
  /** steps finished via reveal rather than solved */
  revealed: number
  /** hints consulted */
  hints: number
}

export type LearnProgress = Record<string, LessonResult>

const KEY = 'tetra.learn.v1'

export function loadLearnProgress(): LearnProgress {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? '{}')
    return parsed && typeof parsed === 'object' ? (parsed as LearnProgress) : {}
  } catch {
    return {}
  }
}

export function saveLessonResult(id: string, result: LessonResult) {
  try {
    const all = loadLearnProgress()
    all[id] = result
    localStorage.setItem(KEY, JSON.stringify(all))
  } catch {
    /* private browsing etc. */
  }
}
