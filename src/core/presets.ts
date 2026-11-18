import { PPQ, uid } from './types.ts';
import type {
  Chord,
  ChordQuality,
  Degree,
  GuitarProfile,
  Key,
  Note,
  Project,
  Section,
  Track,
} from './types.ts';
import { chordPitches, inScale, mod, resolvePitch } from './theory.ts';
export interface ProgressionPreset {
  id: string;
  name: string;
  category: string;
  degrees: readonly (readonly [Degree, ChordQuality, number?])[];
  note: string;
}
export const PROGRESSIONS: ProgressionPreset[] = [
  {
    id: 'royal',
    name: '王道進行',
    category: 'J-POP',
    degrees: [
      [4, 'major'],
      [5, 'major'],
      [3, 'minor'],
      [6, 'minor'],
    ],
    note: 'IV–V–iii–vi。長調を基準とした表記です。',
  },
  {
    id: 'canon',
    name: 'カノン進行',
    category: '定番',
    degrees: [
      [1, 'major'],
      [5, 'major'],
      [6, 'minor'],
      [3, 'minor'],
      [4, 'major'],
      [1, 'major'],
      [4, 'major'],
      [5, 'major'],
    ],
    note: 'I–V–vi–iii–IV–I–IV–V。',
  },
  {
    id: 'komuro',
    name: '小室進行',
    category: 'J-POP',
    degrees: [
      [6, 'minor'],
      [4, 'major'],
      [5, 'major'],
      [1, 'major'],
    ],
    note: 'vi–IV–V–I。',
  },
  {
    id: 'marusa',
    name: '丸サ進行',
    category: 'J-POP',
    degrees: [
      [4, 'maj7'],
      [3, '7'],
      [6, 'm7'],
      [1, '7'],
    ],
    note: 'IVmaj7–III7–vi7–I7。二つのドミナントを含みます。',
  },
  {
    id: 'pop',
    name: 'I–V–vi–IV',
    category: '定番',
    degrees: [
      [1, 'major'],
      [5, 'major'],
      [6, 'minor'],
      [4, 'major'],
    ],
    note: '長調の4コード循環です。',
  },
  {
    id: '1564',
    name: 'I–vi–IV–V',
    category: '定番',
    degrees: [
      [1, 'major'],
      [6, 'minor'],
      [4, 'major'],
      [5, 'major'],
    ],
    note: '循環進行です。',
  },
  {
    id: '1625',
    name: 'I–vi–ii–V',
    category: '定番',
    degrees: [
      [1, 'major'],
      [6, 'minor'],
      [2, 'minor'],
      [5, '7'],
    ],
    note: 'ターンアラウンドです。',
  },
  {
    id: '251',
    name: 'ii–V–I',
    category: 'ジャズ',
    degrees: [
      [2, 'm7'],
      [5, '7'],
      [1, 'maj7'],
      [1, 'maj7'],
    ],
    note: '最後のトニックを延長します。',
  },
  {
    id: '251m',
    name: 'iiø–V–i',
    category: '短調',
    degrees: [
      [2, 'm7b5'],
      [5, '7b9'],
      [1, 'minor'],
      [1, 'minor'],
    ],
    note: '短調のキーで使用するプリセットです。',
  },
  {
    id: 'backdoor',
    name: 'バックドア',
    category: '和声',
    degrees: [
      [4, 'm7'],
      [7, '7', -1],
      [1, 'maj7'],
      [1, 'maj7'],
    ],
    note: 'ivm7–♭VII7–Imaj7。長調基準です。',
  },
  {
    id: 'borrowediv',
    name: '借用iv',
    category: '和声',
    degrees: [
      [1, 'major'],
      [4, 'major'],
      [4, 'minor'],
      [1, 'major'],
    ],
    note: 'サブドミナントマイナーを含みます。',
  },
  {
    id: 'secondary',
    name: 'セカンダリードミナント',
    category: '和声',
    degrees: [
      [1, 'major'],
      [6, '7'],
      [2, 'm7'],
      [5, '7'],
    ],
    note: 'V/iiとしてVI7を挿入します。',
  },
  {
    id: 'tritone',
    name: '裏コード',
    category: '和声',
    degrees: [
      [2, 'm7'],
      [2, '7', -1],
      [1, 'maj7'],
      [1, 'maj7'],
    ],
    note: 'ii7–♭II7–Imaj7。',
  },
  {
    id: 'passingdim',
    name: '経過ディミニッシュ',
    category: '和声',
    degrees: [
      [1, 'maj7'],
      [1, 'dim7', 1],
      [2, 'm7'],
      [5, '7'],
    ],
    note: '半音上行する根音を接続します。',
  },
  {
    id: '4536',
    name: '王道・セブンス',
    category: 'J-POP',
    degrees: [
      [4, 'maj7'],
      [5, '7'],
      [3, 'm7'],
      [6, 'm7'],
    ],
    note: '王道進行を四和音に展開します。',
  },
  {
    id: '6451',
    name: '小室・セブンス',
    category: 'J-POP',
    degrees: [
      [6, 'm7'],
      [4, 'maj7'],
      [5, '7'],
      [1, 'maj7'],
    ],
    note: '長調基準です。',
  },
  {
    id: '6415',
    name: 'vi–IV–I–V',
    category: '定番',
    degrees: [
      [6, 'minor'],
      [4, 'major'],
      [1, 'major'],
      [5, 'major'],
    ],
    note: '長調基準です。',
  },
  {
    id: '4156',
    name: 'IV–I–V–vi',
    category: '定番',
    degrees: [
      [4, 'major'],
      [1, 'major'],
      [5, 'major'],
      [6, 'minor'],
    ],
    note: '長調基準です。',
  },
  {
    id: '1645',
    name: 'I–vi–IVmaj7–V7',
    category: '定番',
    degrees: [
      [1, 'major'],
      [6, 'minor'],
      [4, 'maj7'],
      [5, '7'],
    ],
    note: '長調基準です。',
  },
  {
    id: 'blues',
    name: '12小節ブルース',
    category: 'ブルース',
    degrees: [
      [1, '7'],
      [1, '7'],
      [1, '7'],
      [1, '7'],
      [4, '7'],
      [4, '7'],
      [1, '7'],
      [1, '7'],
      [5, '7'],
      [4, '7'],
      [1, '7'],
      [5, '7'],
    ],
    note: '各コードを1小節に配置します。',
  },
  {
    id: 'suspended',
    name: 'sus4から解決',
    category: '和声',
    degrees: [
      [1, 'sus4'],
      [1, 'major'],
      [5, '7sus4'],
      [5, '7'],
    ],
    note: '4度から3度への解決を含みます。',
  },
  {
    id: 'modal',
    name: 'ミクソリディアンの循環',
    category: 'モード',
    degrees: [
      [1, 'major'],
      [7, 'major', -1],
      [4, 'major'],
      [1, 'major'],
    ],
    note: '長調基準で♭VIIを指定しています。',
  },
  {
    id: 'chromediants',
    name: 'クロマティック・メディアント',
    category: '和声',
    degrees: [
      [1, 'major'],
      [3, 'major'],
      [6, 'major', -1],
      [1, 'major'],
    ],
    note: '長調基準。調外の音を含みます。',
  },
  {
    id: 'descending',
    name: '下降する短調進行',
    category: '短調',
    degrees: [
      [1, 'minor'],
      [7, 'major'],
      [6, 'major'],
      [5, '7'],
    ],
    note: 'ナチュラルマイナーのキーで使用します。',
  },
];
export const DEFAULT_GUITAR: GuitarProfile = {
  output: 'voiced',
  tuning: [40, 45, 50, 55, 59, 64],
  maxFret: 17,
  maxSpan: 4,
  strumMs: 14,
  triggerTranspose: 0,
  patchName: 'Sunburst Power Chords',
};
export function createTrack(kind: Track['kind'], name?: string): Track {
  const names = {
    melody: 'メロディ',
    chords: 'ピアノ',
    guitar: 'ギター',
    bass: 'ベース',
    drums: 'ドラム',
  };
  return {
    id: uid('track'),
    name: name ?? names[kind],
    kind,
    pattern:
      kind === 'drums'
        ? 'pop'
        : kind === 'guitar'
          ? 'eighths'
          : kind === 'bass'
            ? 'eighths'
            : 'sustain',
    gain: kind === 'melody' ? 0.8 : 0.5,
    mute: false,
    solo: false,
    octave: kind === 'bass' ? 2 : kind === 'melody' ? 4 : 3,
    guitar: structuredClone(DEFAULT_GUITAR),
  };
}
export function makeChords(preset: ProgressionPreset, length: number): Chord[] {
  const segment = length / preset.degrees.length;
  return preset.degrees.map(([degree, quality, accidental = 0], i) => ({
    id: uid('chord'),
    at: Math.round(i * segment),
    duration: Math.round((i + 1) * segment) - Math.round(i * segment),
    root: { kind: 'degree', degree, accidental, octave: 3 },
    quality,
    inversion: 0,
    bass: null,
    customIntervals: [0, 4, 7],
  }));
}
export function createSection(
  name = 'Aメロ',
  length = PPQ * 16,
  progression: ProgressionPreset | null = PROGRESSIONS[0]!,
): Section {
  return {
    id: uid('section'),
    name,
    role: name,
    variant: 'normal',
    length,
    chords: progression ? makeChords(progression, length) : [],
    notes: {},
    sourceSectionId: null,
  };
}
/** Deterministic constrained candidate search. Costs guide candidates, not artistic quality. */
export interface MelodyOptions {
  rhythm: 'varied' | 'quarters' | 'syncopated';
  octave: number;
}
export function generateMelody(
  section: Section,
  trackId: string,
  seed: number,
  context: (tick: number) => Key = () => ({ tonic: 0, mode: 'major', preferFlats: false }),
  options: MelodyOptions = { rhythm: 'varied', octave: 4 },
): Note[] {
  let state = seed >>> 0;
  const random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
  const contours: Degree[][] = [
    [3, 5, 6, 5, 3, 2, 1, 2],
    [5, 5, 3, 2, 3, 6, 5, 3],
    [1, 2, 3, 5, 6, 5, 3, 1],
    [3, 2, 1, 2, 5, 6, 5, 3],
  ];
  const contour = contours[Math.floor(random() * contours.length)]!;
  const rhythms = [
    [0, 0.75, 1.5, 2, 3, 4, 5.5, 6.5],
    [0, 0.5, 1.5, 2.5, 3, 4, 5, 6.5],
    [0, 1, 1.75, 2.5, 3.5, 4, 5.5, 7],
  ];
  const chosen = rhythms[Math.floor(random() * rhythms.length)]!;
  const rhythm =
    options.rhythm === 'quarters'
      ? [0, 1, 2, 3, 4, 5, 6, 7]
      : options.rhythm === 'syncopated'
        ? [0, 0.75, 1.5, 2.75, 3.5, 4, 5.75, 7.5]
        : chosen;
  const kept = (section.notes[trackId] ?? []).filter((n) => n.locked || n.origin === 'manual');
  const notes: Note[] = [...kept];
  let previous: number | null = null;
  for (let base = 0; base < section.length; base += PPQ * 8) {
    type Path = { cost: number; pitches: number[]; last: number | null; repeat: number };
    let beam: Path[] = [{ cost: 0, pitches: [], last: previous, repeat: 0 }];
    const slots: { at: number; duration: number }[] = [];
    for (let i = 0; i < rhythm.length; i++) {
      const at = Math.round(base + rhythm[i]! * PPQ);
      if (at >= section.length) continue;
      const next = base + (rhythm[i + 1] ?? 8) * PPQ;
      const duration = Math.round(Math.min(next - at, section.length - at) * 0.87);
      if (kept.some((n) => n.at < at + duration && n.at + n.duration > at)) continue;
      const key = context(at),
        chord = section.chords.find((c) => c.at <= at && at < c.at + c.duration);
      const pcs = chord
        ? new Set(chordPitches(chord, key, 4).map((p) => mod(p)))
        : new Set<number>();
      const target = resolvePitch(
        { kind: 'degree', degree: contour[i]!, accidental: 0, octave: options.octave },
        key,
      );
      const candidates = Array.from(
        { length: 25 },
        (_, j) => key.tonic + (options.octave + 1) * 12 - 3 + j,
      ).filter((midi) => inScale(midi, key) || pcs.has(mod(midi)));
      const strong = at % (2 * PPQ) === 0 || chord?.at === at;
      const candidatesPaths: Path[] = [];
      // One random offset per candidate, shared by all beam paths for repeatable results.
      const jitter = candidates.map(() => random() * 0.8);
      for (const path of beam)
        for (let j = 0; j < candidates.length; j++) {
          const midi = candidates[j]!,
            distance = path.last === null ? 0 : Math.abs(midi - path.last);
          const repeat = path.last === midi ? path.repeat + 1 : 0;
          const cost =
            path.cost +
            Math.abs(midi - target) * 0.32 +
            distance * 0.12 +
            Math.max(0, distance - 7) * 0.85 +
            (pcs.size && !pcs.has(mod(midi)) ? (strong ? 5 : 1) : 0) +
            Math.max(0, repeat - 1) * 0.8 +
            jitter[j]!;
          candidatesPaths.push({ cost, pitches: [...path.pitches, midi], last: midi, repeat });
        }
      beam = candidatesPaths.sort((a, b) => a.cost - b.cost).slice(0, 8);
      slots.push({ at, duration });
    }
    const selected = beam[0];
    if (!selected) continue;
    selected.pitches.forEach((midi, i) => {
      const slot = slots[i]!;
      notes.push({
        id: uid('note'),
        at: slot.at,
        duration: slot.duration,
        pitch: { kind: 'absolute', midi },
        velocity: Math.round(76 + random() * 16),
        origin: 'generated',
        locked: false,
      });
    });
    previous = selected.last;
  }
  return notes.sort((a, b) => a.at - b.at);
}
export function createBlankProject(): Project {
  const section = createSection('Aメロ', PPQ * 16, null);
  return {
    schemaVersion: 2,
    title: '無題',
    seed: 42,
    initialTempo: 120,
    initialKey: { tonic: 0, mode: 'major', preferFlats: false },
    initialMeter: { numerator: 4, denominator: 4 },
    sections: [section],
    tracks: [createTrack('melody')],
    tempoChanges: [],
    keyChanges: [],
    meterChanges: [],
    effects: [],
  };
}
