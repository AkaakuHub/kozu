import { useEffect, useEffectEvent, useRef } from 'react';
import type { RefObject } from 'react';

interface Point {
  x: number;
  y: number;
}
const middle = (a: Touch, b: Touch) => ({
  x: (a.clientX + b.clientX) / 2,
  y: (a.clientY + b.clientY) / 2,
});
const distance = (a: Touch, b: Touch) => Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);

export function useRollGestures(
  viewport: RefObject<HTMLDivElement | null>,
  keyboardWidth: number,
  zoom: number,
  change: (zoom: number) => void,
  cancelDrag: () => void,
) {
  const anchor = useRef<{ time: number; x: number } | null>(null);
  const level = useRef(zoom);
  const apply = useEffectEvent((value: number, x: number, pan: number) => {
    const view = viewport.current;
    if (!view) return;
    const next = Math.min(240, Math.max(24, value));
    if (Math.abs(level.current - next) < 0.2) {
      view.scrollLeft -= pan;
      return;
    }
    anchor.current = { time: (view.scrollLeft + x + pan - keyboardWidth) / level.current, x };
    change(next);
  });
  useEffect(() => {
    const view = viewport.current;
    level.current = zoom;
    if (!view || !anchor.current) return;
    view.scrollLeft = anchor.current.time * zoom - anchor.current.x + keyboardWidth;
    anchor.current = null;
  }, [viewport, keyboardWidth, zoom]);

  const cancel = useEffectEvent(cancelDrag);
  useEffect(() => {
    const view = viewport.current;
    if (!view) return;
    let last: Point | null = null;
    let gap = 0;
    let singleEdits = false;
    const scrollPoint = (event: MouseEvent) => event.clientX - view.getBoundingClientRect().left;
    const wheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) {
        if (event.shiftKey && event.deltaX === 0 && event.deltaY !== 0) {
          event.preventDefault();
          view.scrollLeft +=
            event.deltaY *
            (event.deltaMode === 1 ? 22 : event.deltaMode === 2 ? view.clientWidth : 1);
        }
        return;
      }
      event.preventDefault();
      apply(level.current * Math.exp(-event.deltaY * 0.012), scrollPoint(event), 0);
    };
    const start = (event: TouchEvent) => {
      const [a, b] = Array.from(event.touches);
      if (!a) return;
      if (b) {
        cancel();
        last = middle(a, b);
        gap = distance(a, b);
        singleEdits = false;
        event.preventDefault();
      } else {
        last = { x: a.clientX, y: a.clientY };
        singleEdits =
          event.target instanceof Element &&
          (Boolean(event.target.closest('.roll-note[data-selected=true]')) ||
            (view.dataset.draw === 'true' && event.target.matches('.roll-grid')));
      }
    };
    const move = (event: TouchEvent) => {
      const [a, b] = Array.from(event.touches);
      if (!a || !last || (singleEdits && !b)) return;
      const point = b ? middle(a, b) : { x: a.clientX, y: a.clientY };
      const dx = point.x - last.x;
      const dy = point.y - last.y;
      if (!b && Math.abs(dx) + Math.abs(dy) < 4) return;
      event.preventDefault();
      view.scrollTop -= dy;
      if (b) {
        const nextGap = distance(a, b);
        if (gap >= 12 && nextGap >= 12)
          apply((level.current * nextGap) / gap, point.x - view.getBoundingClientRect().left, dx);
        gap = nextGap;
      } else view.scrollLeft -= dx;
      last = point;
    };
    const end = (event: TouchEvent) => {
      const first = event.touches[0];
      last = first ? { x: first.clientX, y: first.clientY } : null;
      gap = 0;
    };
    view.addEventListener('wheel', wheel, { passive: false });
    view.addEventListener('touchstart', start, { passive: false });
    view.addEventListener('touchmove', move, { passive: false });
    view.addEventListener('touchend', end);
    view.addEventListener('touchcancel', end);
    return () => {
      view.removeEventListener('wheel', wheel);
      view.removeEventListener('touchstart', start);
      view.removeEventListener('touchmove', move);
      view.removeEventListener('touchend', end);
      view.removeEventListener('touchcancel', end);
    };
  }, [viewport]);
}
