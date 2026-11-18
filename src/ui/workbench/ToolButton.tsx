import type { LucideIcon } from 'lucide-react';

export function ToolButton({
  icon: Icon,
  label,
  onClick,
  disabled,
  pressed,
  primary,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  pressed?: boolean;
  primary?: boolean;
}) {
  return (
    <button
      className="tool-button"
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      data-primary={primary}
      disabled={disabled}
      onClick={onClick}
    >
      <Icon aria-hidden="true" size={18} strokeWidth={1.8} />
    </button>
  );
}
