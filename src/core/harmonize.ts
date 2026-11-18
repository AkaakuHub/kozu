import { degreePitch, mod, resolvePitch, SCALES } from './theory.ts';
import { uid } from './types.ts';
import type { Key, Note } from './types.ts';

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
        pitch: degreePitch(pitch, key),
        velocity: Math.max(1, Math.round(note.velocity * 0.87)),
        origin: 'generated',
        locked: false,
      },
    ];
  });
}
