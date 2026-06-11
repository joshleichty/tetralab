/**
 * tetra-stats: derive per-piece/aggregate stats from a stored replay
 * (spec training-core §4 — headless/CLI-first; the Review UI comes later).
 *
 *   node scripts/replay-stats.ts <replay.json> [--index n] [--json]
 *
 * The file may hold one Replay or an array (e.g. the localStorage value
 * of `tetra.replays.v1` pasted to a file). Runs on plain Node — the
 * engine import chain is extension-clean.
 */
import { readFileSync } from 'node:fs'
import { analyzeReplay } from '../src/engine/stats.ts'
import type { Replay } from '../src/engine/replay.ts'

const args = process.argv.slice(2)
const file = args.find((x) => !x.startsWith('--'))
if (!file) {
  console.error('usage: node scripts/replay-stats.ts <replay.json> [--index n] [--json]')
  process.exit(1)
}
const indexFlag = args.indexOf('--index')
const index = indexFlag >= 0 ? Number(args[indexFlag + 1]) : 0
const asJson = args.includes('--json')

const parsed = JSON.parse(readFileSync(file, 'utf8')) as Replay | Replay[]
const replay = Array.isArray(parsed) ? parsed[index] : parsed
if (!replay) {
  console.error(`no replay at index ${index} (file holds ${Array.isArray(parsed) ? parsed.length : 1})`)
  process.exit(1)
}

const stats = analyzeReplay(replay)

if (asJson) {
  console.log(JSON.stringify(stats, null, 2))
  process.exit(0)
}

const f = stats.final
const fmt = (n: number | null, digits = 2) => (n === null ? '—' : n.toFixed(digits))
console.log(
  `${replay.config.mode} seed=${replay.config.seed} → ${f.status}` +
    ` | score ${f.score} | lines ${f.lines} | pieces ${f.pieces}` +
    ` | ${(f.elapsedMs / 1000).toFixed(1)}s` +
    ` | resimulation ${stats.verified ? 'verified' : 'MISMATCH'}`,
)
console.log(
  `kpp ${fmt(stats.kpp)} | finesse faults ${stats.finesseFaults ?? '—'}` +
    ` (rate ${fmt(stats.faultRate)})` +
    ` | holes created ${stats.holesCreated}` +
    ` | roughness mean ${stats.roughness.mean.toFixed(1)} max ${stats.roughness.max}`,
)
if (stats.downstack) {
  console.log(
    `downstack: ${stats.downstack.cheeseCleared} cheese lines,` +
      ` ${stats.downstack.blocksPer100.toFixed(0)} blocks/100L`,
  )
}
const faults = stats.perPiece.filter((x) => x.fault)
if (faults.length > 0) {
  console.log('faulted placements:')
  for (const x of faults) {
    console.log(
      `  #${x.index + 1} ${x.type} rot=${x.rot} x=${x.x}: ${x.presses} presses (optimal ${x.optimal})`,
    )
  }
}
