import { ListItemIcon, ListSubheader, Menu, MenuItem } from '@mui/material';
import type { MenuGroup } from './MenuBar.tsx';
import { MuiAppearance } from './MuiAppearance.tsx';

export function AppMenu({
  anchor,
  close,
  groups,
  mode,
}: {
  anchor: HTMLElement;
  close: () => void;
  groups: MenuGroup[];
  mode: 'light' | 'dark';
}) {
  return (
    <MuiAppearance mode={mode}>
      <Menu anchorEl={anchor} open onClose={close}>
        {groups.flatMap((group) => [
          ...(groups.length > 1
            ? [
                <ListSubheader key={group.label} disableSticky>
                  {group.label}
                </ListSubheader>,
              ]
            : []),
          ...group.commands.map(({ label, icon: Icon, run, disabled, shortcut }) => (
            <MenuItem
              key={label}
              disabled={disabled ?? false}
              onClick={() => {
                close();
                run();
              }}
            >
              <ListItemIcon>
                <Icon size={16} aria-hidden="true" />
              </ListItemIcon>
              <span>{label}</span>
              {shortcut && <kbd className="menu-shortcut">{shortcut}</kbd>}
            </MenuItem>
          )),
        ])}
      </Menu>
    </MuiAppearance>
  );
}
