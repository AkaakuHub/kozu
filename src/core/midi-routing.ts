import type { Track } from './types.ts';

export function midiRouting(tracks: Track[]) {
  let melodic = 0;
  let drums = 0;
  return new Map(
    tracks.map((track) => {
      if (track.kind === 'drums') return [track.id, { channel: 9, port: drums++ }];
      const index = melodic++;
      const channel = index % 15;
      return [
        track.id,
        { channel: channel >= 9 ? channel + 1 : channel, port: Math.floor(index / 15) },
      ];
    }),
  );
}
