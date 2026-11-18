import { Sampler, Soundfont } from 'smplr';
import type { Smplr } from 'smplr';
import { instruments } from '../core/instruments.ts';
import type { Track } from '../core/types.ts';

const drumBase = 'https://smpldsnds.github.io/drum-machines/808-mini/';
const programs = {
  melody: 'electric_piano_1',
  chords: 'acoustic_grand_piano',
  bass: 'electric_bass_finger',
  guitar: 'acoustic_guitar_steel',
  distorted: 'overdriven_guitar',
};
const percussion = new Map([
  [35, 'kick'],
  [36, 'kick'],
  [37, 'snare-2'],
  [38, 'snare-1'],
  [39, 'snare-2'],
  [40, 'snare-2'],
  [41, 'tom-low'],
  [42, 'hhclosed-1'],
  [43, 'tom-low'],
  [44, 'hhclosed-2'],
  [45, 'tom-mid'],
  [46, 'hhopen-1'],
  [47, 'tom-mid'],
  [48, 'tom-high'],
  [49, 'crash'],
  [50, 'tom-high'],
  [51, 'ride'],
  [52, 'crash'],
  [53, 'ride'],
  [55, 'crash'],
  [57, 'crash'],
  [59, 'ride'],
]);

export function previewVoice(track: Track) {
  if (track.kind !== 'drums' && track.program !== undefined) return track.program;
  return track.kind === 'guitar' && track.guitar.output !== 'voiced' ? 'distorted' : track.kind;
}

export function loadInstrument(
  context: AudioContext,
  destination: AudioNode,
  voice: ReturnType<typeof previewVoice>,
  pitches: (string | number)[],
): Smplr {
  if (voice === 'drums') {
    const samples = pitches.map((sample, index) => ({ sample: String(sample), key: index }));
    return Sampler(context, {
      destination,
      preset: {
        samples: { baseUrl: drumBase, formats: ['m4a'] },
        aliases: Object.fromEntries(samples.map(({ sample, key }) => [sample, key])),
        groups: [{ regions: samples }],
      },
    });
  }
  return Soundfont(context, {
    destination,
    instrument:
      typeof voice === 'number'
        ? instruments.find((item) => item.program === voice)!.sample
        : programs[voice],
    kit: 'FluidR3_GM',
    notesToLoad: { notes: pitches },
  });
}

export function previewNotes(track: Track, pitch: number): (string | number)[] {
  if (track.kind === 'drums') return percussion.has(pitch) ? [percussion.get(pitch)!] : [];
  if (track.kind === 'guitar' && track.guitar.output === 'powerTrigger')
    return [pitch, pitch + 7, pitch + 12].filter((note) => note <= 127);
  return [pitch];
}
