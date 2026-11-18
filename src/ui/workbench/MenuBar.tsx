import { useState } from 'react';
import { AppMenu } from './AppMenu.tsx';
import type { LucideIcon } from 'lucide-react';
import { AudioLines, Ellipsis } from 'lucide-react';

interface Command {
  label: string;
  icon: LucideIcon;
  run: () => void;
  disabled?: boolean;
  shortcut?: string;
}
export interface MenuGroup {
  label: string;
  commands: Command[];
  compact?: boolean;
}
export function MenuBar({ menus, goHome }: { menus: MenuGroup[]; goHome: () => void }) {
  const [open, setOpen] = useState<{ group: string; anchor: HTMLElement } | null>(null);
  const more = open?.group === 'more';
  const groups = more
    ? menus.filter((menu) => !menu.compact)
    : menus.filter((menu) => menu.label === open?.group);
  const toggle = (group: string, anchor: HTMLElement) => {
    setOpen((current) => (current?.group === group ? null : { group, anchor }));
  };
  return (
    <header className="menubar">
      <a
        className="app-mark"
        href="/"
        aria-label="kozuのプロジェクト一覧"
        onClick={(event) => {
          if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
          event.preventDefault();
          goHome();
        }}
      >
        <AudioLines size={18} aria-hidden="true" />
        <span>kozu</span>
      </a>
      <nav aria-label="アプリメニュー">
        {menus.map((menu) => (
          <button
            key={menu.label}
            type="button"
            data-compact={menu.compact}
            aria-haspopup="menu"
            aria-expanded={open?.group === menu.label}
            popoverTarget={open?.group === menu.label ? 'app-menu-popup' : undefined}
            onClick={(event) => {
              event.preventDefault();
              toggle(menu.label, event.currentTarget);
            }}
          >
            {menu.label}
          </button>
        ))}
        <button
          type="button"
          className="more-menu"
          aria-label="その他のメニュー"
          aria-haspopup="menu"
          aria-expanded={more}
          popoverTarget={more ? 'app-menu-popup' : undefined}
          onClick={(event) => {
            event.preventDefault();
            toggle('more', event.currentTarget);
          }}
        >
          <Ellipsis aria-hidden="true" size={20} />
        </button>
      </nav>
      {open && (
        <AppMenu
          key={open.group}
          anchor={open.anchor}
          close={() => setOpen((current) => (current === open ? null : current))}
          groups={groups}
        />
      )}
    </header>
  );
}
