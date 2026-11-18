import { Instrument, SampleLoader } from 'smplr';
import type { Smplr, SmplrPreset, SmplrRegion } from 'smplr';
import { instrumentSample } from '../core/instrument-catalog.ts';
import { defaultProgram } from '../core/instruments.ts';
import { pitchName } from '../core/theory.ts';
import type { Track } from '../core/types.ts';
import { defaultDrumKit, isDrumPitch } from '../core/drum-kits.ts';
import { loadDrumBank } from './drum-bank.ts';
import type { InstrumentProgram } from '../core/instruments.ts';

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
export function previewVoice(track: Track) {
  return track.kind === 'drums'
    ? (track.drumKit ?? defaultDrumKit)
    : (track.program ?? defaultProgram(track)!);
}
type Voice = ReturnType<typeof previewVoice>;

function instrumentPreset(voice: InstrumentProgram): SmplrPreset {
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

async function loadMelodicBank(
  context: AudioContext,
  voice: InstrumentProgram,
): Promise<SampleBank> {
  let loader = loaders.get(context);
  if (!loader) {
    loader = SampleLoader(context);
    loaders.set(context, loader);
  }
  const preset = instrumentPreset(voice);
  const buffers = await loader.load(preset);
  if (preset.groups.some(({ regions }) => regions.some(({ sample }) => !buffers.has(sample))))
    throw new Error('音源の読み込みに失敗しました。');
  return { preset, buffers };
}

export function loadInstrument(context: AudioContext, destination: AudioNode, voice: Voice): Smplr {
  let bankByVoice = banks.get(context);
  if (!bankByVoice) {
    bankByVoice = new Map();
    banks.set(context, bankByVoice);
  }
  let bank = bankByVoice.get(voice);
  if (!bank) {
    const activeBanks = bankByVoice;
    bank = (
      typeof voice === 'string' ? loadDrumBank(context, voice) : loadMelodicBank(context, voice)
    ).catch((error: unknown) => {
      activeBanks.delete(voice);
      throw error;
    });
    bankByVoice.set(voice, bank);
  }
  return sampler(context, { destination, bank });
}

export function previewNotes(track: Track, pitch: number): number[] {
  if (track.kind === 'drums') return isDrumPitch(pitch) ? [pitch] : [];
  if (track.kind === 'guitar' && track.guitar.output === 'powerTrigger')
    return [pitch, pitch + 7, pitch + 12].filter((note) => note <= 127);
  return [pitch];
}
