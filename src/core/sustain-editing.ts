import { rollSection } from './roll-timeline.ts';
import { uid } from './types.ts';
import type { Project } from './types.ts';

export function editSustain(
  project: Project,
  starts: Map<string, number>,
  trackId: string,
  id: string | null,
  edit: { tick: number; value: number } | null,
): boolean {
  const events = project.sustain ?? [];
  const existing = events.find((event) => event.id === id && event.trackId === trackId);
  if (id !== null && !existing) throw new Error('指定したペダルイベントが見つかりません。');
  if (!edit && existing) {
    const next = events.filter((event) => event !== existing);
    if (next.length) project.sustain = next;
    else delete project.sustain;
    return true;
  }
  if (!edit) return false;
  const section = rollSection(project, starts, edit.tick);
  const track = project.tracks.find((track) => track.id === trackId);
  if (
    !track ||
    !section ||
    !Number.isSafeInteger(edit.tick) ||
    !Number.isInteger(edit.value) ||
    edit.value < 0 ||
    edit.value > 127
  )
    throw new Error('ペダルの位置または値が不正です。');
  const tick = edit.tick - starts.get(section.id)!;
  if (tick >= section.length) throw new Error('曲の範囲内に位置を指定してください。');
  const samePosition = existing?.at.sectionId === section.id && existing.at.tick === tick;
  if (samePosition && existing.value === edit.value) return false;
  if (
    !samePosition &&
    events.some(
      (event) =>
        event.trackId === trackId && event.at.sectionId === section.id && event.at.tick === tick,
    )
  )
    throw new Error('この位置にはペダルイベントがあります。');
  const event = {
    id: existing?.id ?? uid('pedal'),
    trackId,
    at: { sectionId: section.id, tick },
    value: edit.value,
  };
  project.sustain = existing
    ? events.map((old) => (old === existing ? event : old))
    : [...events, event];
  return true;
}
