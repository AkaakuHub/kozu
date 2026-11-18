import { memo } from 'react';
import { scaleRegions } from '../../core/scale-guide.ts';
import { inScale, mod } from '../../core/theory.ts';
import type { KeyPoint } from '../../core/types.ts';

export const ScaleGuide = memo(function ScaleGuide({
  keys,
  start,
  length,
  pixelsPerTick,
  rowHeight,
}: {
  keys: KeyPoint[];
  start: number;
  length: number;
  pixelsPerTick: number;
  rowHeight: number;
}) {
  return scaleRegions(keys, start, start + length).map((region) => {
    const bands = Array.from({ length: 12 }, (_, index) => {
      const pitch = 127 - index;
      const color =
        mod(pitch) === region.key.tonic
          ? 'var(--scale-tonic)'
          : inScale(pitch, region.key)
            ? 'var(--scale-note)'
            : 'transparent';
      return `${color} ${index * rowHeight}px ${(index + 1) * rowHeight}px`;
    });
    return (
      <div
        aria-hidden="true"
        className="roll-scale-guide"
        key={region.start}
        style={{
          left: (region.start - start) * pixelsPerTick,
          width: (region.end - region.start) * pixelsPerTick,
          backgroundImage: `repeating-linear-gradient(to bottom, ${bands.join(', ')})`,
        }}
      />
    );
  });
});
