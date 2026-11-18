import { absolutePosition, valueAt } from './time.ts';
import type { CompiledSong, Project, RenderedNote } from './types.ts';

export function sustainPoints(
  project: Project,
  starts: Map<string, number>,
  breaks: { tick: number; trackId: string }[],
): CompiledSong['sustain'] {
  return [
    ...(project.sustain ?? []).map(({ at, trackId, value }) => ({
      tick: absolutePosition(at, starts),
      trackId,
      value,
    })),
    ...breaks.map(({ tick, trackId }) => ({ tick, trackId, value: 0 })),
  ].sort((a, b) => a.tick - b.tick);
}

export function extendHeldNotes(
  notes: RenderedNote[],
  points: CompiledSong['sustain'],
  end: number,
) {
  const byTrack = new Map<string, { tick: number; end: number }[]>();
  for (const point of points) {
    let holds = byTrack.get(point.trackId);
    const open = holds?.at(-1);
    if (point.value >= 64) {
      if (open?.end === end) continue;
      if (!holds) byTrack.set(point.trackId, (holds = []));
      holds.push({ tick: point.tick, end });
    } else if (open?.end === end) open.end = point.tick;
  }
  for (const note of notes) {
    const holds = byTrack.get(note.trackId);
    if (!holds?.length) continue;
    const hold = valueAt(holds, note.end);
    if (hold.tick <= note.end && note.end < hold.end) note.end = hold.end;
  }
}
