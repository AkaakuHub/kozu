import { PPQ } from './types.ts';
import type { CompiledSong, Key, Project } from './types.ts';
import { keyName, mod } from './theory.ts';
interface Event {
  tick: number;
  priority: number;
  bytes: number[];
}
const ascii = (s: string) => Array.from(new TextEncoder().encode(s));
const u16 = (n: number) => [(n >>> 8) & 255, n & 255];
const u32 = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
function vlq(value: number): number[] {
  const bytes = [value & 127];
  while ((value = Math.floor(value / 128)) > 0) bytes.unshift((value & 127) | 128);
  return bytes;
}
function meta(type: number, data: number[]): number[] {
  return [255, type, ...vlq(data.length), ...data];
}
function chunk(name: string, data: number[]): number[] {
  return [...ascii(name), ...u32(data.length), ...data];
}
function encodeTrack(events: Event[], end: number): number[] {
  events.sort((a, b) => a.tick - b.tick || a.priority - b.priority);
  let tick = 0;
  const bytes: number[] = [];
  for (const e of events) {
    const delta = Math.round(e.tick) - tick;
    if (delta < 0) throw new Error('MIDIイベントの時刻が不正です。');
    bytes.push(...vlq(delta), ...e.bytes);
    tick = Math.round(e.tick);
  }
  bytes.push(...vlq(Math.max(0, end - tick)), 255, 47, 0);
  return chunk('MTrk', bytes);
}
function signature(key: Key): [number, number] {
  const minor = key.mode === 'minor' || key.mode === 'harmonicMinor';
  const relative =
    key.mode === 'dorian'
      ? -2
      : key.mode === 'mixolydian'
        ? -7
        : key.mode === 'lydian'
          ? -5
          : minor
            ? 3
            : 0;
  const pc = mod(key.tonic + relative);
  const options: number[] = [];
  for (let sf = -7; sf <= 7; sf++) if (mod(sf * 7) === pc) options.push(sf);
  options.sort((a, b) => Math.abs(a) - Math.abs(b) || (key.preferFlats ? a - b : b - a));
  return [(options[0] ?? 0) & 255, minor ? 1 : 0];
}
export function exportMidi(project: Project, song: CompiledSong): Uint8Array {
  if (song.diagnostics.some((d) => d.severity === 'error'))
    throw new Error('エラーを修正してからMIDIを書き出してください。');
  if (!song.tempos.length) throw new Error('テンポ情報がありません。');
  const master: Event[] = [{ tick: 0, priority: 0, bytes: meta(3, ascii(project.title)) }];
  for (const t of song.tempos) {
    const us = Math.round(60_000_000 / t.bpm);
    master.push({
      tick: t.tick,
      priority: 1,
      bytes: meta(81, [(us >>> 16) & 255, (us >>> 8) & 255, us & 255]),
    });
  }
  for (const t of song.meters)
    master.push({
      tick: t.tick,
      priority: 2,
      bytes: meta(88, [t.numerator, Math.log2(t.denominator), 24, 8]),
    });
  for (const t of song.keys) {
    master.push(
      { tick: t.tick, priority: 3, bytes: meta(89, signature(t.key)) },
      { tick: t.tick, priority: 4, bytes: meta(1, ascii(`Key: ${keyName(t.key)}`)) },
    );
  }
  for (const m of song.markers)
    master.push({ tick: m.tick, priority: 5, bytes: meta(6, ascii(m.label)) });
  const trackChunks: number[][] = [encodeTrack(master, song.totalTicks)];
  for (const track of project.tracks) {
    const events: Event[] = [{ tick: 0, priority: 0, bytes: meta(3, ascii(track.name)) }];
    for (const note of song.notes.filter((n) => n.trackId === track.id))
      events.push(
        { tick: note.start, priority: 3, bytes: [0x90 | note.channel, note.pitch, note.velocity] },
        { tick: note.end, priority: 1, bytes: [0x80 | note.channel, note.pitch, 0] },
      );
    const channel = song.notes.find((n) => n.trackId === track.id)?.channel;
    if (channel !== undefined && track.program !== undefined)
      events.push({ tick: 0, priority: 2, bytes: [0xc0 | channel, track.program] });
    if (channel !== undefined)
      for (const br of song.breaks.filter((b) => b.trackId === track.id))
        events.push({ tick: br.tick, priority: 2, bytes: [0xb0 | channel, 64, 0] });
    trackChunks.push(encodeTrack(events, song.totalTicks));
  }
  return new Uint8Array([
    ...chunk('MThd', [...u16(1), ...u16(trackChunks.length), ...u16(PPQ)]),
    ...trackChunks.flat(),
  ]);
}
