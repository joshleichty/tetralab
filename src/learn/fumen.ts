import { decoder } from 'tetris-fumen'
import type { BoardSpec } from './types.ts'

/**
 * Fumen import (spec training-core §2): paste community fumen, get a
 * BoardSpec. Strictly an interchange/authoring tool — fumen is never the
 * runtime format, and nothing in the app imports this module; use
 * `node scripts/fumen-to-board.ts <fumen>` while writing lessons.
 * (`tetris-fumen` is a devDependency for the same reason.)
 */

/** decode one fumen page to bottom-aligned row strings */
export function fumenToRows(fumen: string, page = 0): BoardSpec {
  const pages = decoder.decode(fumen.trim())
  const target = pages[page]
  if (!target) {
    throw new Error(`fumen has ${pages.length} page(s), no page ${page}`)
  }
  // str() is top-to-bottom with '_' empties and I/L/O/Z/T/J/S/X cells —
  // exactly the BoardSpec alphabet (engine board.ts)
  const s = target.field.str({ reduced: true, garbage: true })
  return s === '' ? [] : s.split('\n')
}

export function fumenPageCount(fumen: string): number {
  return decoder.decode(fumen.trim()).length
}
