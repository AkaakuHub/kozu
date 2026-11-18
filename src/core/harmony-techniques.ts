import { degreePitch, mod, resolvePitch } from './theory.ts';
import type { Chord, Key } from './types.ts';

export const harmonyTechniques = {
  secondary: '次の和音のセカンダリードミナント',
  tritone: '裏コード',
  borrowed: '借用和音（iv）',
  cliche: '半音下降のクリシェ',
  augmented: 'オーギュメントセブンスの第3転回形',
} as const;
export type HarmonyTechnique = keyof typeof harmonyTechniques;

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
