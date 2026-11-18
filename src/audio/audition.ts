import type { Smplr } from 'smplr';
import type { Track } from '../core/types.ts';
import { loadInstrument, previewNotes, previewVoice } from './instruments.ts';

export class Audition {
  private current: { voice: ReturnType<typeof previewVoice>; audio: Smplr } | null = null;
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
    const voice = previewVoice(track);
    if (this.current?.voice !== voice) {
      this.current?.audio.dispose();
      this.current = {
        voice,
        audio: loadInstrument(this.context, this.output, voice),
      };
    }
    const { audio } = this.current;
    try {
      await audio.ready;
    } catch {
      if (request !== this.request) return;
      this.stop();
      throw new Error('試聴音源を読み込めませんでした。');
    }
    if (request !== this.request) return;
    for (const note of notes) audio.start({ note, duration: 0.22, velocity: 88 });
  }

  stop() {
    this.request++;
    this.current?.audio.dispose();
    this.current = null;
  }
}
