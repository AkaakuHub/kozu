import { createSection } from './presets.ts';
import { uid } from './types.ts';
import type { Project } from './types.ts';

export function applyMidiMarkers(project: Project, imported: { tick: number; label: string }[]) {
  if (!imported.length) return;
  const original = project.sections[0]!;
  const notes = Object.values(original.notes)
    .flat()
    .sort((a, b) => a.at - b.at);
  const markers = imported.toSorted((a, b) => a.tick - b.tick);
  const seen = new Set<string>();
  const boundaries = [{ tick: 0, label: original.name }];
  const annotations: typeof markers = [];
  let cursor = 0;
  let noteEnd = 0;
  let lastBoundary = -1;
  for (const marker of markers) {
    const identity = JSON.stringify([marker.tick, marker.label]);
    if (seen.has(identity)) continue;
    seen.add(identity);
    while (cursor < notes.length && notes[cursor]!.at < marker.tick) {
      const note = notes[cursor++]!;
      noteEnd = Math.max(noteEnd, note.at + note.duration);
    }
    if (
      marker.tick !== lastBoundary &&
      marker.tick < original.length &&
      noteEnd <= marker.tick &&
      boundaries.length < 128
    ) {
      if (marker.tick === 0) boundaries[0] = marker;
      else boundaries.push(marker);
      lastBoundary = marker.tick;
    } else annotations.push(marker);
  }
  const end = Math.max(original.length, (annotations.at(-1)?.tick ?? -1) + 1);
  const layout = boundaries.map(({ tick, label }, index) => ({
    start: tick,
    section: createSection(label, (boundaries[index + 1]?.tick ?? end) - tick, null),
  }));
  const at = (tick: number) => {
    const { section, start } = layout.findLast((point) => point.start <= tick)!;
    return { section, tick: tick - start };
  };
  for (const track of project.tracks) {
    if (track.kind === 'drums') for (const { section } of layout) section.notes[track.id] = [];
    for (const note of original.notes[track.id] ?? []) {
      const target = at(note.at);
      (target.section.notes[track.id] ??= []).push({ ...note, at: target.tick });
    }
  }
  const position = (tick: number) => {
    const target = at(tick);
    return { sectionId: target.section.id, tick: target.tick };
  };
  for (const event of [...project.tempoChanges, ...project.keyChanges, ...project.meterChanges])
    event.at = position(event.at.tick);
  if (annotations.length)
    project.markers = annotations.map(({ tick, label }) => ({
      id: uid('marker'),
      at: position(tick),
      label,
    }));
  project.sections = layout.map(({ section }) => section);
}
