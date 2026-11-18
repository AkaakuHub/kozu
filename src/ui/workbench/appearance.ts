import { useEffect, useState } from 'react';

import type { Appearance } from '../../core/preferences.ts';
export const colors = {
  light: {
    canvas: '#eef2f7',
    surface: '#f7f9fc',
    raised: '#e2eaf2',
    line: '#b1bdcd',
    ink: '#17283f',
    muted: '#485c75',
    accent: '#107568',
    onAccent: '#ffffff',
    roll: '#f0f4fa',
    grid: '#ccd7e6',
  },
  dark: {
    canvas: '#111723',
    surface: '#181e29',
    raised: '#263347',
    line: '#344156',
    ink: '#e4eaf4',
    muted: '#a8b5c8',
    accent: '#75dfc4',
    onAccent: '#0e2624',
    roll: '#242e3e',
    grid: '#38465d',
  },
};
const query = '(prefers-color-scheme: dark)';

export function useAppearance(choice: Appearance) {
  const [dark, setDark] = useState(() => matchMedia(query).matches);
  useEffect(() => {
    const media = matchMedia(query);
    const update = () => setDark(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  const mode = choice === 'system' ? (dark ? 'dark' : 'light') : choice;
  useEffect(() => {
    const root = document.documentElement;
    root.style.colorScheme = mode;
    for (const [key, value] of Object.entries(colors[mode]))
      root.style.setProperty(`--${key}`, value);
  }, [mode]);
  return mode;
}
