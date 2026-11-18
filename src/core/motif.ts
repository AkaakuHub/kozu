import { degreePitch, resolvePitch } from './theory.ts';
import type { Key, Note } from './types.ts';

export type MotifTransform = 'invert' | 'double' | 'half';

export function transformMotif(
  notes: Note[],
  from: number,
  end: number,
  limit: number,
  transform: MotifTransform,
  keyAt: (at: number) => Key,
): Note[] {
  const reference = notes
    .filter((note) => note.at >= from && note.at < end)
    .toSorted((a, b) => a.at - b.at)[0];
  if (!reference) return notes;
  const center = resolvePitch(reference.pitch, keyAt(reference.at));
  const factor = transform === 'double' ? 2 : transform === 'half' ? 0.5 : 1;
  return notes.map((note) => {
    if (note.at < from || note.at >= end) return note;
    const at = from + Math.round((note.at - from) * factor);
    const duration = Math.max(1, Math.round(note.duration * factor));
    if (at + duration > limit) throw new Error('変形した音符がパートの終わりを越えます。');
    const midi = resolvePitch(note.pitch, keyAt(note.at));
    const pitch = transform === 'invert' ? 2 * center - midi : midi;
    if (pitch < 0 || pitch > 127) throw new Error('反行すると音高がMIDI範囲外になります。');
    return {
      ...note,
      at,
      duration,
      pitch:
        note.pitch.kind === 'absolute'
          ? { kind: 'absolute', midi: pitch }
          : degreePitch(pitch, keyAt(at)),
      origin: 'manual',
      locked: true,
    };
  });
}
