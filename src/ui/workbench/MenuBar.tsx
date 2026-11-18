import { lazy, Suspense, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { AudioLines, Ellipsis } from 'lucide-react';

const AppMenu = lazy(() => import('./AppMenu.tsx').then((module) => ({ default: module.AppMenu })));

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
export function MenuBar({ mode, menus }: { mode: 'light' | 'dark'; menus: MenuGroup[] }) {
  const [open, setOpen] = useState<{ group: string; anchor: HTMLElement } | null>(null);
  const more = open?.group === 'more';
  const groups = more
    ? menus.filter((menu) => !menu.compact)
    : menus.filter((menu) => menu.label === open?.group);
  return (
    <header className="menubar">
      <div className="app-mark">
        <AudioLines size={18} aria-hidden="true" />
        <span>kozu</span>
      </div>
      <nav aria-label="アプリメニュー">
        {menus.map((menu) => (
          <button
            key={menu.label}
            type="button"
            data-compact={menu.compact}
            aria-haspopup="menu"
            aria-expanded={open?.group === menu.label}
            onClick={(event) => setOpen({ group: menu.label, anchor: event.currentTarget })}
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
          onClick={(event) => setOpen({ group: 'more', anchor: event.currentTarget })}
        >
          <Ellipsis aria-hidden="true" size={20} />
        </button>
      </nav>
      {open && (
        <Suspense fallback={null}>
          <AppMenu mode={mode} anchor={open.anchor} close={() => setOpen(null)} groups={groups} />
        </Suspense>
      )}
    </header>
  );
}
