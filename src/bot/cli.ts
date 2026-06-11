/**
 * Headless demo of the bot substrate: print every reachable placement
 * and its keypress plan, pick one (seeded random), execute it on the
 * real engine, repeat. With --profile, rank via L3's suggest() instead —
 * scores, top contributions, best move executed.
 *
 *   node src/bot/cli.ts --seed 42 --pieces 5 [--mode cheese] [--profile versus]
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
import type { FeatureName } from './features.ts'
import { PROFILES } from './profiles.ts'
import type { ProfileName } from './profiles.ts'
import { suggest } from './suggest.ts'

// node entrypoint inside the app tsconfig (DOM lib): declare the one node
// global we use rather than pulling @types/node into src/
declare const process: { argv: string[] }

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : fallback
}

const seed = Number(arg('seed', '42'))
const pieces = Number(arg('pieces', '5'))
const mode = arg('mode', 'marathon') as Mode
const profileName = arg('profile', '') as ProfileName | ''
const profile = profileName === '' ? null : PROFILES[profileName]
if (profileName !== '' && !profile) {
  throw new Error(`unknown profile "${profileName}" (${Object.keys(PROFILES).join(', ')})`)
}

const e = new Engine({ seed, mode, sdf: INSTANT_SDF })
e.start()
const rng = createRng((seed ^ 0xc1eb) >>> 0)

console.log(
  `tetra bot demo · seed ${seed} · ${mode}${profile ? ` · profile ${profile.name}` : ''}`,
)

const tagsOf = (p: { spin: string; usedHold: boolean; hardDropOnly: boolean }) =>
  [p.spin !== 'none' ? p.spin : null, p.usedHold ? 'hold' : null, p.hardDropOnly ? null : 'sd']
    .filter(Boolean)
    .join(',')

for (let i = 0; i < pieces && e.status === 'playing'; i++) {
  const pos = e.snapshot()
  if (!pos) break

  console.log(
    `\n── piece ${i + 1}/${pieces}: ${pos.piece}   hold ${pos.hold ?? '—'} · next ${pos.queue.join(' ')}`,
  )
  for (const row of formatBoard(pos.board, 6)) console.log(`   ${row}`)

  if (profile) {
    const ranked = suggest(pos, profile, { context: { b2b: e.b2b >= 0, combo: e.combo } })
    console.log(`   top placements of ${ranked.length} (score · why):`)
    for (const s of ranked.slice(0, 8)) {
      const p = s.placement
      const why = (Object.entries(s.contributions) as Array<[FeatureName, number]>)
        .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
        .slice(0, 3)
        .map(([n, c]) => `${n} ${c >= 0 ? '+' : ''}${c.toFixed(1)}`)
        .join('  ')
      console.log(
        `     rot${p.rot} x${String(p.x).padStart(2)}  ${tagsOf(p).padEnd(9)} ${s.score.toFixed(1).padStart(8)}   ${why}`,
      )
    }
    const top = ranked[0]
    console.log(`   → executing rot${top.placement.rot} x${top.placement.x} (best)`)
    executePlan(e, top.plan)
  } else {
    const candidates = enumerateCandidates(pos)
    console.log(`   ${candidates.length} reachable placements:`)
    for (const { placement: p, plan } of candidates) {
      console.log(
        `     rot${p.rot} x${String(p.x).padStart(2)} y${String(p.y).padStart(2)}  ${tagsOf(p).padEnd(10)} ${plan.steps.join(' ')}`,
      )
    }
    const pick = candidates[Math.floor(rng() * candidates.length)]
    console.log(`   → executing rot${pick.placement.rot} x${pick.placement.x}`)
    executePlan(e, pick.plan)
  }
}

console.log(
  `\nfinal: ${e.piecesPlaced} pieces · ${e.lines} lines · score ${e.score} · ${e.status}`,
)
