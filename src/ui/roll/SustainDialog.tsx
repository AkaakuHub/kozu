import { useId, useState } from 'react';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
} from '@mui/material';
import { MuiAppearance } from '../workbench/MuiAppearance.tsx';

export function SustainDialog({
  mode,
  point,
  total,
  apply,
  close,
}: {
  mode: 'light' | 'dark';
  point: { id: string | null; tick: number; value: number };
  total: number;
  apply: (edit: { tick: number; value: number } | null) => void;
  close: () => void;
}) {
  const form = useId();
  const [tick, setTick] = useState(String(point.tick));
  const [value, setValue] = useState(String(point.value));
  const [error, setError] = useState('');
  const save = (edit: { tick: number; value: number } | null) => {
    try {
      apply(edit);
      close();
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
    }
  };
  return (
    <MuiAppearance mode={mode}>
      <Dialog open onClose={close} fullWidth maxWidth="xs" aria-labelledby={form + '-title'}>
        <DialogTitle id={form + '-title'}>サステインペダル（CC64）</DialogTitle>
        <DialogContent>
          <Stack
            component="form"
            id={form}
            onSubmit={(event) => {
              event.preventDefault();
              save({ tick: Number(tick), value: Number(value) });
            }}
            direction="row"
            flexWrap="wrap"
            gap={1}
            pt={1}
          >
            <TextField
              label="位置（ティック）"
              type="number"
              required
              value={tick}
              onChange={(event) => setTick(event.target.value)}
              slotProps={{ htmlInput: { min: 0, max: total - 1, step: 1, inputMode: 'numeric' } }}
              sx={{ minWidth: 120, flex: 1 }}
            />
            <TextField
              label="値（0〜127）"
              type="number"
              required
              value={value}
              onChange={(event) => setValue(event.target.value)}
              slotProps={{ htmlInput: { min: 0, max: 127, step: 1, inputMode: 'numeric' } }}
              sx={{ minWidth: 110, flex: 1 }}
            />
          </Stack>
          {error && <Alert severity="error">{error}</Alert>}
        </DialogContent>
        <DialogActions>
          {point.id && (
            <Button color="error" onClick={() => save(null)}>
              削除
            </Button>
          )}
          <Button onClick={close}>キャンセル</Button>
          <Button type="submit" form={form} variant="contained">
            {point.id ? '適用' : '追加'}
          </Button>
        </DialogActions>
      </Dialog>
    </MuiAppearance>
  );
}
