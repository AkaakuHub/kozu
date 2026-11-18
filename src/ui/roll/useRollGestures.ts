import { useEffect, useEffectEvent, useLayoutEffect, useRef } from 'react';
import type { RefObject } from 'react';
import { zoomRoll } from '../../core/roll-zoom.ts';

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
  const pending = useRef<{ zoom: number; left: number } | null>(null);
  const apply = useEffectEvent((factor: number, x: number, pan: number) => {
    const view = viewport.current;
    if (!view) return;
    const current = pending.current ?? { zoom, left: view.scrollLeft };
    const next = zoomRoll(current, factor, x, pan, keyboardWidth);
    if (next.zoom === zoom) {
      if (pending.current) {
        pending.current = null;
        change(zoom);
      }
      view.scrollLeft = next.left;
      return;
    }
    pending.current = next;
    change(next.zoom);
  });
  useLayoutEffect(() => {
    const view = viewport.current;
    if (!view || pending.current?.zoom !== zoom) return;
    view.scrollLeft = pending.current.left;
    pending.current = null;
  }, [viewport, zoom]);

  const cancel = useEffectEvent(cancelDrag);
  useEffect(() => {
    const view = viewport.current;
    if (!view) return;
    let last: Point | null = null;
    let gap = 0;
    let singleEdits = false;
    let suppressTap = false;
    const beginPan = () => {
      if (suppressTap) return;
      suppressTap = true;
      cancel();
    };
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
      apply(Math.exp(-event.deltaY * 0.012), scrollPoint(event), 0);
    };
    const start = (event: TouchEvent) => {
      if (!last && !(event.target instanceof Node && view.contains(event.target))) return;
      const a = event.touches[0],
        b = event.touches[1];
      if (!a) return;
      if (b) {
        beginPan();
        last = middle(a, b);
        gap = distance(a, b);
        singleEdits = false;
        event.preventDefault();
      } else {
        suppressTap = false;
        last = { x: a.clientX, y: a.clientY };
        singleEdits =
          event.target instanceof Element &&
          (Boolean(event.target.closest('.roll-note[data-selected=true]')) ||
            (view.dataset.draw === 'true' && event.target.matches('.roll-grid')));
      }
    };
    const move = (event: TouchEvent) => {
      const a = event.touches[0],
        b = event.touches[1];
      if (!a || !last || (singleEdits && !b)) return;
      const point = b ? middle(a, b) : { x: a.clientX, y: a.clientY };
      const dx = point.x - last.x;
      const dy = point.y - last.y;
      if (!b && Math.abs(dx) + Math.abs(dy) < 4) return;
      beginPan();
      event.preventDefault();
      view.scrollTop -= dy;
      const nextGap = b ? distance(a, b) : 0;
      const factor = gap >= 12 && nextGap >= 12 ? nextGap / gap : 1;
      apply(factor, point.x - view.getBoundingClientRect().left, dx);
      gap = nextGap;
      last = point;
    };
    const end = (event: TouchEvent) => {
      if (!last) return;
      if (suppressTap && event.cancelable) event.preventDefault();
      const a = event.touches[0],
        b = event.touches[1];
      last = a ? (b ? middle(a, b) : { x: a.clientX, y: a.clientY }) : null;
      gap = a && b ? distance(a, b) : 0;
    };
    const pointerDown = (event: PointerEvent) => {
      if (event.pointerType !== 'touch' && !last) suppressTap = false;
    };
    const blockTap = (event: MouseEvent) => {
      if (!suppressTap || (event.type === 'click' && event.detail === 0)) return;
      event.preventDefault();
      event.stopPropagation();
    };
    view.addEventListener('wheel', wheel, { passive: false });
    view.addEventListener('pointerdown', pointerDown, true);
    view.addEventListener('click', blockTap, true);
    view.addEventListener('contextmenu', blockTap, true);
    document.addEventListener('touchstart', start, { passive: false, capture: true });
    view.addEventListener('touchmove', move, { passive: false });
    document.addEventListener('touchend', end, { passive: false, capture: true });
    document.addEventListener('touchcancel', end, true);
    return () => {
      view.removeEventListener('wheel', wheel);
      view.removeEventListener('pointerdown', pointerDown, true);
      view.removeEventListener('click', blockTap, true);
      view.removeEventListener('contextmenu', blockTap, true);
      document.removeEventListener('touchstart', start, true);
      view.removeEventListener('touchmove', move);
      document.removeEventListener('touchend', end, true);
      document.removeEventListener('touchcancel', end, true);
    };
  }, [viewport]);
}
