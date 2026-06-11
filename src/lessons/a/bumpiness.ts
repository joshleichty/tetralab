import type { Lesson } from '../../learn/types.ts'

/** A2 — bumpiness. Sources: winternebs general, four.lol/stacking. */
export const bumpiness: Lesson = {
  id: 'a/bumpiness',
  track: 'a',
  title: 'keep it flat',
  summary: 'flat surfaces accept every piece — spikes refuse most',
  seed: 12,
  steps: [
    {
      kind: 'prose',
      board: ['_X______X_', 'XX_X_XX_X_', 'XXXX_XXXX_'],
      caption:
        'every spike and crevice on this surface narrows what fits next. a flat surface accepts all seven pieces; this one argues with most of them.',
    },
    {
      kind: 'recognition',
      board: ['XX_XXXXXX_', 'XX_XXXXXX_', 'XXXXXXXXX_'],
      prompt: 'one narrow pit here was not planned. tap its column.',
      answer: { kind: 'column', column: 2 },
      hint: 'the edge column is the well — that one is on purpose.',
    },
    {
      kind: 'demo',
      board: ['XX_XXXXXX_', 'XX_XXXXXX_', 'XXXXXXXXX_'],
      script: [{ type: 'I', rot: 1, x: 0 }],
      caption:
        'even the only piece that fits — the upright i — overfills it by two. narrow pits always cost more than they hold.',
    },
    {
      kind: 'guidedMove',
      board: ['XXXX__XXX_', 'XXXX__XXX_'],
      solution: [{ type: 'O', rot: 0, x: 4 }],
      caption: 'one placement makes this surface perfectly level. find it.',
      hint: 'fill the lowest ground first — never build the towers higher.',
      mistakes: [
        {
          match: { type: 'O', rot: 0, x: 0 },
          message: 'that raises a tower and leaves the gap. low ground first.',
        },
      ],
    },
    {
      kind: 'challenge',
      board: ['XXX____XX_', 'XXXXXXXXX_'],
      goal: { kind: 'maxBumpiness', value: 0, ignoreColumn: 9, pieces: 3 },
      caption: 'level the whole surface. three pieces if you need them — one is cleaner.',
      hint: 'the dip is exactly four wide.',
      solution: [{ type: 'I', rot: 0, x: 3 }],
    },
    {
      kind: 'recognition',
      board: ['XXXXXXXXX_', 'XXXXXXXXX_'],
      prompt: 'a flat surface is strong because…',
      answer: {
        kind: 'choice',
        choices: [
          'any piece can rest on it without making holes',
          'it scores more points per line',
          'it makes the well deeper',
        ],
        correct: 0,
      },
    },
    {
      kind: 'prose',
      board: ['XXXXXXXXX_'],
      caption:
        'bumpiness is a tax you pay on the next piece. keep the roof level and every piece has a home.',
    },
  ],
}
