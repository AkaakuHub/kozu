import type { TempoPoint } from '../core/types.ts';
import { PPQ } from '../core/types.ts';
import { valueAt } from '../core/time.ts';

export function audioTempoClock(tempos: TempoPoint[]) {
  let elapsed = 0;
  const ticks = tempos.map((tempo, index) => {
    const earlier = tempos[index - 1];
    if (earlier) elapsed += (tempo.tick - earlier.tick) * (60 / (earlier.bpm * PPQ));
    return { tick: tempo.tick, elapsed, perTick: 60 / (tempo.bpm * PPQ) };
  });
  const seconds = ticks.map((point) => ({ ...point, fromTick: point.tick, tick: point.elapsed }));
  return {
    secondsAt: (tick: number) => {
      const point = valueAt(ticks, tick);
      return point.elapsed + (tick - point.tick) * point.perTick;
    },
    tickAt: (time: number) => {
      const point = valueAt(seconds, time);
      return point.fromTick + (time - point.elapsed) / point.perTick;
    },
  };
}

export function playbackSeconds(elapsed: number, first: number, end: number, loop: number | null) {
  const position = first + Math.max(0, elapsed);
  if (position < end) return position;
  return loop === null ? end : loop + ((position - end) % (end - loop));
}
