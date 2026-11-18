import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Box, Card, CardContent, MenuItem, Stack, TextField, Typography } from '@mui/material';
import type { Key, Mode } from '../core/types.ts';
import { MODE_NAMES, pitchName } from '../core/theory.ts';
export function Panel({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card variant="outlined" sx={{ borderRadius: 3 }}>
      <CardContent sx={{ p: { xs: 2, sm: 2.5 }, '&:last-child': { pb: { xs: 2, sm: 2.5 } } }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2} gap={1}>
          <Typography component="h2" variant="h6" sx={{ fontSize: 17, fontWeight: 700 }}>
            {title}
          </Typography>
          {action}
        </Stack>
        {children}
      </CardContent>
    </Card>
  );
}
export function NumberField({
  label,
  value,
  onChange,
  min = 0,
  max = 999999,
  step = 1,
  width = 140,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  width?: number | string;
}) {
  const [text, setText] = useState(String(value));
  const [error, setError] = useState(false);
  useEffect(() => {
    setText(String(Number(value.toFixed(5))));
    setError(false);
  }, [value]);
  const commit = () => {
    const n = Number(text);
    if (text.trim() === '' || !Number.isFinite(n) || n < min || n > max) {
      setError(true);
      return;
    }
    setError(false);
    if (n !== value) onChange(n);
  };
  return (
    <TextField
      label={label}
      value={text}
      error={error}
      helperText={error ? `${min}〜${max}` : undefined}
      type="number"
      size="small"
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.querySelector('input')?.blur();
      }}
      slotProps={{ htmlInput: { min, max, step, inputMode: step < 1 ? 'decimal' : 'numeric' } }}
      sx={{ width, minWidth: 90, flexGrow: 1 }}
    />
  );
}
export function KeyFields({ value, onChange }: { value: Key; onChange: (value: Key) => void }) {
  return (
    <Stack direction="row" gap={1} flexWrap="wrap">
      <TextField
        select
        label="主音"
        size="small"
        value={value.tonic}
        onChange={(e) => onChange({ ...value, tonic: Number(e.target.value) })}
        sx={{ minWidth: 100, flex: 1 }}
      >
        {Array.from({ length: 12 }, (_, i) => (
          <MenuItem key={i} value={i}>
            {pitchName(i, value.preferFlats)}
          </MenuItem>
        ))}
      </TextField>
      <TextField
        select
        label="スケール"
        size="small"
        value={value.mode}
        onChange={(e) => onChange({ ...value, mode: e.target.value as Mode })}
        sx={{ minWidth: 160, flex: 2 }}
      >
        {Object.entries(MODE_NAMES).map(([mode, name]) => (
          <MenuItem key={mode} value={mode}>
            {name}
          </MenuItem>
        ))}
      </TextField>
    </Stack>
  );
}
export function Caption({ children }: { children: ReactNode }) {
  return (
    <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>
      {children}
    </Typography>
  );
}
export function Fields({ children }: { children: ReactNode }) {
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'center' }}>{children}</Box>
  );
}
