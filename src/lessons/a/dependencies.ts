import type { Lesson } from '../../learn/types.ts'

/** A4 — no piece dependencies. Sources: winternebs general, four.lol/stacking. */
export const dependencies: Lesson = {
  id: 'a/dependencies',
  track: 'a',
  title: 'no piece dependencies',
  summary: 'never build a surface only one piece can save',
  seed: 14,
  steps: [
    {
      kind: 'prose',
      board: ['XXXX_XXXX_', 'XXXX_XXXX_', 'XXXX_XXXX_'],
      caption:
        'only the upright i fills this slot flush — and the bag promises just one i every seven pieces. you have made a specific piece mandatory. that is a dependency.',
      shapes: [{ kind: 'column', column: 4, tone: 'bad' }],
    },
    {
      kind: 'recognition',
      board: ['XXXX_XXXX_', 'XXXX_XXXX_', 'XXXX_XXXX_'],
      prompt: 'how many i-dependencies can a stack afford at once?',
      answer: {
        kind: 'choice',
        choices: [
          'one — the well itself',
          'none at all, ever',
          'as many as you like',
        ],
        correct: 0,
      },
      hint: 'one column in every healthy stack already waits for the i.',
    },
    {
      kind: 'demo',
      board: ['XXXX_XXXX_', 'XXXX_XXXX_', 'XXXX_XXXX_'],
      script: [{ type: 'I', rot: 1, x: 2 }],
      caption:
        'it resolves — but you spent the bag’s only i on a rescue. the well already plays that role; a second pit means waiting on luck.',
    },
    {
      kind: 'guidedMove',
      board: ['XXXXXXX_X_', 'XXXXXXX_X_'],
      solution: [{ type: 'I', rot: 1, x: 5 }],
      caption: 'a second pit has appeared. resolve it now, before the stack grows over it.',
      hint: 'the only flush answer stands upright.',
      mistakes: [
        {
          match: { type: 'I', rot: 0, x: 4 },
          message: 'sealed — that pit is now two dead cells.',
        },
      ],
    },
    {
      kind: 'challenge',
      board: ['XXXXXX__X_'],
      goal: { kind: 'noNewHoles', pieces: 3 },
      caption:
        'three pieces, no new holes — and notice you never need to make a shape only one piece solves.',
      hint: 'fill the pair gap with the piece shaped like it.',
      solution: [
        { type: 'O', rot: 0, x: 6 },
        { type: 'O', rot: 0, x: 0 },
        { type: 'I', rot: 0, x: 2 },
      ],
    },
    {
      kind: 'prose',
      board: ['XXXXXXXXX_'],
      caption:
        'one dependency is the deal you have already made — the well. do not sign a second one.',
    },
  ],
}
