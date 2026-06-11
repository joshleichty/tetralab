import { describe, expect, it } from 'vitest'
import { candidateKey } from './enumerate.ts'
import { PROFILES } from './profiles.ts'
import { positionFromRows } from './position.ts'
import { suggest } from './suggest.ts'
import type { Suggestion } from './suggest.ts'

const TSD_ROWS = ['X_________', '___XXXXXXX', 'X_XXXXXXXX']

const keyOf = (s: Suggestion) => candidateKey(s.placement.cells, s.placement.spin)

describe('suggest()', () => {
  it('score is exactly the sum of contributions (interpretability invariant)', () => {
    const pos = positionFromRows(TSD_ROWS, 'T', { holdUsed: true })
    for (const profile of Object.values(PROFILES)) {
      for (const s of suggest(pos, profile)) {
        const sum = Object.values(s.contributions).reduce((a, b) => a + b, 0)
        expect(s.score).toBeCloseTo(sum, 10)
      }
    }
  })

  it('is deterministic: same position + profile, identical output', () => {
    const pos = positionFromRows(TSD_ROWS, 'T', { holdUsed: true })
    const a = suggest(pos, PROFILES.versus)
    const b = suggest(positionFromRows(TSD_ROWS, 'T', { holdUsed: true }), PROFILES.versus)
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })

  it('versus ranks the TSD first on the TSD board', () => {
    const pos = positionFromRows(TSD_ROWS, 'T', { holdUsed: true })
    const top = suggest(pos, PROFILES.versus)[0]
    expect(top.placement.spin).toBe('full')
    expect(top.features.attack).toBe(4)
  })

  it('profiles visibly disagree: dellacherie and versus order candidates differently', () => {
    const pos = positionFromRows(TSD_ROWS, 'T', { holdUsed: true })
    const d = suggest(pos, PROFILES.dellacherie).map(keyOf)
    const v = suggest(pos, PROFILES.versus).map(keyOf)
    expect(d).not.toEqual(v)
  })

  it('with a live b2b, versus refuses the chain-breaking single', () => {
    // bottom row missing 3: the T can clear a plain single (breaks b2b)
    // or stack safely on top and keep the chain
    const pos = positionFromRows(['XXX___XXXX'], 'T', { holdUsed: true })
    const ctx = { b2b: true, combo: -1 }
    const top = suggest(pos, PROFILES.versus, { context: ctx })[0]
    expect(top.features.b2bBroken).toBe(0)
    expect(top.features.holesCreated).toBe(0)
    // dellacherie has no b2b concept and takes the eroding clear
    const dTop = suggest(pos, PROFILES.dellacherie, { context: ctx })[0]
    expect(dTop.features.linesCleared).toBe(1)
  })
})
