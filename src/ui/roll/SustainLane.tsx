import { memo } from 'react';
import type { RefObject } from 'react';
import { valueIndexAt } from '../../core/time.ts';

interface Point {
  id: string;
  tick: number;
  value: number;
}

export const SustainLane = memo(function SustainLane({
  points,
  range,
  total,
  height,
  px,
  step,
  cursor,
  select,
}: {
  points: Point[];
  range: { first: number; last: number };
  total: number;
  height: number;
  px: number;
  step: number;
  cursor: RefObject<number>;
  select: (point: { id: string | null; tick: number; value: number }) => void;
}) {
  const first = valueIndexAt(points, range.first - 1);
  const last = valueIndexAt(points, range.last);
  return (
    <div
      className="roll-pedal"
      role="group"
      aria-label="サステインペダル"
      style={{ height }}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <span className="roll-corner">CC64</span>
      <div
        className="roll-pedal-track"
        style={{ width: total * px, backgroundSize: `${step * px}px 100%` }}
      >
        <button
          className="roll-pedal-add"
          type="button"
          aria-label="サステインペダルを追加"
          onClick={(event) => {
            const offset = event.clientX - event.currentTarget.getBoundingClientRect().left;
            const raw = event.detail === 0 ? cursor.current : offset / px;
            const tick = Math.min(total - 1, Math.max(0, Math.round(raw / step) * step));
            const prior = points[valueIndexAt(points, tick)];
            const point = prior && prior.tick <= tick ? prior : undefined;
            select(
              point?.tick === tick
                ? point
                : {
                    id: null,
                    tick,
                    value: point && point.value >= 64 ? 0 : 127,
                  },
            );
          }}
        />
        {points.slice(first, last + 1).map((point, index) => {
          if (point.tick > range.last) return null;
          const start = Math.max(range.first, point.tick);
          const end = Math.min(range.last, points[first + index + 1]?.tick ?? total);
          const top = `${82 - (point.value / 127) * 64}%`;
          return (
            <div key={point.id}>
              {end > start && (
                <i
                  className="roll-pedal-level"
                  aria-hidden="true"
                  style={{
                    left: start * px,
                    top,
                    width: (end - start) * px,
                  }}
                />
              )}
              {point.tick >= range.first && (
                <button
                  className="roll-pedal-point"
                  type="button"
                  aria-label={`サステインペダル ${point.tick}ティック、値${point.value}`}
                  title={String(point.value)}
                  style={{ left: point.tick * px, top }}
                  onClick={() => select(point)}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
});
