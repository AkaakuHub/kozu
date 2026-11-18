import { Instrument } from 'smplr';
import type { Smplr, SmplrPreset } from 'smplr';
import { defaultProgram } from '../core/instruments.ts';
import type { Track } from '../core/types.ts';
import { defaultDrumKit, isDrumPitch } from '../core/drum-kits.ts';
import { loadDrumBank } from './drum-bank.ts';
import type { InstrumentProgram } from '../core/instruments.ts';
import type { DrumKit } from '../core/drum-kits.ts';
import { createMelodicBank } from './melodic-bank.ts';

const drums = new WeakMap<AudioContext, Map<DrumKit, Promise<SampleBank>>>();
const melodic = new WeakMap<
  AudioContext,
  Map<InstrumentProgram, ReturnType<typeof createMelodicBank<AudioBuffer>>>
>();
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

export function sampleBank(
  context: AudioContext,
  voice: Voice,
  audition?: number[],
): Promise<SampleBank> {
  if (typeof voice === 'string') {
    let kits = drums.get(context);
    if (!kits) drums.set(context, (kits = new Map()));
    let kit = kits.get(voice);
    if (!kit) {
      const active = kits;
      kit = loadDrumBank(context, voice).catch((error: unknown) => {
        active.delete(voice);
        throw error;
      });
      kits.set(voice, kit);
    }
    return kit;
  }

  let instruments = melodic.get(context);
  if (!instruments) melodic.set(context, (instruments = new Map()));
  let instrument = instruments.get(voice);
  if (!instrument) {
    instrument = createMelodicBank(voice, (sample) => context.decodeAudioData(sample));
    instruments.set(voice, instrument);
  }
  return audition ? instrument.audition(audition) : instrument.load();
}

export function loadInstrument(context: AudioContext, destination: AudioNode, voice: Voice): Smplr {
  return sampler(context, { destination, bank: sampleBank(context, voice) });
}

export function auditionInstrument(
  context: AudioContext,
  destination: AudioNode,
  bank: SampleBank,
): Smplr {
  return sampler(context, { destination, bank: Promise.resolve(bank) });
}

export function previewNotes(track: Track, pitch: number): number[] {
  if (track.kind === 'drums') return isDrumPitch(pitch) ? [pitch] : [];
  if (track.kind === 'guitar' && track.guitar.output === 'powerTrigger')
    return [pitch, pitch + 7, pitch + 12].filter((note) => note <= 127);
  return [pitch];
}
