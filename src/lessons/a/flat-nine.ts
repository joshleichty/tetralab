import type { Lesson } from '../../learn/types.ts'

/** A1 — the flat nine. Sources: winternebs general, four.lol/stacking/tetris. */
export const flatNine: Lesson = {
  id: 'a/flat-nine',
  track: 'a',
  title: 'the flat nine',
  summary: 'nine columns carry the stack — one stays empty',
  seed: 11,
  steps: [
    {
      kind: 'prose',
      board: ['XXXXXXXXX_', 'XXXXXXXXX_', 'XXXXXXXXX_', 'XXXXXXXXX_'],
      caption:
        'nine columns carry the stack. the tenth stays empty — the well. every quad you will ever score drops down that column.',
      shapes: [{ kind: 'column', column: 9, tone: 'focus' }],
    },
    {
      kind: 'demo',
      board: ['XXXX__XXX_', 'XXXX__XXX_'],
      script: [{ type: 'O', rot: 0, x: 4 }],
      caption: 'keep the surface level and the well untouched. the square completes the nine.',
    },
    {
      kind: 'guidedMove',
      board: ['XXXXXXX___', 'XXXXXXX___'],
      solution: [{ type: 'O', rot: 0, x: 7 }],
      caption: 'complete the nine — and not one cell in the well.',
      hint: 'two columns are missing from the nine. the well is not one of them.',
      mistakes: [
        {
          match: { type: 'O', rot: 0, x: 8 },
          message: 'that fills the well. the well stays empty.',
        },
      ],
    },
    {
      kind: 'challenge',
      board: ['XXXXXXXXX_'],
      goal: { kind: 'wellPure', column: 9, pieces: 4 },
      caption: 'four pieces, zero cells in column nine. build anywhere else.',
      hint: 'flat pieces against the left wall leave the well alone by a mile.',
      solution: [
        { type: 'I', rot: 0, x: 0 },
        { type: 'I', rot: 0, x: 4 },
        { type: 'O', rot: 0, x: 0 },
        { type: 'O', rot: 0, x: 4 },
      ],
    },
    {
      kind: 'recognition',
      board: ['XXXXXXXX__', 'XXXXXXXXX_', 'XXXXXXXXX_'],
      prompt: 'this stack already leans flat toward the right. tap the column that should be its well.',
      answer: { kind: 'column', column: 9 },
      hint: 'the well wants the column the stack is already avoiding.',
    },
    {
      kind: 'prose',
      board: ['XXXXXXXXX_', 'XXXXXXXXX_', 'XXXXXXXXX_', 'XXXXXXXXX_'],
      caption:
        'keep nine flat, keep one clean, and the quad is always one piece away. that is the whole discipline.',
      shapes: [{ kind: 'ghost', placement: { type: 'I', rot: 1, x: 7 }, tone: 'focus' }],
    },
  ],
}
