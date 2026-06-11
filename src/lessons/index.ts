import type { Lesson } from '../learn/types.ts'
import { bumpiness } from './a/bumpiness.ts'
import { dependencies } from './a/dependencies.ts'
import { flatNine } from './a/flat-nine.ts'
import { holes } from './a/holes.ts'
import { tetrisReady } from './a/tetris-ready.ts'
import { wellChoice } from './a/well-choice.ts'
import { allSteps } from './sample/all-steps.ts'

/**
 * The lesson registry. Every lesson shipped to learners is exported here,
 * and the harness suite (src/learn/lessons.test.ts) validates and
 * auto-completes each one — registration is what puts a lesson under CI.
 * Order within a track is the track's teaching order. The sample lesson
 * stays registered (it exercises every step kind) but its track has no
 * TrackMeta, so the UI never lists it.
 */
export const LESSONS: Lesson[] = [
  flatNine,
  bumpiness,
  holes,
  dependencies,
  wellChoice,
  tetrisReady,
  allSteps,
]
