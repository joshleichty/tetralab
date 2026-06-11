import type { Lesson } from '../../learn/types.ts'

/** A5 — 9-0 vs 6-3 wells. Sources: winternebs sprint, four.lol/stacking/tetris. */
export const wellChoice: Lesson = {
  id: 'a/well-choice',
  track: 'a',
  title: '9-0 or 6-3',
  summary: 'where the well lives changes how the stack plays',
  seed: 15,
  steps: [
    {
      kind: 'prose',
      board: ['XXXXXXXXX_', 'XXXXXXXXX_', 'XXXXXXXXX_'],
      caption:
        'the 9-0: everything left, well on the wall. one neighbour, fewest ways to spill into it — the simplest stack to keep honest.',
      shapes: [{ kind: 'column', column: 9, tone: 'focus' }],
    },
    {
      kind: 'prose',
      board: ['XXXXXX_XXX', 'XXXXXX_XXX', 'XXXXXX_XXX'],
      caption:
        'the 6-3: well three columns from the edge. now both flanks catch overhangs and the awkward s and z always have a side that fits. more upkeep, more options.',
      shapes: [{ kind: 'column', column: 6, tone: 'focus' }],
    },
    {
      kind: 'recognition',
      board: ['XXXXXXXXX_', 'XXXXXXXXX_'],
      prompt: 'you are still learning to keep a stack clean. which well comes first?',
      answer: {
        kind: 'choice',
        choices: [
          'the edge well — fewest ways to leak',
          'the centre well — maximum options',
          'no well at all',
        ],
        correct: 0,
      },
    },
    {
      kind: 'guidedMove',
      board: ['XXXXXX_XXX', 'XXXXXX_XXX'],
      solution: [{ type: 'O', rot: 0, x: 4 }],
      caption: 'build beside a centre well without touching it.',
      hint: 'flush means both columns under the square are the same height.',
      mistakes: [
        {
          match: { type: 'O', rot: 0, x: 6 },
          message: 'the well just became two holes.',
        },
      ],
    },
    {
      kind: 'challenge',
      board: ['XXXXXX_XXX'],
      goal: { kind: 'wellPure', column: 6, pieces: 3 },
      caption: 'three pieces around a centre well — not one cell in column six.',
      hint: 'squares on matching pairs; there is room on both flanks.',
      solution: [
        { type: 'O', rot: 0, x: 0 },
        { type: 'O', rot: 0, x: 2 },
        { type: 'O', rot: 0, x: 4 },
      ],
    },
    {
      kind: 'prose',
      board: ['XXXXXXXXX_'],
      caption:
        'start on the edge. graduate to 6-3 when your flat nine has stopped leaking — not before.',
    },
  ],
}
