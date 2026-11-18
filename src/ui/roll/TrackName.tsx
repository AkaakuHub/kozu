import { useContextGesture } from '../workbench/useContextGesture.ts';

export function TrackName({
  name,
  selected,
  expanded,
  select,
  open,
}: {
  name: string;
  selected: boolean;
  expanded: boolean;
  select: () => void;
  open: (anchor: HTMLButtonElement) => void;
}) {
  const gesture = useContextGesture(open);
  return (
    <button
      {...gesture}
      className="track-name"
      type="button"
      onClick={select}
      aria-pressed={selected}
      aria-haspopup="menu"
      aria-expanded={expanded}
      aria-controls={expanded ? 'track-menu-popup' : undefined}
    >
      {name}
    </button>
  );
}
