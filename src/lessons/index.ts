import type { Lesson } from '../learn/types.ts'
import { allSteps } from './sample/all-steps.ts'

/**
 * The lesson registry. Every lesson shipped to learners is exported here,
 * and the harness suite (src/learn/lessons.test.ts) validates and
 * auto-completes each one — registration is what puts a lesson under CI.
 */
export const LESSONS: Lesson[] = [allSteps]
