/**
 * Headless demo of the bot substrate (L0–L2): print every reachable
 * placement and its keypress plan, pick one at random (seeded), execute
 * it on the real engine, repeat. The "headless/CLI-first" proof for
 * specs/bot-core.md.
 *
 *   node src/bot/cli.ts --seed 42 --pieces 5 [--mode cheese]
 *
 * Runs on plain Node (>= 23) via native type stripping — keep this
 * file's runtime import chain .ts-suffixed (scripts/ convention).
 */
import { formatBoard } from '../engine/board.ts'
import { Engine } from '../engine/engine.ts'
import { createRng } from '../engine/rng.ts'
import { INSTANT_SDF, type Mode } from '../engine/types.ts'
import { enumerateCandidates } from './enumerate.ts'
import { executePlan } from './execute.ts'

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : fallback
}

const seed = Number(arg('seed', '42'))
const pieces = Number(arg('pieces', '5'))
const mode = arg('mode', 'marathon') as Mode

const e = new Engine({ seed, mode, sdf: INSTANT_SDF })
e.start()
const rng = createRng((seed ^ 0xc1eb) >>> 0)

console.log(`tetra bot substrate demo · seed ${seed} · ${mode}`)

for (let i = 0; i < pieces && e.status === 'playing'; i++) {
  const pos = e.snapshot()
  if (!pos) break
  const candidates = enumerateCandidates(pos)

  console.log(
    `\n── piece ${i + 1}/${pieces}: ${pos.piece}   hold ${pos.hold ?? '—'} · next ${pos.queue.join(' ')}`,
  )
  for (const row of formatBoard(pos.board, 6)) console.log(`   ${row}`)
  console.log(`   ${candidates.length} reachable placements:`)
  for (const { placement: p, plan } of candidates) {
    const tags = [
      p.spin !== 'none' ? p.spin : null,
      p.usedHold ? 'hold' : null,
      p.hardDropOnly ? null : 'sd',
    ]
      .filter(Boolean)
      .join(',')
    console.log(
      `     rot${p.rot} x${String(p.x).padStart(2)} y${String(p.y).padStart(2)}  ${tags.padEnd(10)} ${plan.steps.join(' ')}`,
    )
  }

  const pick = candidates[Math.floor(rng() * candidates.length)]
  console.log(`   → executing rot${pick.placement.rot} x${pick.placement.x}`)
  executePlan(e, pick.plan)
}

console.log(
  `\nfinal: ${e.piecesPlaced} pieces · ${e.lines} lines · score ${e.score} · ${e.status}`,
)
