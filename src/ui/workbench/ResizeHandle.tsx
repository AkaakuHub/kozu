import { useRef } from 'react';

export function ResizeHandle({
  label,
  axis,
  value,
  range,
  preview,
  commit,
}: {
  label: string;
  axis: 'x' | 'y';
  value: number;
  range: { min: number; max: number };
  preview: (value: number) => void;
  commit: (value: number) => void;
}) {
  const anchor = useRef<{ point: number; value: number } | null>(null);
  const bound = (v: number) => Math.round(Math.max(range.min, Math.min(range.max, v)));
  return (
    <div
      className="resize-handle"
      data-axis={axis}
      role="separator"
      tabIndex={0}
      aria-label={label}
      aria-orientation={axis === 'x' ? 'vertical' : 'horizontal'}
      aria-valuemin={range.min}
      aria-valuemax={range.max}
      aria-valuenow={value}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        anchor.current = { point: axis === 'x' ? event.clientX : event.clientY, value };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        const start = anchor.current;
        if (start)
          preview(
            bound(start.value + (axis === 'x' ? event.clientX : event.clientY) - start.point),
          );
      }}
      onPointerUp={(event) => {
        const start = anchor.current;
        anchor.current = null;
        if (start) {
          const next = bound(
            start.value + (axis === 'x' ? event.clientX : event.clientY) - start.point,
          );
          if (next !== start.value) commit(next);
        }
      }}
      onPointerCancel={() => {
        if (anchor.current) preview(anchor.current.value);
        anchor.current = null;
      }}
      onKeyDown={(event) => {
        const negative = axis === 'x' ? 'ArrowLeft' : 'ArrowUp';
        const positive = axis === 'x' ? 'ArrowRight' : 'ArrowDown';
        if (event.key !== negative && event.key !== positive) return;
        event.preventDefault();
        commit(bound(value + (event.key === negative ? -8 : 8)));
      }}
    />
  );
}
