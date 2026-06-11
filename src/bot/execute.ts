import type { Engine } from '../engine/engine.ts'
import { STEP_MS } from '../engine/replay.ts'
import type { InputPlan } from './types.ts'

/**
 * The canonical plan executor — the one true semantics of an InputPlan.
 * Drives a real Engine through applyAction/tick on the STEP_MS grid;
 * tests, demo bots, and future drivers all execute plans only through
 * this function. 'sonicDrop' descends via soft drop (one tick with
 * sdf >= INSTANT_SDF; finite sdf just takes more ticks).
 */
export function executePlan(engine: Engine, plan: InputPlan): void {
  for (const step of plan.steps) {
    if (step === 'sonicDrop') {
      engine.applyAction('softDropOn')
      let guard = 0
      while (
        engine.active !== null &&
        engine.canFit(engine.active.x, engine.active.y + 1, engine.active.rot) &&
        guard++ < 10_000
      ) {
        engine.tick(STEP_MS)
      }
      engine.applyAction('softDropOff')
    } else {
      engine.applyAction(step)
      engine.tick(STEP_MS)
    }
  }
}
