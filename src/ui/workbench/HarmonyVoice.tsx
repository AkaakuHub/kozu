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
import { harmonize } from '../../core/harmonize.ts';
import { createTrack } from '../../core/presets.ts';
import { timeline, valueAt } from '../../core/time.ts';
import type { Project, Section, Track } from '../../core/types.ts';

export function HarmonyVoice({
  track,
  section,
  start,
  close,
  change,
}: {
  track: Track;
  section: Section;
  start: number;
  close: () => void;
  change: (update: (section: Section, project: Project) => void) => void;
}) {
  const [interval, setInterval] = useState<3 | 6>(3);
  const [below, setBelow] = useState(false);
  const notes = section.notes[track.id] ?? [];
  return (
    <Dialog open onClose={close} fullWidth maxWidth="xs">
      <DialogTitle>ハモリ · {track.name}</DialogTitle>
      <DialogContent>
        <Stack spacing={2}>
          <TextField
            select
            label="音程"
            value={interval}
            onChange={(event) => setInterval(event.target.value === '6' ? 6 : 3)}
          >
            <MenuItem value={3}>3度</MenuItem>
            <MenuItem value={6}>6度</MenuItem>
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
          disabled={!notes.length}
          variant="contained"
          onClick={() => {
            change((section, project) => {
              const harmony = createTrack('melody', `${track.name} ${interval}度`);
              const keys = timeline(project).keys;
              const clip = harmonize(
                notes,
                interval,
                below,
                (tick) => valueAt(keys, start + tick).key,
              );
              if (!clip.length) return;
              project.tracks.push(harmony);
              section.notes[harmony.id] = clip;
            });
            close();
          }}
        >
          トラックを追加
        </Button>
      </DialogActions>
    </Dialog>
  );
}
