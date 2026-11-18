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
import { applyHarmony } from '../../core/harmonize.ts';
import type { Project, Track } from '../../core/types.ts';

export function HarmonyVoice({
  track,
  project,
  close,
  change,
}: {
  track: Track;
  project: Project;
  close: () => void;
  change: (update: (project: Project) => void) => void;
}) {
  const [interval, setInterval] = useState<3 | 6>(3);
  const [below, setBelow] = useState(false);
  const existing = project.tracks.find((voice) => voice.harmonySource === track.id);
  return (
    <Dialog open onClose={close} fullWidth maxWidth="xs">
      <DialogTitle>ハモリ · {track.name}</DialogTitle>
      <DialogContent>
        <Stack spacing={2}>
          <TextField
            select
            label="音程"
            value={String(interval)}
            onChange={(event) => setInterval(event.target.value === '6' ? 6 : 3)}
          >
            <MenuItem value="3">3度</MenuItem>
            <MenuItem value="6">6度</MenuItem>
          </TextField>
          <TextField
            select
            label="方向"
            value={below ? 'below' : 'above'}
            onChange={(event) => setBelow(event.target.value === 'below')}
          >
            <MenuItem value="above">上</MenuItem>
            <MenuItem value="below">下</MenuItem>
          </TextField>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={close}>キャンセル</Button>
        <Button
          variant="contained"
          onClick={() => {
            change((next) => applyHarmony(next, track.id, interval, below));
            close();
          }}
        >
          {existing ? '曲全体のハモリを更新' : '曲全体のハモリを作成'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
