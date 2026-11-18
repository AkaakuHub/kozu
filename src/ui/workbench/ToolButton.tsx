import { useState } from 'react';
import { createPortal } from 'react-dom';
import type { MouseEvent } from 'react';
import type { LucideIcon } from 'lucide-react';

export function ToolButton({
  icon: Icon,
  label,
  onClick,
  disabled,
  pressed,
  primary,
  popup,
  popupTarget,
  tooltip = label,
}: {
  icon: LucideIcon;
  label: string;
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
  pressed?: boolean;
  primary?: boolean;
  popup?: 'dialog';
  popupTarget?: string | undefined;
  tooltip?: string;
}) {
  const [tip, setTip] = useState<{ x: number; y: number } | null>(null);
  const position = (target: HTMLElement) => {
    const box = target.getBoundingClientRect();
    setTip({ x: Math.max(4, Math.min(box.left, innerWidth - 230)), y: box.bottom + 4 });
  };
  return (
    <>
      <button
        className="tool-button"
        type="button"
        aria-label={label}
        aria-pressed={pressed}
        aria-haspopup={popup}
        aria-expanded={popup && Boolean(popupTarget)}
        popoverTarget={popupTarget}
        data-primary={primary}
        disabled={disabled}
        onPointerEnter={(event) => {
          if (event.pointerType === 'mouse') position(event.currentTarget);
        }}
        onPointerLeave={() => setTip(null)}
        onFocus={(event) => {
          if (event.currentTarget.matches(':focus-visible')) position(event.currentTarget);
        }}
        onBlur={() => setTip(null)}
        onClick={(event) => {
          setTip(null);
          onClick(event);
        }}
      >
        <Icon aria-hidden="true" size={18} strokeWidth={1.8} />
      </button>
      {tip &&
        createPortal(
          <span aria-hidden="true" className="tool-tooltip" style={{ left: tip.x, top: tip.y }}>
            {tooltip}
          </span>,
          document.body,
        )}
    </>
  );
}
