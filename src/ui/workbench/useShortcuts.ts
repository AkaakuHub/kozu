import { useEffect, useEffectEvent } from 'react';

interface Actions {
  play: () => void;
  rewind: () => void;
  open: () => void;
  save: () => void;
  undo: () => void;
  redo: () => void;
  loop: () => void;
}
export function useShortcuts(actions: Actions, windowOpen: boolean) {
  const onKey = useEffectEvent((event: KeyboardEvent) => {
    if (event.defaultPrevented || event.isComposing || windowOpen) return;
    if (
      event.target instanceof Element &&
      event.target.closest(
        'input, textarea, select, [contenteditable], [role="dialog"], [role="menu"]',
      )
    )
      return;
    const key = event.key.toLowerCase();
    const modifier = event.metaKey || event.ctrlKey;
    let run: (() => void) | undefined;
    if (modifier) {
      if (key === 'z') run = event.shiftKey ? actions.redo : actions.undo;
      if (key === 'y') run = actions.redo;
      if (key === 'o') run = actions.open;
      if (key === 's') run = actions.save;
    } else if (!event.altKey) {
      if (event.code === 'Space') run = actions.play;
      if (key === 'home') run = actions.rewind;
      if (key === 'l') run = actions.loop;
    }
    if (!run) return;
    event.preventDefault();
    if (!event.repeat) run();
  });
  useEffect(() => {
    const handle = (event: KeyboardEvent) => onKey(event);
    window.addEventListener('keydown', handle);
    return () => window.removeEventListener('keydown', handle);
  }, []);
}
