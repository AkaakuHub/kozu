import type { Pattern } from './types.ts';

interface Hit {
  pitch: number;
  velocity: number;
}
const kick = (velocity = 95): Hit => ({ pitch: 36, velocity });
const snare = (velocity = 90): Hit => ({ pitch: 38, velocity });
const hat = (velocity = 54, open = false): Hit => ({ pitch: open ? 46 : 42, velocity });

export function drumHits(pattern: Pattern, beat: number): Hit[] {
  const hits: Hit[] = [];
  if (pattern === 'trap') {
    if (beat % 0.5 === 0 || (beat >= 3.5 && beat % 0.125 === 0))
      hits.push(hat(beat % 1 === 0 ? 64 : 43));
    if (beat === 0 || beat === 1.75 || beat === 2.5 || beat === 3.25) hits.push(kick());
    if (beat === 2) hits.push(snare(99));
    return hits;
  }
  if (beat % 0.25 !== 0) return hits;
  if (pattern === 'twoStep') {
    if (beat % 0.5 === 0) hits.push(hat(beat % 1 === 0 ? 52 : 71, beat % 1 === 0.5));
    if (beat === 0 || beat === 1.75 || beat === 2.5 || beat === 3.75) hits.push(kick());
    if (beat === 1 || beat === 3) hits.push(snare());
    return hits;
  }
  if (pattern === 'doubletime' || beat % 0.5 === 0) hits.push(hat(beat % 1 === 0 ? 65 : 46));
  if (pattern === 'fourOnFloor' || pattern === 'doubletime') {
    if (beat % 1 === 0) hits.push(kick());
  } else if (beat === 0 || (pattern !== 'halftime' && beat === 2.5)) hits.push(kick());
  if (
    pattern === 'halftime'
      ? beat === 2
      : pattern === 'doubletime'
        ? beat % 1 === 0.5
        : beat === 1 || beat === 3
  )
    hits.push(snare());
  return hits;
}
