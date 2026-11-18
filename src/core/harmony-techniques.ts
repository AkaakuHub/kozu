import { CHORDS, degreePitch, mod, resolvePitch, SCALES } from './theory.ts';
import { valueAt } from './time.ts';
import type { Chord, Key, KeyPoint } from './types.ts';

export const harmonyTechniques = {
  secondary: '次の和音のセカンダリードミナント',
  tritone: '裏コード',
  borrowed: '借用和音（iv）',
  cliche: '半音下降のクリシェ',
  augmented: 'オーギュメントセブンスの第3転回形',
} as const;
export type HarmonyTechnique = keyof typeof harmonyTechniques;

const triadQualities = ['major', 'minor', 'dim', 'aug'] as const;
type ConnectionChord = Pick<Chord, 'root' | 'quality' | 'inversion' | 'bass'>;
const sameKey = (a: Key, b: Key) => a.tonic === b.tonic && a.mode === b.mode;

function diatonicTriads(key: Key) {
  const scale = SCALES[key.mode];
  return scale.map((tone, i) => {
    const third = mod(scale[(i + 2) % 7]! - tone);
    const fifth = mod(scale[(i + 4) % 7]! - tone);
    const quality = triadQualities.find((quality) => {
      const intervals = CHORDS[quality].intervals;
      return intervals[1] === third && intervals[2] === fifth;
    })!;
    return { pitchClass: mod(key.tonic + tone), quality };
  });
}

export function nextHarmonyKey(keys: KeyPoint[], at: number) {
  const current = valueAt(keys, at).key;
  return keys.find(({ tick, key }) => tick > at && !sameKey(key, current))?.key;
}

export function connectionChords(current: Key, destination: Key) {
  if (sameKey(current, destination)) return null;
  const target = diatonicTriads(destination);
  const common = diatonicTriads(current)
    .filter(({ pitchClass, quality }) =>
      target.some((triad) => triad.pitchClass === pitchClass && triad.quality === quality),
    )
    .map<ConnectionChord>(({ pitchClass, quality }) => ({
      root: { kind: 'absolute', midi: 48 + pitchClass },
      quality,
      inversion: 0,
      bass: null,
    }));
  const dominant: ConnectionChord = {
    root: { kind: 'absolute', midi: 48 + mod(destination.tonic + 7) },
    quality: '7',
    inversion: 0,
    bass: null,
  };
  return { common, dominant };
}

export function changeHarmony(
  chords: Chord[],
  selected: string,
  technique: HarmonyTechnique,
  keyAt: (tick: number) => Key,
): Partial<Chord> | null {
  const ordered = chords.toSorted((a, b) => a.at - b.at);
  const index = ordered.findIndex((chord) => chord.id === selected);
  const chord = ordered[index];
  if (!chord) return null;
  const key = keyAt(chord.at);
  const root = (pitchClass: number) => degreePitch(48 + mod(pitchClass), key);
  switch (technique) {
    case 'secondary': {
      const next = ordered[index + 1];
      return next
        ? {
            root: root(resolvePitch(next.root, keyAt(next.at)) + 7),
            quality: '7',
            inversion: 0,
            bass: null,
          }
        : null;
    }
    case 'tritone':
      return {
        root: root(resolvePitch(chord.root, key) + 6),
        quality: '7',
        inversion: 0,
        bass: null,
      };
    case 'borrowed':
      return { root: root(key.tonic + 5), quality: 'minor', inversion: 0, bass: null };
    case 'cliche': {
      const previous = ordered[index - 1];
      return previous
        ? {
            bass: root(resolvePitch(previous.bass ?? previous.root, keyAt(previous.at)) - 1),
            inversion: 0,
          }
        : null;
    }
    case 'augmented':
      return { quality: 'aug7', inversion: 3, bass: null };
  }
}
