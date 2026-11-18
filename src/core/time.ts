import { PPQ } from './types.ts';
import type { Key, KeyPoint, MeterPoint, Position, Project, TempoPoint } from './types.ts';
export function sectionStarts(project: Project): Map<string, number> {
  const map = new Map<string, number>();
  let tick = 0;
  for (const section of project.sections) {
    map.set(section.id, tick);
    tick += section.length;
  }
  return map;
}
export function absolutePosition(at: Position, starts: Map<string, number>): number {
  const start = starts.get(at.sectionId);
  if (start === undefined) throw new Error(`参照先のパートがありません: ${at.sectionId}`);
  return start + at.tick;
}
export function timeline(project: Project): {
  tempos: TempoPoint[];
  keys: KeyPoint[];
  meters: MeterPoint[];
} {
  const starts = sectionStarts(project);
  const tempos: TempoPoint[] = [{ tick: 0, bpm: project.initialTempo }];
  const changes = project.tempoChanges
    .map((c) => ({ ...c, tick: absolutePosition(c.at, starts) }))
    .sort((a, b) => a.tick - b.tick);
  for (let i = 0; i < changes.length; i++) {
    const c = changes[i]!;
    const next = changes[i + 1]?.tick ?? Infinity;
    tempos.push({ tick: c.tick, bpm: c.bpm });
    if (c.ramp) {
      const duration = c.ramp.duration;
      const step = PPQ / 32;
      // Sample in tick space. Playback and MIDI use this identical staircase, not two different clocks.
      for (let d = step; d < duration && c.tick + d < next; d += step)
        tempos.push({ tick: c.tick + d, bpm: c.bpm + ((c.ramp.toBpm - c.bpm) * d) / duration });
      if (c.tick + duration < next) tempos.push({ tick: c.tick + duration, bpm: c.ramp.toBpm });
    }
  }
  const keys: KeyPoint[] = [
    { tick: 0, key: project.initialKey },
    ...project.keyChanges.map((c) => ({ tick: absolutePosition(c.at, starts), key: c.key })),
  ];
  const meters: MeterPoint[] = [
    { tick: 0, ...project.initialMeter },
    ...project.meterChanges.map((c) => ({
      tick: absolutePosition(c.at, starts),
      numerator: c.numerator,
      denominator: c.denominator,
    })),
  ];
  return { tempos: dedupe(tempos), keys: dedupe(keys), meters: dedupe(meters) };
}
function dedupe<T extends { tick: number }>(events: T[]): T[] {
  return [...new Map(events.sort((a, b) => a.tick - b.tick).map((e) => [e.tick, e])).values()];
}
export function valueAt<T extends { tick: number }>(events: T[], tick: number): T {
  let lo = 0,
    hi = events.length - 1;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (events[mid]!.tick <= tick) lo = mid;
    else hi = mid - 1;
  }
  return events[lo]!;
}
export function keyAt(project: Project, position: Position): Key {
  return valueAt(timeline(project).keys, absolutePosition(position, sectionStarts(project))).key;
}
export function ticksToSeconds(tick: number, tempos: TempoPoint[]): number {
  let seconds = 0;
  for (let i = 0; i < tempos.length; i++) {
    const p = tempos[i]!;
    if (p.tick >= tick) break;
    const end = Math.min(tick, tempos[i + 1]?.tick ?? tick);
    seconds += (((end - p.tick) / PPQ) * 60) / p.bpm;
  }
  return seconds;
}
export function secondsToTicks(seconds: number, tempos: TempoPoint[]): number {
  let remaining = seconds;
  for (let i = 0; i < tempos.length; i++) {
    const p = tempos[i]!;
    const end = tempos[i + 1]?.tick ?? Infinity;
    const span = (((end - p.tick) / PPQ) * 60) / p.bpm;
    if (remaining <= span) return p.tick + ((remaining * p.bpm) / 60) * PPQ;
    remaining -= span;
  }
  return 0;
}
