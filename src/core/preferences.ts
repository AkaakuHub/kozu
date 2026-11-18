export type Appearance = 'system' | 'light' | 'dark';
export const trackRange = { min: 72, max: 340 };
export const arrangementRange = { min: 90, max: 360 };
export const defaultMasterGain = 0.58;

export interface Preferences {
  appearance?: Appearance;
  trackWidth?: number;
  arrangementHeight?: number;
  scaleGuide?: boolean;
  notePreview?: boolean;
  masterGain?: number;
}

export function isVolume(value: unknown): value is number {
  return typeof value === 'number' && value >= 0 && value <= 1;
}

export function parsePreferences(value: unknown): Preferences {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    throw new Error('設定の形式が不正です。');
  const result: Preferences = {};
  for (const [key, setting] of Object.entries(value)) {
    if (key === 'appearance' && (setting === 'system' || setting === 'light' || setting === 'dark'))
      result.appearance = setting;
    else if (key === 'trackWidth' && dimensions(setting, trackRange)) result.trackWidth = setting;
    else if (key === 'arrangementHeight' && dimensions(setting, arrangementRange))
      result.arrangementHeight = setting;
    else if (key === 'scaleGuide' && typeof setting === 'boolean') result.scaleGuide = setting;
    else if (key === 'notePreview' && typeof setting === 'boolean') result.notePreview = setting;
    else if (key === 'masterGain' && isVolume(setting)) result.masterGain = setting;
    else throw new Error('設定値が範囲外です。');
  }
  return result;
}

function dimensions(value: unknown, range: { min: number; max: number }): value is number {
  return (
    typeof value === 'number' && Number.isInteger(value) && value >= range.min && value <= range.max
  );
}
