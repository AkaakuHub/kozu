import type { Smplr } from 'smplr';
import type { Track } from '../core/types.ts';
import { auditionInstrument, previewNotes, previewVoice, sampleBank } from './instruments.ts';

export class Audition {
  private current: { bank: Awaited<ReturnType<typeof sampleBank>>; audio: Smplr } | null = null;
  private request = 0;

  constructor(
    private readonly context: AudioContext,
    private readonly output: AudioNode,
  ) {}

  async play(track: Track, pitch: number) {
    const request = ++this.request;
    const notes = previewNotes(track, pitch);
    this.current?.audio.stop();
    if (!notes.length) return;
    try {
      const bank = await sampleBank(this.context, previewVoice(track), notes);
      if (request !== this.request) return;
      if (this.current?.bank !== bank) {
        this.current?.audio.dispose();
        this.current = { bank, audio: auditionInstrument(this.context, this.output, bank) };
      }
      const { audio } = this.current;
      await audio.ready;
      if (request !== this.request) return;
      for (const note of notes)
        audio.start({ note, velocity: 88, ...(track.kind === 'drums' ? {} : { duration: 0.22 }) });
    } catch {
      if (request !== this.request) return;
      this.stop();
      throw new Error('試聴音源を読み込めませんでした。');
    }
  }

  stop() {
    this.request++;
    this.current?.audio.dispose();
    this.current = null;
  }
}
