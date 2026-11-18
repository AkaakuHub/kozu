export const drumKits = {
  standard: { name: 'スタンダード', program: 0 },
  room: { name: 'ルーム', program: 8 },
  electronic: { name: 'エレクトロニック', program: 24 },
} as const;

export type DrumKit = keyof typeof drumKits;
export const defaultDrumKit: DrumKit = 'standard';
export const drumPitches = Array.from({ length: 47 }, (_, index) => index + 35);

export function isDrumKit(value: unknown): value is DrumKit {
  return typeof value === 'string' && Object.hasOwn(drumKits, value);
}

export function isDrumPitch(pitch: number): boolean {
  return Number.isInteger(pitch) && pitch >= drumPitches[0]! && pitch <= drumPitches.at(-1)!;
}

export function drumKitForProgram(program: number): DrumKit | undefined {
  return Object.keys(drumKits)
    .filter(isDrumKit)
    .find((kit) => drumKits[kit].program === program);
}
