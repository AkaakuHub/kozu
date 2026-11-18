import { createTheme, ThemeProvider } from '@mui/material/styles';
import type { ReactNode } from 'react';
import { colors } from './appearance.ts';

const create = (mode: 'light' | 'dark') => {
  const color = colors[mode];
  return createTheme({
    spacing: 6,
    palette: {
      mode,
      primary: { main: color.accent, contrastText: color.onAccent },
      background: { default: color.canvas, paper: color.surface },
      text: { primary: color.ink, secondary: color.muted },
      divider: color.line,
    },
    typography: {
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: 13,
      button: { textTransform: 'none', fontWeight: 600 },
    },
    shape: { borderRadius: 6 },
    components: {
      MuiButton: {
        defaultProps: { size: 'small', disableElevation: true },
        styleOverrides: { root: { minHeight: 32, '@media (pointer: coarse)': { minHeight: 40 } } },
      },
      MuiButtonBase: { defaultProps: { disableRipple: true } },
      MuiTextField: { defaultProps: { size: 'small', margin: 'none' } },
      MuiInputBase: { styleOverrides: { input: { '@media (pointer: coarse)': { fontSize: 16 } } } },
      MuiDialog: {
        styleOverrides: {
          paper: {
            backgroundImage: 'none',
            border: `1px solid ${color.line}`,
            margin: 12,
            width: 'calc(100% - 24px)',
          },
        },
      },
      MuiDialogTitle: {
        styleOverrides: {
          root: {
            fontWeight: 700,
            fontSize: 16,
            padding: '10px 14px',
            borderBottom: `1px solid ${color.line}`,
          },
        },
      },
      MuiDialogContent: {
        styleOverrides: {
          root: { padding: 14, '.MuiDialogTitle-root + &': { paddingTop: 14, borderTop: 0 } },
        },
      },
      MuiDialogActions: {
        styleOverrides: { root: { padding: '6px 10px', borderTop: `1px solid ${color.line}` } },
      },
      MuiSelect: { defaultProps: { MenuProps: { transitionDuration: 0 } } },
      MuiMenu: {
        defaultProps: { transitionDuration: 0 },
        styleOverrides: {
          paper: { backgroundImage: 'none', border: `1px solid ${color.line}`, minWidth: 180 },
          list: { paddingBlock: 4 },
        },
      },
      MuiMenuItem: {
        styleOverrides: {
          root: { minHeight: 32, gap: 7, '@media (pointer: coarse)': { minHeight: 42 } },
        },
      },
      MuiListItemIcon: { styleOverrides: { root: { minWidth: 25 } } },
      MuiCard: {
        defaultProps: { variant: 'outlined' },
        styleOverrides: { root: { backgroundImage: 'none' } },
      },
    },
  });
};
const themes = { light: create('light'), dark: create('dark') };
export function MuiAppearance({ mode, children }: { mode: 'light' | 'dark'; children: ReactNode }) {
  return <ThemeProvider theme={themes[mode]}>{children}</ThemeProvider>;
}
