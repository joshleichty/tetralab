import { enumerateCandidates } from './enumerate.ts'
import { FEATURE_NAMES, featureValues } from './features.ts'
import type { FeatureName } from './features.ts'
import { DEFAULT_CONTEXT, placementOutcome } from './outcome.ts'
import type { EvalContext } from './outcome.ts'
import type { EvalProfile } from './profiles.ts'
import type { InputPlan, Placement, Position } from './types.ts'

/**
 * L3 query: rank every reachable placement under a profile, with the
 * "why" attached — `score` is exactly the sum of `contributions`
 * (interpretability invariant, tested). Deterministic: stable order,
 * canonical-placement tiebreak (the input order from enumerate).
 */

export interface Suggestion {
  placement: Placement
  plan: InputPlan
  score: number
  /** raw feature values */
  features: Record<FeatureName, number>
  /** value × weight, only for weighted features */
  contributions: Partial<Record<FeatureName, number>>
}

export interface SuggestOptions {
  context?: EvalContext
  /**
   * 1 = re-rank the top candidates by adding the best follow-up score
   * with the next known queue piece (heuristic sum of the two plies;
   * the follow-up search doesn't re-consider hold). 0/omitted = greedy.
   */
  lookahead?: 0 | 1
  /** how many top candidates the lookahead re-ranks (default 10) */
  lookaheadWidth?: number
}

export function suggest(
  pos: Position,
  profile: EvalProfile,
  opts: SuggestOptions = {},
): Suggestion[] {
  const ctx = opts.context ?? DEFAULT_CONTEXT
  const suggestions = enumerateCandidates(pos).map(({ placement, plan }) => {
    const outcome = placementOutcome(pos.board, placement, ctx)
    const features = featureValues({
      before: pos.board,
      after: outcome.after,
      placement,
      outcome,
      ctx,
    })
    const contributions: Partial<Record<FeatureName, number>> = {}
    let score = 0
    for (const name of FEATURE_NAMES) {
      const w = profile.weights[name]
      if (w === undefined || w === 0) continue
      const c = w * features[name]
      contributions[name] = c
      score += c
    }
    return { placement, plan, score, features, contributions }
  })
  // stable sort: ties keep canonical placement order
  const ranked = suggestions
    .map((s, i) => ({ s, i }))
    .sort((a, b) => b.s.score - a.s.score || a.i - b.i)
    .map(({ s }) => s)

  if (opts.lookahead !== 1) return ranked

  const width = opts.lookaheadWidth ?? 10
  const head = ranked.slice(0, width).map((s, i) => {
    // which piece spawns after this candidate locks
    const next = s.placement.usedHold && pos.hold === null ? pos.queue[1] : pos.queue[0]
    if (!next) return { s, i }
    const out = placementOutcome(pos.board, s.placement, ctx)
    // chain bookkeeping, engine semantics: difficult clear keeps/starts
    // b2b, plain clear kills it, no clear leaves it; combo likewise
    const ctx2: EvalContext = {
      b2b: out.linesCleared === 0 ? ctx.b2b : out.difficult,
      combo: out.linesCleared > 0 ? ctx.combo + 1 : -1,
      attack: ctx.attack,
    }
    const pos2: Position = { board: out.after, piece: next, queue: [], hold: null, holdUsed: true }
    const best = suggest(pos2, profile, { context: ctx2 })[0]
    return { s: { ...s, score: s.score + (best?.score ?? 0) }, i }
  })
  head.sort((a, b) => b.s.score - a.s.score || a.i - b.i)
  return [...head.map(({ s }) => s), ...ranked.slice(width)]
}
