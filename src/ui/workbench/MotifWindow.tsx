import { useState } from 'react';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
} from '@mui/material';
import { transformMotif } from '../../core/motif.ts';
import type { MotifTransform } from '../../core/motif.ts';
import { timeline, valueAt } from '../../core/time.ts';
import { PPQ } from '../../core/types.ts';
import type { Project, Section, Track } from '../../core/types.ts';
import { Fields, NumberField } from '../shared.tsx';

export function MotifWindow({
  project,
  section,
  start,
  track,
  close,
  change,
}: {
  project: Project;
  section: Section;
  start: number;
  track: Track;
  close: () => void;
  change: (update: (section: Section) => void) => void;
}) {
  const [kind, setKind] = useState<MotifTransform>('invert');
  const [first, setFirst] = useState(1);
  const [last, setLast] = useState(section.length / PPQ + 1);
  const [error, setError] = useState('');
  const apply = () => {
    const keys = timeline(project).keys;
    try {
      const notes = section.notes[track.id] ?? [];
      const result = transformMotif(
        notes,
        Math.round((first - 1) * PPQ),
        Math.round((last - 1) * PPQ),
        section.length,
        kind,
        (tick) => valueAt(keys, start + tick).key,
      );
      if (result === notes) {
        setError('指定範囲に音符がありません。');
        return;
      }
      change((section) => {
        section.notes[track.id] = result;
      });
      close();
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
    }
  };
  return (
    <Dialog open onClose={close} maxWidth="xs" fullWidth>
      <DialogTitle>
        フレーズを変形 · {section.name} / {track.name}
      </DialogTitle>
      <DialogContent>
        <Stack gap={2}>
          <TextField
            select
            label="変形"
            value={kind}
            onChange={(event) => {
              const value = event.target.value;
              if (value === 'invert' || value === 'double' || value === 'half') setKind(value);
            }}
          >
            <MenuItem value="invert" disabled={track.kind === 'drums'}>
              反行
            </MenuItem>
            <MenuItem value="double">拡大（2倍）</MenuItem>
            <MenuItem value="half">縮小（1/2）</MenuItem>
          </TextField>
          <Fields>
            <NumberField
              label="開始拍"
              value={first}
              min={1}
              max={section.length / PPQ + 1}
              step={0.25}
              onChange={setFirst}
            />
            <NumberField
              label="終了拍"
              value={last}
              min={1}
              max={section.length / PPQ + 1}
              step={0.25}
              onChange={setLast}
            />
          </Fields>
          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={close}>キャンセル</Button>
        <Button
          variant="contained"
          onClick={apply}
          disabled={first >= last || (track.kind === 'drums' && kind === 'invert')}
        >
          適用
        </Button>
      </DialogActions>
    </Dialog>
  );
}
