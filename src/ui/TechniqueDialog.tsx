import { useState } from 'react';
import {
  Alert,
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
import type { Project, Section } from '../core/types.ts';
import { PPQ, uid } from '../core/types.ts';
import { addDrop, addEffect, insertJump, insertRestatement, modulate } from '../core/editing.ts';
import { Fields, NumberField } from './shared.tsx';
const TECHNIQUES = [
  ['jump', '跳びポ'],
  ['restate', '言い直し'],
  ['restateMod', '言い直し＋転調'],
  ['mod', '転調'],
  ['temporaryMod', '一時転調'],
  ['break', 'ブレイク'],
  ['drop', '落ちサビ'],
  ['half', 'ハーフタイム'],
  ['double', 'ダブルタイム'],
  ['four', '四つ打ちへ切り替え'],
  ['fill', 'ドラムフィル'],
  ['octave', 'オクターブ追加'],
] as const;
export function TechniqueDialog({
  section,
  project,
  onApply,
  onClose,
}: {
  section: Section;
  project: Project;
  onApply: (p: Project) => void;
  onClose: () => void;
}) {
  const [kind, setKind] = useState<string>('jump'),
    [beat, setBeat] = useState(1),
    [length, setLength] = useState(1),
    [shift, setShift] = useState(2),
    [keepLead, setKeepLead] = useState(true),
    [error, setError] = useState('');
  const apply = () => {
    try {
      const at = { sectionId: section.id, tick: Math.round((beat - 1) * PPQ) },
        duration = Math.round(length * PPQ);
      let next: Project;
      switch (kind) {
        case 'jump':
          next = insertJump(project, at, duration, keepLead);
          break;
        case 'restate':
        case 'restateMod':
          next = insertRestatement(
            project,
            section.id,
            at.tick,
            duration,
            section.id,
            kind === 'restateMod' ? shift : null,
          );
          break;
        case 'mod':
          next = modulate(project, at, shift);
          break;
        case 'temporaryMod':
          next = modulate(project, at, shift, duration);
          break;
        case 'drop':
          next = addDrop(project, section.id);
          break;
        case 'break':
          next = addEffect(project, {
            id: uid('break'),
            kind: 'break',
            at,
            duration,
            tracks: project.tracks.filter((t) => !keepLead || t.kind !== 'melody').map((t) => t.id),
          });
          break;
        case 'half':
        case 'double':
        case 'four':
          next = addEffect(project, {
            id: uid('groove'),
            kind: 'groove',
            at,
            duration,
            pattern:
              kind === 'half' ? 'halftime' : kind === 'double' ? 'doubletime' : 'fourOnFloor',
          });
          break;
        case 'fill':
          if (!project.tracks.some((t) => t.kind === 'drums'))
            throw new Error('ドラムトラックが必要です。');
          next = addEffect(project, {
            id: uid('fill'),
            kind: 'fill',
            at,
            duration,
            subdivision: 4,
          });
          break;
        case 'octave': {
          const track = project.tracks.find((t) => t.kind === 'melody');
          if (!track) throw new Error('メロディトラックが必要です。');
          next = addEffect(project, {
            id: uid('octave'),
            kind: 'octave',
            at,
            duration,
            trackId: track.id,
            semitones: shift < 0 ? -12 : 12,
          });
          break;
        }
        default:
          throw new Error('技法を選択してください。');
      }
      const sectionEnd = section.length;
      if (
        kind !== 'drop' &&
        (at.tick < 0 ||
          at.tick >= sectionEnd ||
          (kind !== 'mod' && at.tick + duration > sectionEnd))
      )
        throw new Error('適用範囲をパートの中に収めてください。');
      onApply(next);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>技法を挿入</DialogTitle>
      <DialogContent>
        <Stack gap={2} pt={1}>
          <TextField
            select
            fullWidth
            label="技法"
            value={kind}
            onChange={(e) => {
              setKind(e.target.value);
              setError('');
              if (['drop', 'half', 'double', 'four'].includes(e.target.value)) {
                setBeat(1);
                setLength(section.length / PPQ);
              }
            }}
          >
            {TECHNIQUES.map(([id, name]) => (
              <MenuItem key={id} value={id}>
                {name}
              </MenuItem>
            ))}
          </TextField>
          {kind !== 'drop' && (
            <Fields>
              <NumberField
                label={kind.startsWith('restate') ? '反復元の開始拍' : '開始拍'}
                value={beat}
                min={1}
                max={section.length / PPQ}
                step={0.25}
                onChange={setBeat}
              />
              {kind !== 'mod' && (
                <NumberField
                  label="長さ（四分音符数）"
                  value={length}
                  min={0.25}
                  max={section.length / PPQ}
                  step={0.25}
                  onChange={setLength}
                />
              )}
            </Fields>
          )}
          {['mod', 'temporaryMod', 'restateMod', 'octave'].includes(kind) && (
            <NumberField
              label="変化量（半音）"
              value={shift}
              min={-12}
              max={12}
              onChange={setShift}
            />
          )}
          {['jump', 'break'].includes(kind) && (
            <FormControlLabel
              control={
                <Switch checked={keepLead} onChange={(e) => setKeepLead(e.target.checked)} />
              }
              label="メロディは止めずに残す"
            />
          )}
          {['jump', 'break'].includes(kind) && (
            <Alert severity="info">
              MIDIではノートオフを出力します。Logic側の残響やワンショット音源まで完全な無音にする設定は含みません。
            </Alert>
          )}
          {['mod', 'temporaryMod'].includes(kind) && (
            <Alert severity="info">
              度数指定の音は新しいキーに追従します。固定音高・ドラムは移調しません。
            </Alert>
          )}
          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>キャンセル</Button>
        <Button variant="contained" onClick={apply}>
          挿入
        </Button>
      </DialogActions>
    </Dialog>
  );
}
