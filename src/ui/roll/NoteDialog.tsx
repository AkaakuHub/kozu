import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  MenuItem,
  Stack,
  Switch,
  TextField,
} from '@mui/material';
import type { Degree, Key, Note } from '../../core/types.ts';
import { PPQ } from '../../core/types.ts';
import { degreePitch, resolvePitch } from '../../core/theory.ts';
import { MuiAppearance } from '../workbench/MuiAppearance.tsx';
import { Fields, NumberField } from '../shared.tsx';

export function NoteDialog({
  note,
  mode,
  length,
  keyFor,
  update,
  remove,
  close,
}: {
  note: Note;
  mode: 'light' | 'dark';
  length: number;
  keyFor: (tick: number) => Key;
  update: (patch: Partial<Note>) => void;
  remove: () => void;
  close: () => void;
}) {
  return (
    <MuiAppearance mode={mode}>
      <Dialog open onClose={() => close()} fullWidth maxWidth="sm">
        <DialogTitle>音符を編集</DialogTitle>
        <DialogContent>
          <Stack gap={2.5} pt={1}>
            <Fields>
              <NumberField
                label="開始拍"
                value={note.at / PPQ + 1}
                min={1}
                max={(length - note.duration) / PPQ + 1}
                step={0.25}
                onChange={(v) => update({ at: Math.round((v - 1) * PPQ) })}
              />
              <NumberField
                label="長さ（四分音符数）"
                value={note.duration / PPQ}
                min={0.0625}
                max={(length - note.at) / PPQ}
                step={0.25}
                onChange={(v) => update({ duration: Math.round(v * PPQ) })}
              />
            </Fields>
            <TextField
              select
              label="音高の指定"
              value={note.pitch.kind}
              onChange={(e) => {
                const k = keyFor(note.at);
                update({
                  pitch:
                    e.target.value === 'degree'
                      ? degreePitch(resolvePitch(note.pitch, k), k)
                      : { kind: 'absolute', midi: resolvePitch(note.pitch, k) },
                });
              }}
            >
              <MenuItem value="degree">キーに追従する度数</MenuItem>
              <MenuItem value="absolute">固定するMIDI音高</MenuItem>
            </TextField>
            {note.pitch.kind === 'degree' ? (
              <Fields>
                <TextField
                  select
                  label="度数"
                  value={note.pitch.degree}
                  onChange={(e) => {
                    if (note.pitch.kind === 'degree')
                      update({
                        pitch: { ...note.pitch, degree: Number(e.target.value) as Degree },
                      });
                  }}
                  sx={{ width: 95 }}
                >
                  {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                    <MenuItem key={d} value={d}>
                      {d}
                    </MenuItem>
                  ))}
                </TextField>
                <NumberField
                  label="変化（半音）"
                  value={note.pitch.accidental}
                  min={-12}
                  max={12}
                  onChange={(accidental) => {
                    if (note.pitch.kind === 'degree')
                      update({ pitch: { ...note.pitch, accidental } });
                  }}
                />
                <NumberField
                  label="オクターブ"
                  value={note.pitch.octave}
                  min={-1}
                  max={8}
                  onChange={(o) => {
                    if (note.pitch.kind === 'degree')
                      update({ pitch: { ...note.pitch, octave: o } });
                  }}
                />
              </Fields>
            ) : (
              <NumberField
                label="MIDI音高"
                value={note.pitch.midi}
                min={0}
                max={127}
                onChange={(midi) => update({ pitch: { kind: 'absolute', midi } })}
              />
            )}
            <NumberField
              label="ベロシティ"
              value={note.velocity}
              min={1}
              max={127}
              onChange={(velocity) => update({ velocity })}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={note.locked}
                  onChange={(e) => update({ locked: e.target.checked })}
                />
              }
              label="再生成で変更しない"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button color="error" onClick={remove}>
            削除
          </Button>
          <Button onClick={() => close()}>閉じる</Button>
        </DialogActions>
      </Dialog>
    </MuiAppearance>
  );
}
