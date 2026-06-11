import type { PieceType } from './types.ts'
import { PIECE_TYPES } from './pieces.ts'

/** mulberry32 — small, fast, deterministic PRNG */
export function createRng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** 7-bag randomizer: every run of 7 pieces contains each tetromino exactly once */
export class SevenBag {
  private rng: () => number
  private bag: PieceType[] = []

  constructor(seed: number) {
    this.rng = createRng(seed)
  }

  next(): PieceType {
    if (this.bag.length === 0) this.refill()
    return this.bag.pop()!
  }

  private refill() {
    const pieces = [...PIECE_TYPES]
    for (let i = pieces.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1))
      ;[pieces[i], pieces[j]] = [pieces[j], pieces[i]]
    }
    this.bag = pieces
  }
}
