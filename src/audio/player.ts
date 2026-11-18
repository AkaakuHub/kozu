import type { Smplr } from 'smplr';
import type { CompiledSong, Project } from '../core/types.ts';
import { audioTempoClock, playbackSeconds } from './clock.ts';
import type { previewVoice } from './instruments.ts';

export class Player {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private frame: number | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private instruments = new Map<
    ReturnType<typeof previewVoice>,
    { audio: Smplr; pitches: Set<string | number> }
  >();
  private generation = 0;

  async play(
    song: CompiledSong,
    project: Project,
    start: number,
    end: number,
    loopStart: number | null,
    progress: (tick: number, playing: boolean) => void,
  ) {
    this.stop();
    const generation = this.generation;
    const context = (this.context ??= new AudioContext());
    await context.resume();
    const { loadInstrument, previewNotes, previewVoice } = await import('./instruments.ts');
    if (generation !== this.generation) return;
    if (!this.master) {
      this.master = context.createGain();
      this.master.gain.value = 0.58;
      const compressor = context.createDynamicsCompressor();
      this.master.connect(compressor).connect(context.destination);
    }
    const tracks = new Map(project.tracks.map((track) => [track.id, track]));
    const floor = loopStart ?? start;
    const source = song.notes.filter((note) => note.end > floor && note.start < end);
    const voices = new Map<ReturnType<typeof previewVoice>, Set<string | number>>();
    for (const note of source) {
      const track = tracks.get(note.trackId)!;
      const voice = previewVoice(track);
      const pitches = voices.get(voice) ?? new Set<string | number>();
      for (const pitch of previewNotes(track, note.pitch)) pitches.add(pitch);
      if (pitches.size) voices.set(voice, pitches);
    }
    await Promise.all(
      [...voices].map(async ([voice, needed]) => {
        let loaded = this.instruments.get(voice);
        if (!loaded || [...needed].some((pitch) => !loaded?.pitches.has(pitch))) {
          const pitches = new Set([...(loaded?.pitches ?? []), ...needed]);
          loaded?.audio.dispose();
          loaded = { pitches, audio: loadInstrument(context, this.master!, voice, [...pitches]) };
          this.instruments.set(voice, loaded);
        }
        try {
          await loaded.audio.ready;
        } catch {
          if (this.instruments.get(voice) === loaded) this.instruments.delete(voice);
          loaded.audio.dispose();
          throw new Error('音源を読み込めませんでした。通信を確認してください。');
        }
      }),
    );
    if (generation !== this.generation) return;
    const { secondsAt: seconds, tickAt } = audioTempoClock(song.tempos);
    const finish = seconds(end);
    const events = (at: number) =>
      source
        .filter((note) => note.end > at)
        .map((note) => {
          const track = tracks.get(note.trackId)!;
          return {
            notes: previewNotes(track, note.pitch),
            instrument: this.instruments.get(previewVoice(track))?.audio,
            at: seconds(Math.max(at, note.start)),
            end: seconds(Math.min(end, note.end)),
            velocity: note.velocity,
          };
        });
    const repeated = loopStart === null ? [] : events(loopStart);
    let queue = events(start);
    const firstOutput = context.currentTime + 0.055;
    const firstPosition = seconds(start);
    const loopPosition = loopStart === null ? null : seconds(loopStart);
    let begun = firstOutput;
    let offset = firstPosition;
    let cursor = 0;
    let nextBegin = begun + finish - offset;
    let nextCursor = 0;
    const pump = () => {
      const now = context.currentTime;
      if (now >= nextBegin) {
        if (loopPosition === null) return;
        queue = repeated;
        cursor = nextCursor;
        nextCursor = 0;
        offset = loopPosition;
        const length = finish - offset;
        begun = nextBegin + Math.floor((now - nextBegin) / length) * length;
        nextBegin = begun + length;
      }
      const enqueue = (items: typeof queue, i: number, base: number) => {
        while (i < items.length && base + items[i]!.at <= now + 0.12) {
          const item = items[i++]!;
          const time = Math.max(now, base + item.at);
          const duration = base + item.end - time;
          if (duration <= 0 || !item.instrument) continue;
          for (const note of item.notes)
            item.instrument.start({ note, time, duration, velocity: item.velocity });
        }
        return i;
      };
      cursor = enqueue(queue, cursor, begun - offset);
      if (loopPosition !== null && nextBegin <= now + 0.12 && finish - loopPosition >= 0.12)
        nextCursor = enqueue(repeated, nextCursor, nextBegin - loopPosition);
    };
    let lastOutput = 0;
    const draw = () => {
      if (generation !== this.generation) return;
      const stamp = context.getOutputTimestamp?.();
      const current =
        stamp?.performanceTime !== undefined &&
        stamp.contextTime !== undefined &&
        stamp.performanceTime > 0
          ? Math.min(
              context.currentTime,
              stamp.contextTime + (performance.now() - stamp.performanceTime) / 1000,
            )
          : context.currentTime;
      lastOutput = Math.max(lastOutput, current);
      const advanced = playbackSeconds(
        lastOutput - firstOutput,
        firstPosition,
        finish,
        loopPosition,
      );
      if (loopPosition === null && advanced >= finish) {
        this.stop();
        progress(end, false);
        return;
      }
      progress(tickAt(advanced), true);
      this.frame = requestAnimationFrame(draw);
    };
    this.timer = setInterval(pump, 24);
    pump();
    this.frame = requestAnimationFrame(draw);
  }

  stop() {
    this.generation++;
    if (this.frame !== null) cancelAnimationFrame(this.frame);
    this.frame = null;
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
    for (const instrument of this.instruments.values()) instrument.audio.stop();
  }

  async dispose() {
    this.stop();
    for (const instrument of this.instruments.values()) instrument.audio.dispose();
    this.instruments.clear();
    const context = this.context;
    this.context = null;
    this.master = null;
    await context?.close();
  }
}
