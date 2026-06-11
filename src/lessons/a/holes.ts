import type { Lesson } from '../../learn/types.ts'

/** A3 — don't make holes. Sources: winternebs general, four.lol/stacking. */
export const holes: Lesson = {
  id: 'a/holes',
  track: 'a',
  title: 'never bury a cell',
  summary: 'a covered empty cell is dead weight until you dig it out',
  seed: 13,
  steps: [
    {
      kind: 'prose',
      board: ['XXX_XXXXX_', 'XX_XXXXXX_'],
      caption:
        'the marked cell is dead: empty, but sealed under the stack. to use that row you must first clear every row above it. that is the price of one careless drop.',
      shapes: [{ kind: 'cells', cells: [[2, 0]], tone: 'bad' }],
    },
    {
      kind: 'demo',
      board: ['X_XXXXXXX_'],
      script: [{ type: 'I', rot: 0, x: 0 }],
      caption: 'watch the flat piece bridge the gap and seal it shut. one drop, one dead cell.',
      shapes: [{ kind: 'cells', cells: [[1, 0]], tone: 'bad' }],
    },
    {
      kind: 'guidedMove',
      board: ['X_XXXXXXX_'],
      solution: [{ type: 'I', rot: 1, x: -1 }],
      caption: 'same board, same piece. place the i without burying the gap.',
      hint: 'stand it up.',
      mistakes: [
        {
          match: { type: 'I', rot: 0, x: 0 },
          message: 'that is the seal again — the gap dies underneath.',
        },
      ],
    },
    {
      kind: 'challenge',
      board: ['XX__XXXXX_', 'XXXXXXXXX_'],
      goal: { kind: 'noNewHoles', pieces: 4 },
      caption: 'four pieces, zero new holes. every piece must land flush on the floor it covers.',
      hint: 'squares only ever sit flush on pairs of equal columns.',
      solution: [
        { type: 'O', rot: 0, x: 2 },
        { type: 'O', rot: 0, x: 0 },
        { type: 'O', rot: 0, x: 4 },
        { type: 'O', rot: 0, x: 6 },
      ],
    },
    {
      kind: 'recognition',
      board: ['XXXX__XXX_', 'X_XXXXXXX_'],
      prompt: 'one of these empty cells is already dead. tap it.',
      answer: { kind: 'cell', at: [1, 0] },
      hint: 'a cell is only dead if something sits on top of it.',
    },
    {
      kind: 'prose',
      board: ['XXXXXXXXX_'],
      caption:
        'holes are borrowed time — each one costs you the rows above it. the rule is plain: if you cannot see the floor, do not drop it.',
    },
  ],
}
