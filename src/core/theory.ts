import type { Chord, ChordQuality, Key, Mode, Pitch } from './types.ts';
export const SCALES: Record<Mode, readonly number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  harmonicMinor: [0, 2, 3, 5, 7, 8, 11],
};
export const MODE_NAMES: Record<Mode, string> = {
  major: 'メジャー',
  minor: 'マイナー',
  dorian: 'ドリアン',
  mixolydian: 'ミクソリディアン',
  lydian: 'リディアン',
  harmonicMinor: 'ハーモニックマイナー',
};
export const CHORDS: Record<ChordQuality, { suffix: string; intervals: readonly number[] }> = {
  major: { suffix: '', intervals: [0, 4, 7] },
  minor: { suffix: 'm', intervals: [0, 3, 7] },
  dim: { suffix: 'dim', intervals: [0, 3, 6] },
  aug: { suffix: 'aug', intervals: [0, 4, 8] },
  sus2: { suffix: 'sus2', intervals: [0, 2, 7] },
  sus4: { suffix: 'sus4', intervals: [0, 5, 7] },
  power: { suffix: '5', intervals: [0, 7, 12] },
  '7': { suffix: '7', intervals: [0, 4, 7, 10] },
  maj7: { suffix: 'maj7', intervals: [0, 4, 7, 11] },
  m7: { suffix: 'm7', intervals: [0, 3, 7, 10] },
  mMaj7: { suffix: 'm(maj7)', intervals: [0, 3, 7, 11] },
  m7b5: { suffix: 'm7♭5', intervals: [0, 3, 6, 10] },
  dim7: { suffix: 'dim7', intervals: [0, 3, 6, 9] },
  aug7: { suffix: 'aug7', intervals: [0, 4, 8, 10] },
  augMaj7: { suffix: 'aug(maj7)', intervals: [0, 4, 8, 11] },
  '6': { suffix: '6', intervals: [0, 4, 7, 9] },
  m6: { suffix: 'm6', intervals: [0, 3, 7, 9] },
  add9: { suffix: 'add9', intervals: [0, 4, 7, 14] },
  madd9: { suffix: 'm(add9)', intervals: [0, 3, 7, 14] },
  '9': { suffix: '9', intervals: [0, 4, 7, 10, 14] },
  maj9: { suffix: 'maj9', intervals: [0, 4, 7, 11, 14] },
  m9: { suffix: 'm9', intervals: [0, 3, 7, 10, 14] },
  '11': { suffix: '11', intervals: [0, 4, 7, 10, 14, 17] },
  m11: { suffix: 'm11', intervals: [0, 3, 7, 10, 14, 17] },
  '13': { suffix: '13', intervals: [0, 4, 7, 10, 14, 21] },
  '7b9': { suffix: '7(♭9)', intervals: [0, 4, 7, 10, 13] },
  '7sharp9': { suffix: '7(♯9)', intervals: [0, 4, 7, 10, 15] },
  '7sharp11': { suffix: '7(♯11)', intervals: [0, 4, 7, 10, 18] },
  '7sus4': { suffix: '7sus4', intervals: [0, 5, 7, 10] },
  maj7sharp11: { suffix: 'maj7(♯11)', intervals: [0, 4, 7, 11, 18] },
  custom: { suffix: '(custom)', intervals: [] },
};
export const INTERVALS = [
  { name: '短2度', semitones: 1 },
  { name: '長2度', semitones: 2 },
  { name: '短3度', semitones: 3 },
  { name: '長3度', semitones: 4 },
  { name: '完全4度', semitones: 5 },
  { name: '増4度', semitones: 6 },
  { name: '完全5度', semitones: 7 },
  { name: '短6度', semitones: 8 },
  { name: '長6度', semitones: 9 },
  { name: '短7度', semitones: 10 },
  { name: '長7度', semitones: 11 },
  { name: '完全8度', semitones: 12 },
];
export const mod = (n: number, d = 12): number => ((n % d) + d) % d;
export function pitchName(midi: number, flats = false, octave = false): string {
  const names = flats
    ? ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B']
    : ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
  return `${names[mod(midi)]}${octave ? Math.floor(midi / 12) - 1 : ''}`;
}
export function keyName(key: Key): string {
  return `${pitchName(key.tonic, key.preferFlats)} ${MODE_NAMES[key.mode]}`;
}
export function resolvePitch(pitch: Pitch, key: Key): number {
  if (pitch.kind === 'absolute') return pitch.midi;
  return (
    (pitch.octave + 1) * 12 + key.tonic + SCALES[key.mode][pitch.degree - 1]! + pitch.accidental
  );
}
function chordIntervals(chord: Chord): readonly number[] {
  return chord.quality === 'custom' ? chord.customIntervals : CHORDS[chord.quality].intervals;
}
export function chordPitches(chord: Chord, key: Key, octave = 3): number[] {
  const root = mod(resolvePitch(chord.root, key)) + 12 * (octave + 1);
  const tones = chordIntervals(chord).map((i) => root + i);
  for (let i = 0; i < chord.inversion && tones.length; i++) tones.push(tones.shift()! + 12);
  tones.sort((a, b) => a - b);
  if (chord.bass) {
    let bass = mod(resolvePitch(chord.bass, key)) + 12 * octave;
    while (tones.length && bass >= tones[0]!) bass -= 12;
    tones.unshift(bass);
  }
  return tones;
}
export function chordName(chord: Chord, key: Key): string {
  const root = pitchName(resolvePitch(chord.root, key), key.preferFlats);
  const bass = chord.bass ? `/${pitchName(resolvePitch(chord.bass, key), key.preferFlats)}` : '';
  return root + CHORDS[chord.quality].suffix + bass;
}
export function inScale(midi: number, key: Key): boolean {
  return SCALES[key.mode].some((x) => mod(key.tonic + x) === mod(midi));
}
export function transposeKey(key: Key, semitones: number): Key {
  return { ...key, tonic: mod(key.tonic + semitones) };
}
/** Find a nearby chord voicing without changing chord quality or the supplied slash bass. */
export function voiceLead(
  pitches: number[],
  previous: number[],
  preserveInversion = false,
): number[] {
  if (!previous.length) return pitches;
  const candidates = [-12, 0, 12]
    .flatMap((shift) => {
      const p = pitches.map((n) => n + shift);
      const result = [p];
      for (let i = 1; !preserveInversion && i < p.length; i++)
        result.push([...p.slice(i), ...p.slice(0, i).map((n) => n + 12)]);
      return result;
    })
    .filter((p) => p.every((n) => n >= 40 && n <= 88));
  const cost = (p: number[]) =>
    p.reduce((sum, n, i) => sum + Math.abs(n - previous[Math.min(i, previous.length - 1)]!), 0);
  return candidates.sort((a, b) => cost(a) - cost(b))[0] ?? pitches;
}
/** Preserve the exact pitch, expressing chromatic notes as an altered scale degree. No snapping. */
export function degreePitch(midi: number, key: Key): Extract<Pitch, { kind: 'degree' }> {
  let best: Extract<Pitch, { kind: 'degree' }> = {
    kind: 'degree',
    degree: 1,
    accidental: 0,
    octave: 4,
  };
  let score = Infinity;
  for (let d = 1; d <= 7; d++)
    for (let octave = -1; octave <= 9; octave++) {
      const natural = (octave + 1) * 12 + key.tonic + SCALES[key.mode][d - 1]!;
      const accidental = midi - natural;
      if (Math.abs(accidental) < score) {
        score = Math.abs(accidental);
        best = { kind: 'degree', degree: d as 1 | 2 | 3 | 4 | 5 | 6 | 7, accidental, octave };
      }
    }
  return best;
}
