export const instruments = [
  { program: 0, name: 'グランドピアノ', sample: 'acoustic_grand_piano' },
  { program: 4, name: 'エレクトリックピアノ', sample: 'electric_piano_1' },
  { program: 7, name: 'クラビネット', sample: 'clavinet' },
  { program: 11, name: 'ビブラフォン', sample: 'vibraphone' },
  { program: 19, name: 'チャーチオルガン', sample: 'church_organ' },
  { program: 24, name: 'ナイロンギター', sample: 'acoustic_guitar_nylon' },
  { program: 25, name: 'アコースティックギター', sample: 'acoustic_guitar_steel' },
  { program: 27, name: 'クリーンギター', sample: 'electric_guitar_clean' },
  { program: 29, name: 'オーバードライブギター', sample: 'overdriven_guitar' },
  { program: 32, name: 'アコースティックベース', sample: 'acoustic_bass' },
  { program: 33, name: 'エレクトリックベース', sample: 'electric_bass_finger' },
  { program: 38, name: 'シンセベース', sample: 'synth_bass_1' },
  { program: 48, name: 'ストリングス', sample: 'string_ensemble_1' },
  { program: 65, name: 'アルトサックス', sample: 'alto_sax' },
  { program: 73, name: 'フルート', sample: 'flute' },
  { program: 80, name: '矩形波リード', sample: 'lead_1_square' },
  { program: 81, name: 'のこぎり波リード', sample: 'lead_2_sawtooth' },
  { program: 89, name: 'ウォームパッド', sample: 'pad_2_warm' },
] as const;
export type InstrumentProgram = (typeof instruments)[number]['program'];

export function isInstrumentProgram(value: unknown): value is InstrumentProgram {
  return instruments.some((instrument) => instrument.program === value);
}
