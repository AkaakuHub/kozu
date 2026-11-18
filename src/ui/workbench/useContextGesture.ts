import { useEffect, useRef } from 'react';
import type { KeyboardEvent, MouseEvent, PointerEvent } from 'react';

export function useContextGesture<T extends HTMLElement>(open: (anchor: T) => void) {
  const press = useRef<{
    pointer: number;
    x: number;
    y: number;
    timer: ReturnType<typeof setTimeout>;
  } | null>(null);
  const held = useRef(false);
  const cancel = () => {
    if (press.current) clearTimeout(press.current.timer);
    press.current = null;
  };
  useEffect(() => cancel, []);
  return {
    onPointerDown(event: PointerEvent<T>) {
      held.current = false;
      cancel();
      if (event.pointerType !== 'touch' || !event.isPrimary) return;
      const anchor = event.currentTarget;
      press.current = {
        pointer: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        timer: setTimeout(() => {
          press.current = null;
          held.current = true;
          open(anchor);
        }, 480),
      };
    },
    onPointerMove(event: PointerEvent<T>) {
      const active = press.current;
      if (
        active &&
        active.pointer === event.pointerId &&
        Math.hypot(event.clientX - active.x, event.clientY - active.y) > 9
      )
        cancel();
    },
    onPointerUp: cancel,
    onPointerCancel: cancel,
    onPointerLeave: cancel,
    onContextMenu(event: MouseEvent<T>) {
      event.preventDefault();
      event.stopPropagation();
      cancel();
      if (!held.current) open(event.currentTarget);
    },
    onKeyDown(event: KeyboardEvent<T>) {
      if (event.key !== 'ContextMenu' && !(event.shiftKey && event.key === 'F10')) return;
      event.preventDefault();
      open(event.currentTarget);
    },
    onClickCapture(event: MouseEvent<T>) {
      if (!held.current) return;
      event.preventDefault();
      event.stopPropagation();
      held.current = false;
    },
  };
}
