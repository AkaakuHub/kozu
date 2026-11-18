import { Instrument, SampleLoader } from 'smplr';
import type { Smplr, SmplrPreset, SmplrRegion } from 'smplr';
import { instrumentSample } from '../core/instrument-catalog.ts';
import { defaultProgram } from '../core/instruments.ts';
import { pitchName } from '../core/theory.ts';
import type { Track } from '../core/types.ts';

const drumBase = 'https://smpldsnds.github.io/drum-machines/808-mini/';
/*! OpenGM24 attribution and licenses: https://github.com/designerzen/Open-GeneralMIDI-SoundFont/blob/4711727852e0b5678e6189965c8ff9e6a4c79ffa/ATTRIBUTIONS.md */
const melodicBase =
  'https://raw.githubusercontent.com/designerzen/Open-GeneralMIDI-SoundFont/4711727852e0b5678e6189965c8ff9e6a4c79ffa/OpenGM24/';
const loaders = new WeakMap<AudioContext, SampleLoader>();
const banks = new WeakMap<AudioContext, Map<Voice, Promise<SampleBank>>>();
interface SampleBank {
  preset: SmplrPreset;
  buffers: Map<string, AudioBuffer>;
}
const sampler = Instrument<{ bank: Promise<SampleBank> }>(async (_context, { bank }, audio) => {
  const { preset, buffers } = await bank;
  await audio.loadInstrument(preset, buffers);
});
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
  return track.kind === 'drums' ? 'drums' : (track.program ?? defaultProgram(track)!);
}
type Voice = ReturnType<typeof previewVoice>;

function instrumentPreset(voice: Voice): SmplrPreset {
  if (voice === 'drums') {
    const samples = [...new Set(percussion.values())].map((sample, key) => ({ sample, key }));
    return {
      samples: { baseUrl: drumBase, formats: ['m4a'] },
      aliases: Object.fromEntries(samples.map(({ sample, key }) => [sample, key])),
      groups: [{ regions: samples }],
    };
  }
  const instrument = instrumentSample(voice);
  const regions = Array.from({ length: 88 }, (_, index): SmplrRegion => {
    const pitch = index + 21;
    return {
      sample: pitchName(pitch, true, true).replace('♭', 'b'),
      keyRange: [pitch === 21 ? 0 : pitch, pitch === 108 ? 127 : pitch],
      pitch,
    };
  });
  return {
    samples: { baseUrl: `${melodicBase}${instrument}-mp3/`, formats: ['mp3'] },
    groups: [{ regions }],
  };
}

export function loadInstrument(context: AudioContext, destination: AudioNode, voice: Voice): Smplr {
  let loader = loaders.get(context);
  let bankByVoice = banks.get(context);
  if (!loader || !bankByVoice) {
    loader = SampleLoader(context);
    bankByVoice = new Map();
    loaders.set(context, loader);
    banks.set(context, bankByVoice);
  }
  let bank = bankByVoice.get(voice);
  if (!bank) {
    const preset = instrumentPreset(voice);
    const activeBanks = bankByVoice;
    bank = loader
      .load(preset)
      .then((buffers) => {
        if (preset.groups.some(({ regions }) => regions.some(({ sample }) => !buffers.has(sample))))
          throw new Error('音源の読み込みに失敗しました。');
        return { preset, buffers };
      })
      .catch((error: unknown) => {
        activeBanks.delete(voice);
        throw error;
      });
    bankByVoice.set(voice, bank);
  }
  return sampler(context, { destination, loader, bank });
}

export function previewNotes(track: Track, pitch: number): (string | number)[] {
  if (track.kind === 'drums') return percussion.has(pitch) ? [percussion.get(pitch)!] : [];
  if (track.kind === 'guitar' && track.guitar.output === 'powerTrigger')
    return [pitch, pitch + 7, pitch + 12].filter((note) => note <= 127);
  return [pitch];
}
