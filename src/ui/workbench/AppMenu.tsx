import type { MenuGroup } from './MenuBar.tsx';
import { AnchoredPopup } from './AnchoredPopup.tsx';

export function AppMenu({
  anchor,
  close,
  groups,
}: {
  anchor: HTMLElement;
  close: () => void;
  groups: MenuGroup[];
}) {
  return (
    <AnchoredPopup
      anchor={anchor}
      id="app-menu-popup"
      role="menu"
      label={groups.length === 1 ? groups[0]!.label : 'その他のメニュー'}
      close={close}
      onKeyDown={(event) => {
        if (event.key === 'Tab') {
          anchor.focus({ preventScroll: true });
          close();
          return;
        }
        if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
        const buttons = [
          ...event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not([disabled])'),
        ];
        if (!buttons.length) return;
        const focus = buttons.findIndex((button) => button === document.activeElement);
        const next =
          event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? buttons.length - 1
              : (focus + (event.key === 'ArrowDown' ? 1 : buttons.length - 1)) % buttons.length;
        buttons[next]?.focus();
        event.preventDefault();
      }}
    >
      {groups.map((group) => (
        <div role="group" aria-label={group.label} key={group.label}>
          {groups.length > 1 && (
            <div className="menu-heading" aria-hidden="true">
              {group.label}
            </div>
          )}
          {group.commands.map(({ label, icon: Icon, run, disabled, shortcut }) => (
            <button
              className="app-menu-item"
              type="button"
              role="menuitem"
              tabIndex={-1}
              key={label}
              disabled={disabled}
              onClick={() => {
                anchor.focus({ preventScroll: true });
                close();
                run();
              }}
            >
              <Icon aria-hidden="true" size={16} />
              <span>{label}</span>
              {shortcut && <kbd className="menu-shortcut">{shortcut}</kbd>}
            </button>
          ))}
        </div>
      ))}
    </AnchoredPopup>
  );
}
