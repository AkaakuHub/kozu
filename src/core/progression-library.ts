import { keyAt, sectionStarts, timeline, valueAt } from './time.ts';
import { degreePitch } from './theory.ts';
import { uid } from './types.ts';
import type { Pitch, Project, Section } from './types.ts';

export interface ProgressionReference {
  id: string;
  projectId: string;
  revision: string;
  section_id: string;
  title: string;
  artist: string;
  source: string;
  note: string;
}

export function referenceKey(project: Project, section: Section) {
  return keyAt(project, { sectionId: section.id, tick: 0 });
}

export function fitProgression(project: Project, source: Section, destinationLength: number) {
  const keys = timeline(project).keys;
  const start = sectionStarts(project).get(source.id)!;
  return source.chords.flatMap((chord) => {
    const at = Math.round((chord.at * destinationLength) / source.length);
    const end = Math.round(((chord.at + chord.duration) * destinationLength) / source.length);
    if (at >= end) return [];
    const key = valueAt(keys, start + chord.at).key;
    const pitch = (p: Pitch) => (p.kind === 'degree' ? p : degreePitch(p.midi, key));
    return [
      {
        ...chord,
        id: uid('chord'),
        at,
        duration: end - at,
        root: pitch(chord.root),
        bass: chord.bass && pitch(chord.bass),
      },
    ];
  });
}
