/**
 * The registry contract (spec training-core §2, headless-first
 * invariant): every shipped lesson validates statically and completes
 * via its own authored solutions, with zero DOM — a lesson that can't
 * pass itself never reaches a learner.
 */
import { describe, expect, it } from 'vitest'
import { LESSONS } from '../lessons/index'
import { completeLesson, validateLesson } from './harness'
import { fumenToRows } from './fumen'

describe('lesson registry', () => {
  it('has lessons and unique ids', () => {
    expect(LESSONS.length).toBeGreaterThan(0)
    expect(new Set(LESSONS.map((l) => l.id)).size).toBe(LESSONS.length)
  })

  for (const lesson of LESSONS) {
    describe(lesson.id, () => {
      it('validates statically', () => {
        validateLesson(lesson)
      })

      it('completes via its authored solutions', () => {
        const m = completeLesson(lesson)
        expect(m.status).toBe('complete')
        for (const r of m.records) {
          expect(['seen', 'solved']).toContain(r.phase) // never revealed by its own solutions
        }
      })
    })
  }
})

describe('headless invariant', () => {
  it('the lesson layer never imports React or the DOM-facing app layers', () => {
    const sources = {
      ...import.meta.glob('./**/*.ts', { query: '?raw', import: 'default', eager: true }),
      ...import.meta.glob('../lessons/**/*.ts', { query: '?raw', import: 'default', eager: true }),
    } as Record<string, string>
    expect(Object.keys(sources).length).toBeGreaterThan(5)
    for (const [path, src] of Object.entries(sources)) {
      expect(src, path).not.toMatch(/from 'react'|from "react"/)
      expect(src, path).not.toMatch(/\.\.\/(ui|render|audio|game|input)\//)
    }
  })
})

describe('fumen import', () => {
  it('decodes a fumen page to BoardSpec rows', () => {
    // encoded from ['LLL_______', 'XXXXXXXXX_'] (round-tripped in dev)
    expect(fumenToRows('v115@bhilGeI8AeAgH')).toEqual(['LLL_______', 'XXXXXXXXX_'])
  })

  it('rejects out-of-range pages', () => {
    expect(() => fumenToRows('v115@bhilGeI8AeAgH', 3)).toThrow(/page/)
  })
})
