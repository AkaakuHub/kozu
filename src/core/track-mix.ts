import type { Project, Track } from './types.ts';

export type TrackMix = Pick<Track, 'gain' | 'mute' | 'solo'>;

export function mixLevel(track: TrackMix, anySolo: boolean, gain = track.gain) {
  return track.mute || (anySolo && !track.solo) ? 0 : gain;
}

export function sharesScore(a: Project, b: Project): boolean {
  return (
    a.sections === b.sections &&
    a.effects === b.effects &&
    a.initialKey === b.initialKey &&
    a.initialMeter === b.initialMeter &&
    a.initialTempo === b.initialTempo &&
    a.tempoChanges === b.tempoChanges &&
    a.keyChanges === b.keyChanges &&
    a.meterChanges === b.meterChanges &&
    a.sustain === b.sustain &&
    a.tracks.length === b.tracks.length &&
    a.tracks.every((track, index) => {
      const next = b.tracks[index]!;
      return (
        track.id === next.id &&
        track.kind === next.kind &&
        track.program === next.program &&
        track.drumKit === next.drumKit &&
        track.pattern === next.pattern &&
        track.octave === next.octave &&
        track.guitar === next.guitar
      );
    })
  );
}
