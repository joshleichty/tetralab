/**
 * Track metadata for the Learn surface. A track listed here appears in
 * the UI; lessons whose `track` has no entry (e.g. `sample`) stay
 * CI-only fixtures.
 */
export interface TrackMeta {
  id: string
  title: string
  tagline: string
}

export const TRACKS: TrackMeta[] = [
  {
    id: 'a',
    title: 'stacking & wells',
    tagline: 'the shape of a stack that never chokes',
  },
]
