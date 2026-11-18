import type { InstrumentProgram } from './instrument-catalog.ts';
export type { InstrumentProgram } from './instrument-catalog.ts';

export function isInstrumentProgram(value: unknown): value is InstrumentProgram {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < 128;
}
