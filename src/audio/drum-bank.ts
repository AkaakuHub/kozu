import type { SmplrPreset } from 'smplr';
import { drumKits, drumPitches } from '../core/drum-kits.ts';
import type { DrumKit } from '../core/drum-kits.ts';

export function drumSamples(archive: ArrayBuffer): ArrayBuffer[] {
  const header = drumPitches.length * Uint32Array.BYTES_PER_ELEMENT;
  if (archive.byteLength < header) throw new Error('ドラム音源のファイルが破損しています。');
  const lengths = new DataView(archive, 0, header);
  let offset = header;
  const samples = drumPitches.map((_, index) => {
    const length = lengths.getUint32(index * Uint32Array.BYTES_PER_ELEMENT, true);
    const end = offset + length;
    if (!length || end > archive.byteLength)
      throw new Error('ドラム音源のファイルが破損しています。');
    const sample = archive.slice(offset, end);
    offset = end;
    return sample;
  });
  if (offset !== archive.byteLength) throw new Error('ドラム音源のファイルが破損しています。');
  return samples;
}

export async function loadDrumBank(context: AudioContext, kit: DrumKit) {
  const response = await fetch(`/audio/drums/${kit}.bin`);
  if (!response.ok) throw new Error('ドラム音源を読み込めませんでした。');
  const samples = drumSamples(await response.arrayBuffer());
  const preset: SmplrPreset = {
    meta: { name: drumKits[kit].name, license: 'MIT' },
    samples: { baseUrl: '/audio/drums/', formats: ['mp3'] },
    groups: [{ regions: drumPitches.map((key) => ({ sample: String(key), key, pitch: key })) }],
  };
  const buffers = new Map(
    await Promise.all(
      samples.map(
        async (sample, index) =>
          [String(drumPitches[index]!), await context.decodeAudioData(sample)] as const,
      ),
    ),
  );
  return { preset, buffers };
}
