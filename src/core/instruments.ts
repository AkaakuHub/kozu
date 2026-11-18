import type { InstrumentProgram } from './instrument-catalog.ts';
import type { Track } from './types.ts';
export type { InstrumentProgram } from './instrument-catalog.ts';

export function isInstrumentProgram(value: unknown): value is InstrumentProgram {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < 128;
}

export function defaultProgram(track: Track): InstrumentProgram | undefined {
  switch (track.kind) {
    case 'melody':
      return 4;
    case 'chords':
      return 0;
    case 'bass':
      return 33;
    case 'guitar':
      return track.guitar.output === 'voiced' ? 25 : 29;
    case 'drums':
      return undefined;
  }
}
