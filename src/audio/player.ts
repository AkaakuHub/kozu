import type { Smplr } from 'smplr';
import type { CompiledSong, Project, Track } from '../core/types.ts';
import { audioTempoClock, playbackSeconds } from './clock.ts';
import type { previewVoice } from './instruments.ts';
import type { Audition } from './audition.ts';
import { Mixer } from './mixer.ts';
import { mixLevel } from '../core/track-mix.ts';

type Voice = ReturnType<typeof previewVoice>;

export class Player {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private frame: number | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private instruments = new Map<string, { voice: Voice; audio: Smplr }>();
  private mixer: Mixer | null = null;
  private generation = 0;
  private preview: Audition | null = null;
  private previewRequest = 0;

  private output(context: AudioContext) {
    if (!this.master) {
      this.master = context.createGain();
      this.master.gain.value = 0.58;
      this.master.connect(context.createDynamicsCompressor()).connect(context.destination);
    }
    return this.master;
  }

  async audition(track: Track, pitch: number) {
    const request = ++this.previewRequest;
    const context = (this.context ??= new AudioContext());
    const [, module] = await Promise.all([
      context.state === 'running' ? undefined : context.resume(),
      this.preview ? undefined : import('./audition.ts'),
    ]);
    if (request !== this.previewRequest) return;
    if (module) this.preview ??= new module.Audition(context, this.output(context));
    await this.preview?.play(track, pitch);
  }

  stopAudition() {
    this.previewRequest++;
    this.preview?.stop();
  }

  mix(tracks: Track[]) {
    this.mixer?.sync(tracks);
  }

  previewGain(tracks: Track[], id: string, gain: number) {
    const track = tracks.find((item) => item.id === id);
    if (track)
      this.mixer?.setLevel(
        id,
        mixLevel(
          track,
          tracks.some((item) => item.solo),
          gain,
        ),
      );
  }

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
    const mixer = (this.mixer ??= new Mixer(context, this.output(context)));
    mixer.sync(project.tracks);
    const [, { loadInstrument, previewNotes, previewVoice }] = await Promise.all([
      context.resume(),
      import('./instruments.ts'),
    ]);
    if (generation !== this.generation) return;
    const tracks = new Map(project.tracks.map((track) => [track.id, track]));
    const floor = loopStart ?? start;
    const source = song.notes.filter((note) => note.end > floor && note.start < end);
    const required = new Map<string, Voice>();
    for (const note of source) {
      const track = tracks.get(note.trackId)!;
      if (!required.has(track.id) && previewNotes(track, note.pitch).length)
        required.set(track.id, previewVoice(track));
    }
    for (const [id, loaded] of this.instruments) {
      const track = tracks.get(id);
      if (track && previewVoice(track) === loaded.voice) continue;
      loaded.audio.dispose();
      this.instruments.delete(id);
    }
    await Promise.all(
      [...required].map(async ([id, voice]) => {
        let loaded = this.instruments.get(id);
        if (!loaded) {
          loaded = { voice, audio: loadInstrument(context, mixer.input(id), voice) };
          this.instruments.set(id, loaded);
        }
        try {
          await loaded.audio.ready;
        } catch {
          if (this.instruments.get(id) === loaded) this.instruments.delete(id);
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
            instrument: this.instruments.get(track.id)?.audio,
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
    this.stopAudition();
    this.preview = null;
    for (const instrument of this.instruments.values()) instrument.audio.dispose();
    this.instruments.clear();
    const context = this.context;
    this.context = null;
    this.master = null;
    this.mixer = null;
    await context?.close();
  }
}
