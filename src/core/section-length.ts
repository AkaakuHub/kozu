import { PPQ } from './types.ts';
import type { MeterPoint, Project, Section } from './types.ts';

export const sectionLimit = PPQ * 1024;

export function measureTicks(meter: Pick<MeterPoint, 'numerator' | 'denominator'>): number {
  return (4 * PPQ * meter.numerator) / meter.denominator;
}

export function minimumSectionLength(project: Project, section: Section): number {
  let end = 1;
  for (const clip of Object.values(section.notes))
    for (const note of clip) end = Math.max(end, note.at + note.duration);
  for (const chord of section.chords) end = Math.max(end, chord.at + chord.duration);
  for (const event of [...project.keyChanges, ...project.meterChanges])
    if (event.at.sectionId === section.id) end = Math.max(end, event.at.tick + 1);
  for (const event of project.tempoChanges)
    if (event.at.sectionId === section.id)
      end = Math.max(end, event.at.tick + Math.max(1, event.ramp?.duration ?? 0));
  for (const effect of project.effects)
    if (effect.at.sectionId === section.id)
      end = Math.max(end, effect.at.tick + ('duration' in effect ? effect.duration : 1));
  return end;
}

export function growSection(project: Project, section: Section, measure: number): void {
  if (!section.autoExtend) return;
  const needed = minimumSectionLength(project, section);
  if (needed > section.length)
    section.length = Math.min(
      sectionLimit,
      section.length + Math.ceil((needed - section.length) / measure) * measure,
    );
}
