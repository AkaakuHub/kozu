import type { GuitarProfile } from './types.ts';
import { mod } from './theory.ts';
export interface GuitarShape {
  frets: (number | null)[];
  pitches: number[];
  strings: number[];
  omittedPitchClasses: number[];
}
/** Finite fretboard search. Span and one-note-per-string are enforced; human fingering is not guaranteed. */
export function guitarVoicing(
  pitches: number[],
  profile: GuitarProfile,
  previous: (number | null)[] = [],
  enforceBass = false,
): GuitarShape | null {
  const pcs = [...new Set(pitches.map((n) => mod(n)))];
  const root = pcs[0]!;
  const required = pcs.length > 4 ? [pcs[0]!, pcs[1]!, pcs[3]!] : pcs;
  let best: GuitarShape | null = null,
    bestScore = Infinity;
  for (let position = 0; position <= profile.maxFret; position++) {
    const choices = profile.tuning.map((open) => {
      const frets: (number | null)[] = [null];
      if (pcs.includes(mod(open))) frets.push(0);
      for (
        let f = Math.max(1, position);
        f <= Math.min(profile.maxFret, position + profile.maxSpan);
        f++
      )
        if (pcs.includes(mod(open + f))) frets.push(f);
      return frets;
    });
    const selected: (number | null)[] = [];
    const walk = (s: number) => {
      if (s < choices.length) {
        for (const f of choices[s]!) {
          selected[s] = f;
          walk(s + 1);
        }
        return;
      }
      const strings = selected.map((f, i) => (f === null ? -1 : i)).filter((i) => i >= 0);
      if (strings.length < Math.min(3, required.length)) return;
      const tones = strings.map((i) => profile.tuning[i]! + selected[i]!);
      if (enforceBass && mod(Math.min(...tones)) !== root) return;
      const actual = tones.map((n) => mod(n));
      if (!required.every((x) => actual.includes(x))) return;
      const positive = selected.filter((f): f is number => f !== null && f > 0);
      if (positive.length && Math.max(...positive) - Math.min(...positive) > profile.maxSpan)
        return;
      const score =
        (mod(Math.min(...tones)) === root ? 0 : 8) +
        (6 - strings.length) * 2 +
        (positive.length ? Math.max(...positive) * 0.3 : 0) +
        selected.reduce<number>(
          (sum, f, i) =>
            sum + (f !== null && previous[i] != null ? Math.abs(f - previous[i]!) * 0.4 : 0),
          0,
        );
      if (score < bestScore) {
        bestScore = score;
        best = {
          frets: [...selected],
          pitches: tones,
          strings,
          omittedPitchClasses: pcs.filter((pc) => !actual.includes(pc)),
        };
      }
    };
    walk(0);
  }
  return best;
}
