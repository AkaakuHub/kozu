import type { Project } from './types.ts';

export function removeTrack(project: Project, id: string): boolean {
  if (project.tracks.length <= 1 || !project.tracks.some((track) => track.id === id)) return false;
  project.tracks = project.tracks.filter((track) => track.id !== id);
  for (const track of project.tracks) if (track.harmonySource === id) delete track.harmonySource;
  for (const section of project.sections) delete section.notes[id];
  project.effects = project.effects
    .filter((effect) => effect.kind !== 'octave' || effect.trackId !== id)
    .map((effect) => {
      if ('tracks' in effect) effect.tracks = effect.tracks.filter((track) => track !== id);
      if (effect.kind === 'thin')
        effect.keepTracks = effect.keepTracks.filter((track) => track !== id);
      return effect;
    });
  return true;
}
