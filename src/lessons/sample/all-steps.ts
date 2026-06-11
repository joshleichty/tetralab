import type { Lesson } from '../../learn/types.ts'

/**
 * The M2 reference lesson: exercises every step primitive so the
 * machine, harness, and (in M3) the player UI all have one canonical
 * fixture. Content is a real micro-arc — wells and holes — but Track A
 * proper (M3) supersedes it as learner-facing material.
 */
export const allSteps: Lesson = {
  id: 'sample/all-steps',
  track: 'sample',
  title: 'Wells & holes (all step kinds)',
  summary: 'One of each step primitive, on a real micro-topic.',
  seed: 1,
  steps: [
    {
      kind: 'prose',
      board: ['XXXXXXXXX_', 'XXXXXXXXX_'],
      caption:
        'Nine columns carry the stack; the last one stays empty. That empty column is the well — line clears come from filling it.',
      shapes: [{ kind: 'column', column: 9, tone: 'focus' }],
    },
    {
      kind: 'demo',
      board: [],
      script: [
        { type: 'I', rot: 0, x: 0 },
        { piece: 'I', actions: ['right', 'hardDrop'] },
      ],
      caption: 'Flat pieces laid side by side keep the surface flat — nothing gets buried.',
    },
    {
      kind: 'guidedMove',
      board: ['XXXXXX__XX', 'XXXXXX__XX'],
      solution: [{ type: 'O', rot: 0, x: 6 }],
      caption: 'The square fits the gap exactly. Drop it in.',
      hint: 'The gap is two wide and two deep — which piece is that?',
      mistakes: [
        {
          match: { type: 'O', rot: 0, x: 0 },
          message: 'Stacking on top leaves the gap open — fill it instead.',
        },
      ],
    },
    {
      kind: 'challenge',
      board: ['XXXXXXXX__', 'XXXXXXXX__'],
      goal: { kind: 'noNewHoles', pieces: 2 },
      caption: 'Place both pieces without burying a single empty cell.',
      hint: 'Fill the corner gap before building anything on top of it.',
      solution: [
        { type: 'O', rot: 0, x: 8 },
        { type: 'I', rot: 0, x: 0 },
      ],
    },
    {
      kind: 'recognition',
      board: ['XXX_XXXXX_', 'XX_XXXXXX_'],
      prompt: 'One empty cell here is already dead — buried under the stack. Tap it.',
      answer: { kind: 'cell', at: [2, 0] },
      hint: 'A cell is only dead if something sits on top of it.',
    },
    {
      kind: 'sandbox',
      board: ['XXXXXXXXX_'],
      caption: 'Free board. Watch the surface as you place — then move on.',
      overlay: 'roughness',
    },
  ],
}
