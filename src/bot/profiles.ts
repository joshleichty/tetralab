import type { FeatureName } from './features.ts'

/**
 * Named weight vectors over the L3 feature registry (specs/bot-eval.md).
 * Strategies are profiles: data, not architecture. Unset features weigh 0.
 *
 * `dellacherie`/`bcts` carry published weights verbatim — they are
 * calibration anchors: if they can't survive sprint-40 on our engine
 * (M2 benchmark), our *feature implementations* are wrong, not the
 * weights. `clean`/`versus` are hand-seeded tetra profiles (versus uses
 * Cold Clear's published relative magnitudes as a prior, tetra's own
 * attack table for the attack term) — tuned via the run.ts harness.
 */

export interface EvalProfile {
  name: string
  weights: Partial<Record<FeatureName, number>>
}

export const PROFILES = {
  /** Dellacherie's original hand-tuned controller (~660k lines)
   *  [Thiery & Scherrer 2009, table 1 / codemyroad] */
  dellacherie: {
    name: 'dellacherie',
    weights: {
      landingHeight: -1,
      erodedPieceCells: 1,
      rowTransitions: -1,
      columnTransitions: -1,
      holes: -4,
      cumulativeWells: -1,
    },
  },
  /** BCTS cross-entropy weights (Dellacherie + holeDepth/rowsWithHoles)
   *  [Thiery & Scherrer 2009; 2008 RL competition winner] */
  bcts: {
    name: 'bcts',
    weights: {
      landingHeight: -12.63,
      erodedPieceCells: 6.6,
      rowTransitions: -9.22,
      columnTransitions: -19.77,
      holes: -13.08,
      cumulativeWells: -10.49,
      holeDepth: -1.61,
      rowsWithHoles: -24.04,
    },
  },
  /** survival/downstack: never bury, keep low and flat, take clears */
  clean: {
    name: 'clean',
    weights: {
      holesCreated: -12,
      holes: -4,
      holeDepth: -0.5,
      maxHeight: -1.5,
      bumpiness: -1,
      linesCleared: 3,
      landingHeight: -1,
    },
  },
  /** guideline versus: attack economy, T-slots, B2B, a kept well
   *  (relative shape after Cold Clear's published standard eval) */
  versus: {
    name: 'versus',
    weights: {
      holesCreated: -12,
      holes: -5,
      maxHeight: -1,
      bumpiness: -0.8,
      deepestWell: 1.5,
      tslots: 5,
      attack: 8,
      b2bBroken: -8,
      linesCleared: -1, // burning smalls wastes pieces; quads pay via attack
      comboContinued: 1,
      perfectClear: 25,
      landingHeight: -0.5,
    },
  },
} as const satisfies Record<string, EvalProfile>

export type ProfileName = keyof typeof PROFILES
