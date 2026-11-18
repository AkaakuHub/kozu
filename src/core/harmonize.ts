import { degreePitch, mod, resolvePitch, SCALES } from './theory.ts';
import { uid } from './types.ts';
import type { Key, Note, Project } from './types.ts';
import { defaultProgram } from './instruments.ts';
import { createTrack } from './presets.ts';
import { sectionStarts, timeline, valueAt } from './time.ts';

export function harmonize(
  notes: Note[],
  interval: 3 | 6,
  below: boolean,
  keyAt: (tick: number) => Key,
): Note[] {
  return notes.flatMap((note) => {
    const key = keyAt(note.at);
    const midi = resolvePitch(note.pitch, key);
    const degree = degreePitch(midi, key);
    const offset = (interval - 1) * (below ? -1 : 1);
    const step = degree.degree - 1 + offset;
    const pitch =
      (degree.octave + 1 + Math.floor(step / 7)) * 12 + key.tonic + SCALES[key.mode][mod(step, 7)]!;
    if (pitch < 0 || pitch > 127) return [];
    return [
      {
        ...note,
        id: uid('note'),
        pitch: { kind: 'absolute', midi: pitch },
        velocity: Math.max(1, Math.round(note.velocity * 0.87)),
        origin: 'generated',
        locked: false,
      },
    ];
  });
}

export function applyHarmony(project: Project, sourceId: string, interval: 3 | 6, below: boolean) {
  const source = project.tracks.find((track) => track.id === sourceId);
  if (!source || source.kind === 'drums') return;
  const starts = sectionStarts(project);
  const { keys } = timeline(project);
  const clips = project.sections.map((section) => {
    const start = starts.get(section.id)!;
    return harmonize(
      section.notes[sourceId] ?? [],
      interval,
      below,
      (tick) => valueAt(keys, start + tick).key,
    );
  });
  let track = project.tracks.find((track) => track.harmonySource === sourceId);
  if (!track) {
    if (!clips.some((clip) => clip.length)) return;
    track = createTrack('melody', `${source.name.slice(0, 195)} ハモリ`);
    track.harmonySource = sourceId;
    const program = source.program ?? defaultProgram(source);
    if (program !== undefined) track.program = program;
    project.tracks.push(track);
  }
  const id = track.id;
  project.sections.forEach((section, index) => {
    const original = section.notes[id] ?? [];
    const preserved = original.filter((note) => note.locked || note.origin !== 'generated');
    const generated = new Map(
      original
        .filter((note) => !note.locked && note.origin === 'generated')
        .map((note) => [noteKey(note), note]),
    );
    const next = clips[index]!.filter(
      (note) =>
        !preserved.some(
          (edit) => edit.at < note.at + note.duration && note.at < edit.at + edit.duration,
        ),
    ).map((note) => {
      const key = noteKey(note);
      const previous = generated.get(key);
      generated.delete(key);
      return previous ?? note;
    });
    if (next.length || preserved.length)
      section.notes[id] = [...preserved, ...next].sort((a, b) => a.at - b.at);
    else delete section.notes[id];
  });
}

function noteKey(note: Note) {
  return `${note.at}:${note.duration}:${note.velocity}:${note.pitch.kind === 'absolute' ? note.pitch.midi : note.id}`;
}
