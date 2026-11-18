import { compile } from './compile.ts';
import { resolvePitch } from './theory.ts';
import { sectionStarts, timeline, valueAt } from './time.ts';
import { clone, uid } from './types.ts';
import type { Effect, Note, Position, Project, RenderedNote, Track } from './types.ts';

function render(project: Project) {
  const song = compile(project, 'preview');
  const issue = song.diagnostics.find(({ severity }) => severity === 'error');
  if (issue) throw new Error(issue.message);
  return song.notes;
}

function notesByTrack(notes: RenderedNote[]) {
  const tracks = new Map<string, RenderedNote[]>();
  for (const note of notes) {
    const list = tracks.get(note.trackId);
    if (list) list.push(note);
    else tracks.set(note.trackId, [note]);
  }
  return tracks;
}

function noteAt(note: RenderedNote, base: number): Note {
  if (note.pitch < 0 || note.pitch > 127) throw new Error('移調後の音高がMIDIの範囲外です。');
  return {
    id: uid('note'),
    at: note.start - base,
    duration: note.end - note.start,
    pitch: { kind: 'absolute', midi: note.pitch },
    velocity: Math.max(1, note.velocity),
    origin: 'generated',
    locked: false,
  };
}

function affects(effect: Effect, track: Track, drumId: string | undefined) {
  switch (effect.kind) {
    case 'thin':
      return true;
    case 'break':
      return effect.tracks.includes(track.id);
    case 'accent':
      return effect.tracks.includes(track.id) || (effect.crash && track.id === drumId);
    case 'fill':
      return track.id === drumId;
    case 'groove':
      return track.kind === 'drums';
    case 'octave':
      return track.id === effect.trackId;
  }
}

function writeNotes(
  project: Project,
  sectionIds: Set<string>,
  notes: RenderedNote[],
  transform?: (notes: RenderedNote[], track: Track) => RenderedNote[],
) {
  const next = clone(project);
  const starts = sectionStarts(project);
  const { keys } = timeline(project);
  const tracks = notesByTrack(notes);
  const drum = project.tracks.find((track) => track.kind === 'drums')?.id;
  for (const section of next.sections) {
    if (!sectionIds.has(section.id)) continue;
    const first = starts.get(section.id)!;
    const last = first + section.length;
    const effects = project.effects.filter((effect) => effect.at.sectionId === section.id);
    for (const track of next.tracks) {
      const clip = (tracks.get(track.id) ?? []).filter(
        (note) => note.start >= first && note.start < last,
      );
      const changed = transform?.(clip, track) ?? clip;
      if (changed !== clip || effects.some((effect) => affects(effect, track, drum))) {
        const original = new Map(
          (section.notes[track.id] ?? []).map((note) => [
            `${note.at}:${note.duration}:${resolvePitch(note.pitch, valueAt(keys, first + note.at).key)}:${note.velocity}`,
            note,
          ]),
        );
        section.notes[track.id] = changed.map((note) => {
          const end = Math.min(note.end, last);
          const signature = `${note.start - first}:${end - note.start}:${note.pitch}:${note.velocity}`;
          const previous = original.get(signature);
          original.delete(signature);
          return previous ?? noteAt({ ...note, end }, first);
        });
      }
    }
  }
  next.effects = next.effects.filter((effect) => !sectionIds.has(effect.at.sectionId));
  return next;
}

export function applyEffects(project: Project, additions: Effect[]): Project {
  const staged = { ...project, effects: [...project.effects, ...additions] };
  return writeNotes(
    staged,
    new Set(additions.map((effect) => effect.at.sectionId)),
    render(staged),
  );
}

export function transposeNotes(
  project: Project,
  at: Position,
  semitones: number,
  duration: number | null,
): Project {
  const section = project.sections.find((item) => item.id === at.sectionId);
  if (
    !section ||
    !Number.isInteger(at.tick) ||
    at.tick < 0 ||
    at.tick >= section.length ||
    (duration !== null &&
      (!Number.isInteger(duration) || duration <= 0 || at.tick + duration > section.length))
  )
    throw new Error('移調する範囲をパート内に収めてください。');
  if (!Number.isInteger(semitones)) throw new Error('移調の幅は半音単位で指定してください。');
  if (semitones === 0) return project;
  const starts = sectionStarts(project);
  const first = starts.get(at.sectionId)! + at.tick;
  const last = duration === null ? Infinity : first + duration;
  const sectionIds = new Set(
    project.sections
      .filter((item) => {
        const start = starts.get(item.id)!;
        return start < last && start + item.length > first;
      })
      .map((item) => item.id),
  );
  return writeNotes(project, sectionIds, render(project), (clip, track) => {
    const intersects = (note: RenderedNote) => note.start < last && note.end > first;
    if (track.kind === 'drums' || !clip.some(intersects)) return clip;
    return clip.flatMap((note) => {
      if (!intersects(note)) return [note];
      const parts = [
        {
          ...note,
          start: Math.max(note.start, first),
          end: Math.min(note.end, last),
          pitch: note.pitch + semitones,
        },
      ];
      if (note.start < first) parts.unshift({ ...note, end: first });
      if (note.end > last) parts.push({ ...note, start: last });
      return parts;
    });
  });
}

export function copyNotesInRange(
  project: Project,
  start: number,
  end: number,
): Record<string, Note[]> {
  const notes = notesByTrack(render(project));
  return Object.fromEntries(
    project.tracks.map((track) => [
      track.id,
      (notes.get(track.id) ?? [])
        .filter((note) => note.start < end && note.end > start)
        .map((note) =>
          noteAt(
            { ...note, start: Math.max(start, note.start), end: Math.min(end, note.end) },
            start,
          ),
        ),
    ]),
  );
}
