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
import { melodyRhythms } from '../../core/presets.ts';
import type { MelodyOptions } from '../../core/presets.ts';

export function MelodyWindow({
  track,
  section,
  close,
  apply,
}: {
  track: string;
  section: string;
  close: () => void;
  apply: (options: MelodyOptions) => void;
}) {
  const [rhythm, setRhythm] = useState<MelodyOptions['rhythm']>('varied');
  const [octave, setOctave] = useState(4);
  return (
    <Dialog open onClose={close} maxWidth="xs" fullWidth>
      <DialogTitle>
        旋律を生成 · {section} / {track}
      </DialogTitle>
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
              const option = melodyRhythms.find(([value]) => value === event.target.value);
              if (option) setRhythm(option[0]);
            }}
          >
            {melodyRhythms.map(([value, label]) => (
              <MenuItem key={value} value={value}>
                {label}
              </MenuItem>
            ))}
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
