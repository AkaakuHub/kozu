import { degreePitch, resolvePitch } from './theory.ts';
import { uid } from './types.ts';
import type { Key, Note, RenderedNote } from './types.ts';

export function makeNote(at: number, duration: number, midi: number): Note {
  return {
    id: uid('note'),
    at,
    duration,
    pitch: { kind: 'absolute', midi },
    velocity: 88,
    origin: 'manual',
    locked: true,
  };
}

export function materializeNotes(
  notes: RenderedNote[],
  trackId: string,
  start: number,
  length: number,
): Note[] {
  return notes
    .filter((n) => n.trackId === trackId && n.start >= start && n.start < start + length)
    .map((n) => ({
      ...makeNote(n.start - start, Math.min(n.end - start, length) - (n.start - start), n.pitch),
      velocity: n.velocity,
    }));
}

export function moveNote(
  note: Note,
  position: { at: number; midi: number },
  length: number,
  keyFor: (at: number) => Key,
): Partial<Note> {
  const at = Math.max(0, Math.min(length - note.duration, position.at));
  const midi = Math.max(0, Math.min(127, position.midi));
  return {
    at,
    pitch:
      note.pitch.kind === 'absolute' ? { kind: 'absolute', midi } : degreePitch(midi, keyFor(at)),
  };
}

export function drawnNoteSpan(anchor: number, pointer: number, step: number, limit: number) {
  const edge = Math.max(0, Math.min(limit, Math.round(pointer / step) * step));
  const at = Math.min(anchor, edge);
  return { at, duration: Math.min(limit - at, Math.max(step, Math.abs(edge - anchor))) };
}

export function placePhrase(notes: Note[], at: number, limit: number): Note[] {
  if (!notes.length) return [];
  const first = notes.reduce((earliest, note) => Math.min(earliest, note.at), Infinity);
  if (at < 0 || notes.some((note) => at + note.at - first + note.duration > limit)) return [];
  return notes.map((note) => ({
    ...note,
    at: at + note.at - first,
    id: uid('note'),
    origin: 'manual',
    locked: true,
  }));
}

export function copyPhrase(notes: Note[], keyAt: (at: number) => Key): Note[] {
  return notes.map((note) => ({
    ...note,
    pitch: { kind: 'absolute', midi: resolvePitch(note.pitch, keyAt(note.at)) },
  }));
}
