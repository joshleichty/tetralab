/**
 * Lesson-authoring helper: decode a fumen string to BoardSpec row strings
 * ready to paste into a lesson module.
 *
 *   node scripts/fumen-to-board.ts 'v115@bhilGeI8AeAgH' [--page n]
 */
import { fumenPageCount, fumenToRows } from '../src/learn/fumen.ts'

const args = process.argv.slice(2)
const fumen = args.find((x) => !x.startsWith('--'))
if (!fumen) {
  console.error("usage: node scripts/fumen-to-board.ts '<fumen>' [--page n]")
  process.exit(1)
}
const pageFlag = args.indexOf('--page')
const page = pageFlag >= 0 ? Number(args[pageFlag + 1]) : 0

const rows = fumenToRows(fumen, page)
console.log(`// fumen page ${page}/${fumenPageCount(fumen)}: ${fumen}`)
console.log('board: [')
for (const row of rows) console.log(`  '${row}',`)
console.log(']')
