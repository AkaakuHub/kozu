import { mixLevel } from '../core/track-mix.ts';
import type { Track } from '../core/types.ts';

export class Mixer {
  private readonly channels = new Map<string, { node: GainNode; level: number }>();

  constructor(
    private readonly context: AudioContext,
    private readonly output: AudioNode,
  ) {}

  sync(tracks: Track[]) {
    const ids = new Set(tracks.map(({ id }) => id));
    for (const [id, channel] of this.channels) {
      if (ids.has(id)) continue;
      channel.node.disconnect();
      this.channels.delete(id);
    }
    const solo = tracks.some((track) => track.solo);
    for (const track of tracks) {
      const level = mixLevel(track, solo);
      if (this.channels.has(track.id)) this.setLevel(track.id, level);
      else {
        const node = this.context.createGain();
        node.gain.value = level;
        node.connect(this.output);
        this.channels.set(track.id, { node, level });
      }
    }
  }

  setLevel(id: string, level: number) {
    const channel = this.channels.get(id);
    if (!channel || channel.level === level) return;
    const time = this.context.currentTime;
    channel.node.gain.cancelScheduledValues(time);
    channel.node.gain.setTargetAtTime(level, time, 0.008);
    channel.level = level;
  }

  input(id: string) {
    return this.channels.get(id)!.node;
  }
}
