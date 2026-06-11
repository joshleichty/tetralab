import type { Lesson } from '../../learn/types.ts'

/** A6 — counting to four. Sources: winternebs sprint, four.lol/stacking/tetris. */
export const tetrisReady: Lesson = {
  id: 'a/tetris-ready',
  track: 'a',
  title: 'counting to four',
  summary: 'know the moment the well is worth an i',
  seed: 16,
  steps: [
    {
      kind: 'prose',
      board: ['XXXXXXXXX_', 'XXXXXXXXX_', 'XXXXXXXXX_', 'XXXXXXXXX_'],
      caption:
        'count the well: four full rows beside it. that is tetris-ready — the i pays out the moment it arrives. the count is the only number a stacker tracks.',
      shapes: [
        { kind: 'column', column: 9, tone: 'focus' },
        { kind: 'ghost', placement: { type: 'I', rot: 1, x: 7 }, tone: 'focus' },
      ],
    },
    {
      kind: 'recognition',
      board: ['XXXXXXXXX_', 'XXXXXXXXX_', 'XXXXXXXXX_'],
      prompt: 'the well is three deep. drop the i down it now and you get…',
      answer: {
        kind: 'choice',
        choices: [
          'a triple — one row short of the payout',
          'a quad anyway',
          'nothing at all',
        ],
        correct: 0,
      },
      hint: 'a quad needs four complete rows, no fewer.',
    },
    {
      kind: 'demo',
      board: ['XXXXXXXXX_', 'XXXXXXXXX_', 'XXXXXXXXX_', 'XXXXXXXXX_'],
      script: [{ type: 'I', rot: 1, x: 7 }],
      caption: 'four deep, one piece, four lines. this is what the whole stack was for.',
    },
    {
      kind: 'guidedMove',
      board: ['XXXXXXXXX_', 'XXXXXXXXX_', 'XXXXXXXXX_'],
      solution: [{ type: 'I', rot: 0, x: 0 }],
      caption: 'the well is only three deep and the i is here early. spend it wisely.',
      hint: 'do not cash out short — bank it flat and keep building.',
      mistakes: [
        {
          match: { type: 'I', rot: 1, x: 7 },
          message: 'three deep — that is a triple and a broken count. bank it flat instead.',
        },
      ],
    },
    {
      kind: 'challenge',
      board: ['XXXXXXXXX_', 'XXXXXXXXX_', 'XXXXXXXXX_', 'XXXXXXXXX_'],
      goal: { kind: 'clearLines', n: 4, label: 'QUAD' },
      caption: 'it is ready. take the quad.',
      solution: [{ type: 'I', rot: 1, x: 7 }],
    },
    {
      kind: 'prose',
      board: [],
      caption:
        'that is the loop: keep nine flat, count the well to four, collect. everything after this track is just doing it faster.',
    },
  ],
}
