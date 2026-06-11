/**
 * Regenerate the finesse table artifact (src/engine/data/finesse-table.json).
 *
 *   npm run gen:finesse
 *
 * Runs on plain Node (>= 23) via native type stripping — keep this script's
 * import chain free of runtime imports of extensionless modules. The
 * artifact is the contract: finesse-table.test.ts asserts it matches the
 * generator output, so a stale artifact fails CI rather than shipping.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildFinesseTable } from '../src/engine/finesse-gen.ts'

const out = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'src/engine/data/finesse-table.json',
)
const table = buildFinesseTable()
mkdirSync(dirname(out), { recursive: true })
writeFileSync(out, JSON.stringify(table, null, 2) + '\n')

let placements = 0
for (const entries of Object.values(table.pieces)) placements += Object.keys(entries).length
console.log(`wrote ${out}: ${placements} placements (version ${table.version})`)
