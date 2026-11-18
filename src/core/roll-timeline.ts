import { growSection, measureTicks, sectionLimit } from './section-length.ts';
import { sectionStarts, timeline, valueAt } from './time.ts';
import type { MeterPoint, Note, Project, Section, Track } from './types.ts';

export type RollNote = Note & { sectionId: string; noteId: string };

const rollId = (sectionId: string, noteId: string) => JSON.stringify([sectionId, noteId]);

export const autoClip = (section: Section, track: Track) =>
  track.kind !== 'melody' && !Object.hasOwn(section.notes, track.id);

export function trackNotes(
  project: Project,
  trackId: string,
  starts: Map<string, number>,
): RollNote[] {
  return project.sections.flatMap((section) =>
    (section.notes[trackId] ?? []).map((note) => ({
      ...note,
      id: rollId(section.id, note.id),
      at: starts.get(section.id)! + note.at,
      sectionId: section.id,
      noteId: note.id,
    })),
  );
}

export function rollSection(project: Project, starts: Map<string, number>, tick: number) {
  return project.sections.findLast((section) => starts.get(section.id)! <= tick);
}

export function rollSectionEnd(
  starts: Map<string, number>,
  section: Section,
  meters: MeterPoint[],
) {
  const start = starts.get(section.id)!;
  if (!section.autoExtend || !meters.length) return start + section.length;
  const measure = measureTicks(valueAt(meters, start + section.length - 1));
  return start + Math.min(sectionLimit, section.length + measure);
}

export function editTrackNotes(
  project: Project,
  track: Track,
  removed: RollNote[],
  inserted: Note[],
) {
  const starts = sectionStarts(project);
  const { meters } = timeline(project);
  const clips = new Map<string, Note[]>();
  const clip = (section: Section) => {
    const old = clips.get(section.id);
    if (old) return old;
    const notes = [...(section.notes[track.id] ?? [])];
    clips.set(section.id, notes);
    return notes;
  };
  const removedIds = new Map<string, Set<string>>();
  const removedStarts = new Map<string, number>();
  for (const note of removed) {
    let ids = removedIds.get(note.sectionId);
    if (!ids) removedIds.set(note.sectionId, (ids = new Set()));
    ids.add(note.noteId);
    removedStarts.set(note.id, note.at);
  }
  for (const section of project.sections) {
    const ids = removedIds.get(section.id);
    if (ids)
      clips.set(
        section.id,
        (section.notes[track.id] ?? []).filter((note) => !ids.has(note.id)),
      );
  }

  const selected = [];
  const addedIds = new Map<string, Set<string>>();
  for (const note of inserted) {
    const section = rollSection(project, starts, note.at);
    if (!section || autoClip(section, track) || note.duration < 1) return null;
    const selectionId = rollId(section.id, note.id);
    const resize = removedStarts.get(selectionId) === note.at;
    const end =
      resize || section === project.sections.at(-1)
        ? rollSectionEnd(starts, section, meters)
        : starts.get(section.id)! + section.length;
    if (note.at + note.duration > end) return null;
    const notes = clip(section);
    let ids = addedIds.get(section.id);
    if (!ids) addedIds.set(section.id, (ids = new Set(notes.map((note) => note.id))));
    if (ids.has(note.id)) return null;
    ids.add(note.id);
    notes.push({ ...note, at: note.at - starts.get(section.id)! });
    selected.push(selectionId);
  }

  for (const section of project.sections) {
    const notes = clips.get(section.id);
    if (!notes) continue;
    section.notes[track.id] = notes;
    const tick = starts.get(section.id)! + section.length - 1;
    growSection(project, section, measureTicks(valueAt(meters, tick)));
  }
  return selected;
}
