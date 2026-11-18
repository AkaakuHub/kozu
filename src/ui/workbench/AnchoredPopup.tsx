import { useLayoutEffect, useRef } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import { createPortal } from 'react-dom';

export function AnchoredPopup({
  anchor,
  id,
  label,
  role,
  close,
  onKeyDown,
  children,
}: {
  anchor: HTMLElement;
  id: string;
  label: string;
  role: 'menu' | 'dialog';
  close: () => void;
  onKeyDown?: (event: KeyboardEvent<HTMLDivElement>) => void;
  children: ReactNode;
}) {
  const element = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const popup = element.current;
    if (!popup) return;
    const place = () => {
      const bounds = anchor.getBoundingClientRect();
      const width = popup.offsetWidth;
      const height = popup.offsetHeight;
      popup.style.left = `${Math.max(4, Math.min(bounds.left, innerWidth - width - 4))}px`;
      const below = innerHeight - bounds.bottom;
      const top = below >= height || below >= bounds.top ? bounds.bottom : bounds.top - height;
      popup.style.top = `${Math.min(Math.max(4, top), Math.max(4, innerHeight - height - 4))}px`;
    };
    popup.showPopover({ source: anchor });
    place();
    popup
      .querySelector<HTMLElement>('[role="menuitem"]:not([disabled]), input')
      ?.focus({ preventScroll: true });
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [anchor]);

  return createPortal(
    <div
      ref={element}
      id={id}
      className="anchored-popup"
      popover="auto"
      role={role}
      aria-label={label}
      onBeforeToggle={(event) => {
        if (event.newState === 'closed') close();
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          anchor.focus({ preventScroll: true });
          close();
          return;
        }
        onKeyDown?.(event);
      }}
    >
      {children}
    </div>,
    document.body,
  );
}
