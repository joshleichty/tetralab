/**
 * Attack rules — the guideline-standard table shared by TETR.IO and
 * Jstris (specs/feature-parity.md "Ruleset", verified 2026-06-09 against
 * [WN] winternebs TETRIS-FAQ /versus/). Everything lives in config so
 * client variants (TETR.IO multiplier, Surge) become tables later, not
 * rewrites.
 */

export interface AttackConfig {
  /** lines sent by plain clear size, indexed by lines (0–4): S/D/T/Quad */
  clear: [number, number, number, number, number]
  /** lines sent by full T-spin, indexed by lines cleared (0–3) */
  tspin: [number, number, number, number]
  /** lines sent by mini T-spin, indexed by lines cleared (0–2) */
  tspinMini: [number, number, number]
  /** additive perfect-clear bonus (clients range 5–10; Jstris 10) */
  perfectClear: number
  /** additive bonus per attack while back-to-back */
  b2bBonus: number
  /**
   * additive combo table indexed from 1-combo (the second consecutive
   * clear); past the end the last entry holds
   */
  combo: number[]
  /** per-line probability [0,1] that the garbage hole column moves */
  messiness: number
}

export const DEFAULT_ATTACK_CONFIG: AttackConfig = {
  clear: [0, 0, 1, 2, 4],
  tspin: [0, 2, 4, 6],
  tspinMini: [0, 0, 1],
  perfectClear: 10,
  b2bBonus: 1,
  combo: [0, 0, 1, 1, 1, 2, 2, 3, 3, 4, 4, 4, 5],
  messiness: 0,
}

export interface AttackInput {
  lines: number
  tspin: 'none' | 'mini' | 'full'
  /** the clear continued a back-to-back chain */
  b2b: boolean
  /** engine combo counter: n ⇒ this is the (n)-combo clear, 0 = chain start */
  combo: number
  perfectClear: boolean
}

/** lines this clear sends, before cancellation against pending garbage */
export function attackFor(a: AttackInput, cfg: AttackConfig): number {
  if (a.lines === 0) return 0
  let attack: number
  if (a.tspin === 'full') {
    attack = cfg.tspin[Math.min(a.lines, 3)]
  } else if (a.tspin === 'mini') {
    attack = cfg.tspinMini[Math.min(a.lines, 2)]
  } else {
    attack = cfg.clear[Math.min(a.lines, 4)]
  }
  if (a.b2b) attack += cfg.b2bBonus
  if (a.combo > 0) attack += cfg.combo[Math.min(a.combo - 1, cfg.combo.length - 1)]
  if (a.perfectClear) attack += cfg.perfectClear
  return attack
}
