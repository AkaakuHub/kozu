import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
} from '@mui/material';
import { useState } from 'react';
import type { MelodyOptions } from '../../core/presets.ts';

export function MelodyWindow({
  track,
  close,
  apply,
}: {
  track: string;
  close: () => void;
  apply: (options: MelodyOptions) => void;
}) {
  const [rhythm, setRhythm] = useState<MelodyOptions['rhythm']>('varied');
  const [octave, setOctave] = useState(4);
  return (
    <Dialog open onClose={close} maxWidth="xs" fullWidth>
      <DialogTitle>旋律を生成 · {track}</DialogTitle>
      <DialogContent>
        <Stack
          gap={2}
          component="form"
          id="generate-melody"
          onSubmit={(event) => {
            event.preventDefault();
            apply({ rhythm, octave });
          }}
        >
          <TextField
            select
            label="リズム"
            value={rhythm}
            onChange={(event) => {
              const value = event.target.value;
              if (value === 'varied' || value === 'quarters' || value === 'syncopated')
                setRhythm(value);
            }}
          >
            <MenuItem value="varied">変化をつける</MenuItem>
            <MenuItem value="quarters">四分音符</MenuItem>
            <MenuItem value="syncopated">シンコペーション</MenuItem>
          </TextField>
          <TextField
            select
            label="中心のオクターブ"
            value={octave}
            onChange={(event) => setOctave(Number(event.target.value))}
          >
            {[2, 3, 4, 5, 6].map((value) => (
              <MenuItem key={value} value={value}>
                {value}
              </MenuItem>
            ))}
          </TextField>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={close}>キャンセル</Button>
        <Button type="submit" form="generate-melody" variant="contained">
          生成
        </Button>
      </DialogActions>
    </Dialog>
  );
}
