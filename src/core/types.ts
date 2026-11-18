import type { InstrumentProgram } from './instruments.ts';
/** Musical coordinates are integer ticks. 960 ticks = a quarter note, independent of meter. */
export const PPQ = 960 as const;
export type Degree = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export type Mode = 'major' | 'minor' | 'dorian' | 'mixolydian' | 'lydian' | 'harmonicMinor';
export type Pitch =
  | { kind: 'degree'; degree: Degree; accidental: number; octave: number }
  | { kind: 'absolute'; midi: number };
export interface Key {
  tonic: number;
  mode: Mode;
  preferFlats: boolean;
}
export interface Position {
  sectionId: string;
  tick: number;
}
export interface Note {
  id: string;
  at: number;
  duration: number;
  pitch: Pitch;
  velocity: number;
  origin: 'manual' | 'generated';
  locked: boolean;
}
export type ChordQuality =
  | 'major'
  | 'minor'
  | 'dim'
  | 'aug'
  | 'sus2'
  | 'sus4'
  | 'power'
  | '7'
  | 'maj7'
  | 'm7'
  | 'mMaj7'
  | 'm7b5'
  | 'dim7'
  | 'aug7'
  | 'augMaj7'
  | '6'
  | 'm6'
  | 'add9'
  | 'madd9'
  | '9'
  | 'maj9'
  | 'm9'
  | '11'
  | 'm11'
  | '13'
  | '7b9'
  | '7sharp9'
  | '7sharp11'
  | '7sus4'
  | 'maj7sharp11'
  | 'custom';
export interface Chord {
  id: string;
  at: number;
  duration: number;
  root: Pitch;
  quality: ChordQuality;
  inversion: number;
  bass: Pitch | null;
  customIntervals: number[];
}
export type TrackKind = 'melody' | 'chords' | 'guitar' | 'bass' | 'drums';
export type Pattern =
  | 'sustain'
  | 'eighths'
  | 'arp'
  | 'cutting'
  | 'pop'
  | 'halftime'
  | 'doubletime'
  | 'fourOnFloor'
  | 'trap'
  | 'twoStep';
export interface GuitarProfile {
  output: 'voiced' | 'powerNotes' | 'powerTrigger';
  tuning: number[];
  maxFret: number;
  maxSpan: number;
  strumMs: number;
  triggerTranspose: number;
  patchName: string;
}
export interface Track {
  id: string;
  name: string;
  kind: TrackKind;
  program?: InstrumentProgram;
  pattern: Pattern;
  gain: number;
  mute: boolean;
  solo: boolean;
  octave: number;
  guitar: GuitarProfile;
}
export interface Section {
  id: string;
  name: string;
  /** Labels and roles do not impose musical structure: D/E/custom sections are legal. */
  role: string;
  variant: 'normal' | 'drop' | 'final';
  length: number;
  chords: Chord[];
  notes: Record<string, Note[]>;
  sourceSectionId: string | null;
}
interface TempoChange {
  id: string;
  at: Position;
  bpm: number;
  ramp: { duration: number; toBpm: number } | null;
}
interface KeyChange {
  id: string;
  at: Position;
  key: Key;
}
interface MeterChange {
  id: string;
  at: Position;
  numerator: number;
  denominator: 2 | 4 | 8 | 16;
}
export type Effect =
  | { id: string; kind: 'break'; at: Position; duration: number; tracks: string[] }
  | { id: string; kind: 'accent'; at: Position; tracks: string[]; velocity: number; crash: boolean }
  | { id: string; kind: 'thin'; at: Position; duration: number; keepTracks: string[]; gain: number }
  | { id: string; kind: 'groove'; at: Position; duration: number; pattern: Pattern }
  | { id: string; kind: 'fill'; at: Position; duration: number; subdivision: number }
  | {
      id: string;
      kind: 'octave';
      at: Position;
      duration: number;
      trackId: string;
      semitones: number;
    };
export interface Project {
  schemaVersion: 2;
  title: string;
  seed: number;
  initialTempo: number;
  initialKey: Key;
  initialMeter: { numerator: number; denominator: 2 | 4 | 8 | 16 };
  sections: Section[];
  tracks: Track[];
  tempoChanges: TempoChange[];
  keyChanges: KeyChange[];
  meterChanges: MeterChange[];
  effects: Effect[];
}
export interface RenderedNote {
  id: string;
  trackId: string;
  pitch: number;
  start: number;
  end: number;
  velocity: number;
  channel: number;
  string: number | null;
}
export interface TempoPoint {
  tick: number;
  bpm: number;
}
export interface KeyPoint {
  tick: number;
  key: Key;
}
export interface MeterPoint {
  tick: number;
  numerator: number;
  denominator: 2 | 4 | 8 | 16;
}
export interface Diagnostic {
  severity: 'error' | 'warning';
  code: string;
  message: string;
  sectionId: string | null;
}
export interface CompiledSong {
  notes: RenderedNote[];
  tempos: TempoPoint[];
  keys: KeyPoint[];
  meters: MeterPoint[];
  markers: { tick: number; label: string }[];
  totalTicks: number;
  diagnostics: Diagnostic[];
  breaks: { tick: number; end: number; trackId: string }[];
}
export function uid(prefix = 'id'): string {
  return `${prefix}-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
}
export function clone<T>(value: T): T {
  return structuredClone(value);
}
