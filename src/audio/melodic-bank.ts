import type { SmplrPreset, SmplrRegion } from 'smplr';
import { instrumentSample } from '../core/instrument-catalog.ts';
import type { InstrumentProgram } from '../core/instruments.ts';
import { pitchName } from '../core/theory.ts';

/*! OpenGM24 attribution and licenses: https://github.com/designerzen/Open-GeneralMIDI-SoundFont/blob/4711727852e0b5678e6189965c8ff9e6a4c79ffa/ATTRIBUTIONS.md */
const source =
  'https://raw.githubusercontent.com/designerzen/Open-GeneralMIDI-SoundFont/4711727852e0b5678e6189965c8ff9e6a4c79ffa/OpenGM24/';

export function createMelodicBank<T>(
  voice: InstrumentProgram,
  decode: (sample: ArrayBuffer) => Promise<T>,
) {
  const baseUrl = `${source}${instrumentSample(voice)}-mp3/`;
  const regions = Array.from({ length: 88 }, (_, index): SmplrRegion => {
    const pitch = index + 21;
    return {
      sample: pitchName(pitch, true, true).replace('♭', 'b'),
      keyRange: [pitch === 21 ? 0 : pitch, pitch === 108 ? 127 : pitch],
      pitch,
    };
  });
  type Bank = { preset: SmplrPreset; buffers: Map<string, T> };
  const samples = new Map<string, Promise<T>>();
  let ready: Bank | null = null;
  let loading: Promise<Bank> | null = null;

  const read = (name: string, priority: 'high' | 'auto') => {
    let sample = samples.get(name);
    if (!sample) {
      sample = fetch(`${baseUrl}${name}.mp3`, { priority })
        .then((response) => {
          if (!response.ok) throw new Error('音源の読み込みに失敗しました。');
          return response.arrayBuffer();
        })
        .then(decode)
        .catch((error: unknown) => {
          samples.delete(name);
          throw error;
        });
      samples.set(name, sample);
    }
    return sample;
  };
  const bank = async (selected: SmplrRegion[], priority: 'high' | 'auto'): Promise<Bank> => ({
    preset: { samples: { baseUrl, formats: ['mp3'] }, groups: [{ regions: selected }] },
    buffers: new Map(
      await Promise.all(
        selected.map(async ({ sample }) => [sample, await read(sample, priority)] as const),
      ),
    ),
  });

  const load = () =>
    (loading ??= bank(regions, 'auto')
      .then((full) => (ready = full))
      .catch((error: unknown) => {
        loading = null;
        throw error;
      }));

  return {
    load,
    audition: (notes: number[]) => {
      if (ready) return Promise.resolve(ready);
      const selected = [
        ...new Set(notes.map((note) => regions[Math.min(87, Math.max(0, note - 21))]!)),
      ];
      return bank(selected, 'high');
    },
  };
}
