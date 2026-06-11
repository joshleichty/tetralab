/**
 * Self-play benchmark CLI (specs/bot-eval.md M2): run N games under a
 * profile, emit JSON metrics on stdout. The tuning instrument — compare
 * profiles before pinning regression bounds.
 *
 *   node src/bot/run.ts --profile versus --mode endless --games 10
 *   node src/bot/run.ts --profile clean --mode cheese --games 10 --lookahead 1
 *
 * Modes: sprint | cheese | endless (level-1 only; see selfplay.ts).
 */
import { PROFILES } from './profiles.ts'
import type { ProfileName } from './profiles.ts'
import { median, playGame } from './selfplay.ts'
import type { BenchMode, GameResult } from './selfplay.ts'

declare const process: { argv: string[]; stdout: { write(s: string): void } }

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : fallback
}

const profileName = arg('profile', 'versus') as ProfileName
const profile = PROFILES[profileName]
if (!profile) throw new Error(`unknown profile "${profileName}" (${Object.keys(PROFILES).join(', ')})`)
const mode = arg('mode', 'endless') as BenchMode
const games = Number(arg('games', '10'))
const baseSeed = Number(arg('seed', '1000'))
const maxPieces = Number(arg('maxPieces', '300'))
const lookahead = arg('lookahead', '0') === '1' ? (1 as const) : undefined

const results: GameResult[] = []
for (let i = 0; i < games; i++) {
  results.push(playGame(profile, { seed: baseSeed + i, mode, maxPieces, lookahead }))
}

const completed = results.filter((r) => r.status === 'won').length
const out = {
  profile: profileName,
  mode,
  games,
  lookahead: lookahead ?? 0,
  aggregate: {
    completed,
    completionRate: completed / games,
    toppedOut: results.filter((r) => r.status === 'over').length,
    medianPieces: median(results.map((r) => r.pieces)),
    medianLines: median(results.map((r) => r.lines)),
    medianAttackPerPiece: median(results.map((r) => r.attackPerPiece)),
  },
  games_detail: results,
}
process.stdout.write(JSON.stringify(out, null, 2) + '\n')
