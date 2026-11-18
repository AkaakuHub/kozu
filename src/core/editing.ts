import { clone, PPQ, uid } from './types.ts';
import type { Effect, Position, Project, Section } from './types.ts';
import { keyAt, sectionStarts, timeline, valueAt, absolutePosition } from './time.ts';
import { resolvePitch } from './theory.ts';
import { applyEffects, copyNotesInRange, transposeNotes } from './technique-notes.ts';
export function insertJump(
  project: Project,
  at: Position,
  restTicks: number = PPQ,
  keepLead = true,
): Project {
  const section = project.sections.find((s) => s.id === at.sectionId);
  if (!section || restTicks <= 0 || at.tick + restTicks >= section.length)
    throw new Error('アクセントを置く位置までパート内に収めてください。');
  const tracks = project.tracks.filter((t) => !keepLead || t.kind !== 'melody').map((t) => t.id);
  return applyEffects(project, [
    { id: uid('break'), kind: 'break', at, duration: restTicks, tracks },
    {
      id: uid('accent'),
      kind: 'accent',
      at: { ...at, tick: at.tick + restTicks },
      tracks,
      velocity: 110,
      crash: true,
    },
  ]);
}
export function modulate(
  project: Project,
  at: Position,
  semitones: number,
  duration: number | null = null,
): Project {
  return transposeNotes(project, at, semitones, duration);
}
/** Insert a copied musical slice before a section. All later events keep their section anchors. */
export function insertRestatement(
  project: Project,
  sourceId: string,
  from: number,
  length: number,
  destinationId: string,
  shift: number | null = null,
): Project {
  const p = clone(project);
  const source = p.sections.find((s) => s.id === sourceId);
  const index = p.sections.findIndex((s) => s.id === destinationId);
  if (!source || index < 0 || from < 0 || length <= 0 || from + length > source.length)
    throw new Error('反復するフレーズの範囲が正しくありません。');
  const maps = timeline(project),
    starts = sectionStarts(project);
  const globalFrom = absolutePosition({ sectionId: sourceId, tick: from }, starts);
  const repeated: Section = {
    ...clone(source),
    id: uid('section'),
    name: '言い直し',
    role: 'transition',
    variant: 'normal',
    sourceSectionId: source.id,
    length,
    notes: copyNotesInRange(project, globalFrom, globalFrom + length),
    chords: [],
  };
  repeated.chords = source.chords
    .filter((c) => c.at < from + length && c.at + c.duration > from)
    .flatMap((c) => {
      const start = Math.max(c.at, from);
      const end = Math.min(c.at + c.duration, from + length);
      const base = starts.get(sourceId)!;
      const boundaries = [
        start,
        ...maps.keys
          .filter(({ tick }) => tick > base + start && tick < base + end)
          .map(({ tick }) => tick - base),
        end,
      ];
      return boundaries.slice(0, -1).map((tick, index) => {
        const key = valueAt(maps.keys, base + tick).key;
        return {
          ...clone(c),
          id: uid('chord'),
          at: tick - from,
          duration: boundaries[index + 1]! - tick,
          root: { kind: 'absolute' as const, midi: resolvePitch(c.root, key) },
          bass: c.bass && { kind: 'absolute' as const, midi: resolvePitch(c.bass, key) },
        };
      });
    });
  const destinationTempo = valueAt(maps.tempos, starts.get(destinationId)!).bpm;
  const destinationMeter = valueAt(maps.meters, starts.get(destinationId)!);
  p.sections.splice(index, 0, repeated);
  p.tempoChanges.push({
    id: uid('tempo'),
    at: { sectionId: repeated.id, tick: 0 },
    bpm: valueAt(maps.tempos, globalFrom).bpm,
    ramp: null,
  });
  const sourceMeter = valueAt(maps.meters, globalFrom);
  p.meterChanges.push({
    id: uid('meter'),
    at: { sectionId: repeated.id, tick: 0 },
    numerator: sourceMeter.numerator,
    denominator: sourceMeter.denominator,
  });
  // Copy all effective tempo samples, including a slice taken from the middle of a ramp.
  for (const point of maps.tempos)
    if (point.tick > globalFrom && point.tick < globalFrom + length)
      p.tempoChanges.push({
        id: uid('tempo'),
        at: { sectionId: repeated.id, tick: point.tick - globalFrom },
        bpm: point.bpm,
        ramp: null,
      });
  for (const point of maps.meters)
    if (point.tick > globalFrom && point.tick < globalFrom + length)
      p.meterChanges.push({
        id: uid('meter'),
        at: { sectionId: repeated.id, tick: point.tick - globalFrom },
        numerator: point.numerator,
        denominator: point.denominator,
      });
  const dest = { sectionId: destinationId, tick: 0 };
  if (!p.tempoChanges.some((t) => t.at.sectionId === destinationId && t.at.tick === 0))
    p.tempoChanges.push({ id: uid('tempo'), at: dest, bpm: destinationTempo, ramp: null });
  if (!p.meterChanges.some((t) => t.at.sectionId === destinationId && t.at.tick === 0))
    p.meterChanges.push({
      id: uid('meter'),
      at: dest,
      numerator: destinationMeter.numerator,
      denominator: destinationMeter.denominator,
    });
  return shift === null ? p : transposeNotes(p, dest, shift, null);
}
export function addDrop(project: Project, sectionId: string): Project {
  const s = project.sections.find((s) => s.id === sectionId);
  if (!s) throw new Error('パートがありません。');
  return addEffect(project, {
    id: uid('drop'),
    kind: 'thin',
    at: { sectionId, tick: 0 },
    duration: s.length,
    keepTracks: project.tracks
      .filter((t) => t.kind === 'melody' || t.kind === 'chords')
      .map((t) => t.id),
    gain: 0.65,
  });
}
export function addEffect(project: Project, effect: Effect): Project {
  return applyEffects(project, [effect]);
}
export function removeSection(project: Project, id: string): Project {
  if (project.sections.length <= 1) throw new Error('最後のパートは削除できません。');
  const p = clone(project);
  p.sections = p.sections.filter((s) => s.id !== id);
  p.tempoChanges = p.tempoChanges.filter((e) => e.at.sectionId !== id);
  p.keyChanges = p.keyChanges.filter((e) => e.at.sectionId !== id);
  p.meterChanges = p.meterChanges.filter((e) => e.at.sectionId !== id);
  p.effects = p.effects.filter((e) => e.at.sectionId !== id);
  for (const s of p.sections) if (s.sourceSectionId === id) s.sourceSectionId = null;
  return p;
}
export function duplicateSection(project: Project, id: string): Project {
  const p = clone(project);
  const index = p.sections.findIndex((s) => s.id === id);
  const original = p.sections[index];
  if (!original) throw new Error('パートがありません。');
  const next = clone(original);
  next.id = uid('section');
  next.sourceSectionId = id;
  next.name += '（複製）';
  next.chords.forEach((c) => (c.id = uid('chord')));
  Object.values(next.notes).forEach((ns) => ns.forEach((n) => (n.id = uid('note'))));
  const maps = timeline(p),
    tick = sectionStarts(p).get(id)!;
  p.sections.splice(index + 1, 0, next);
  p.tempoChanges.push(
    {
      id: uid('tempo'),
      at: { sectionId: next.id, tick: 0 },
      bpm: valueAt(maps.tempos, tick).bpm,
      ramp: null,
    },
    ...project.tempoChanges
      .filter((e) => e.at.sectionId === id)
      .map((e) => ({ ...clone(e), id: uid('tempo'), at: { ...e.at, sectionId: next.id } })),
  );
  p.keyChanges.push(
    {
      id: uid('key'),
      at: { sectionId: next.id, tick: 0 },
      key: keyAt(project, { sectionId: id, tick: 0 }),
    },
    ...project.keyChanges
      .filter((e) => e.at.sectionId === id)
      .map((e) => ({ ...clone(e), id: uid('key'), at: { ...e.at, sectionId: next.id } })),
  );
  const meter = valueAt(maps.meters, tick);
  p.meterChanges.push(
    {
      id: uid('meter'),
      at: { sectionId: next.id, tick: 0 },
      numerator: meter.numerator,
      denominator: meter.denominator,
    },
    ...project.meterChanges
      .filter((e) => e.at.sectionId === id)
      .map((e) => ({ ...clone(e), id: uid('meter'), at: { ...e.at, sectionId: next.id } })),
  );
  p.effects.push(
    ...project.effects
      .filter((e) => e.at.sectionId === id)
      .map((e) => ({ ...clone(e), id: uid('effect'), at: { ...e.at, sectionId: next.id } })),
  );
  return p;
}
