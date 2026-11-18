import { parseProject } from '../../core/validate.ts';

export async function importScore(file: File) {
  if (file.size > 5_000_000) throw new Error('5MB以内のファイルを選択してください。');
  if (/\.midi?$/i.test(file.name)) {
    const { importMidi } = await import('../../core/midi-import.ts');
    return importMidi(new Uint8Array(await file.arrayBuffer()), file.name.replace(/\.midi?$/i, ''));
  }
  return parseProject(await file.text());
}
