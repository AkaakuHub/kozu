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
import { clone, PPQ, uid } from '../core/types.ts';
import type { Project, Section } from '../core/types.ts';
import { keyAt, sectionStarts, timeline, valueAt } from '../core/time.ts';
import { Fields, KeyFields, NumberField } from './shared.tsx';
export function TimelineDialog({
  project,
  section,
  onApply,
  onClose,
  tick,
}: {
  project: Project;
  section: Section;
  onApply: (p: Project) => void;
  onClose: () => void;
  tick: number;
}) {
  const maps = timeline(project),
    start = sectionStarts(project).get(section.id)!;
  const tempo = project.tempoChanges.find(
    (event) => event.at.sectionId === section.id && event.at.tick === tick,
  );
  const [kind, setKind] = useState('tempo'),
    [beat, setBeat] = useState(tick / PPQ + 1),
    [bpm, setBpm] = useState(valueAt(maps.tempos, start + tick).bpm),
    [ramp, setRamp] = useState(Boolean(tempo?.ramp)),
    [toBpm, setToBpm] = useState(tempo?.ramp?.toBpm ?? 160),
    [duration, setDuration] = useState(tempo?.ramp ? tempo.ramp.duration / PPQ : 4),
    [key, setKey] = useState(keyAt(project, { sectionId: section.id, tick })),
    [numerator, setNumerator] = useState(4),
    [denominator, setDenominator] = useState<2 | 4 | 8 | 16>(4),
    [error, setError] = useState('');
  const apply = () => {
    const p = clone(project),
      at = { sectionId: section.id, tick: Math.round((beat - 1) * PPQ) };
    if (at.tick < 0 || at.tick >= section.length) {
      setError('変更する位置をパートの中に指定してください。');
      return;
    }
    if (kind === 'tempo') {
      if (ramp && at.tick + duration * PPQ > section.length) {
        setError('この画面ではテンポ変化をパートの中に収めてください。');
        return;
      }
      p.tempoChanges = p.tempoChanges.filter(
        (e) => !(e.at.sectionId === at.sectionId && e.at.tick === at.tick),
      );
      if (start + at.tick === 0) p.initialTempo = bpm;
      if (start + at.tick > 0 || ramp)
        p.tempoChanges.push({
          id: uid('tempo'),
          at,
          bpm,
          ramp: ramp ? { duration: Math.round(duration * PPQ), toBpm } : null,
        });
    } else if (kind === 'key') {
      p.keyChanges = p.keyChanges.filter(
        (e) => !(e.at.sectionId === at.sectionId && e.at.tick === at.tick),
      );
      p.keyChanges.push({ id: uid('key'), at, key });
    } else {
      p.meterChanges = p.meterChanges.filter(
        (e) => !(e.at.sectionId === at.sectionId && e.at.tick === at.tick),
      );
      p.meterChanges.push({ id: uid('meter'), at, numerator, denominator });
    }
    onApply(p);
    onClose();
  };
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>曲の途中で変更</DialogTitle>
      <DialogContent>
        <Stack gap={2.5} pt={1}>
          <TextField
            select
            label="変更する項目"
            value={kind}
            onChange={(e) => setKind(e.target.value)}
          >
            <MenuItem value="tempo">BPM</MenuItem>
            <MenuItem value="key">キー</MenuItem>
            <MenuItem value="meter">拍子</MenuItem>
          </TextField>
          <NumberField
            label="開始拍（四分音符換算）"
            value={beat}
            min={1}
            max={1 + (section.length - 1) / PPQ}
            step={0.25}
            onChange={setBeat}
          />
          {kind === 'tempo' && (
            <>
              <NumberField
                label="BPM"
                value={bpm}
                min={20}
                max={400}
                step={0.1}
                onChange={setBpm}
              />
              <FormControlLabel
                control={<Switch checked={ramp} onChange={(e) => setRamp(e.target.checked)} />}
                label="一定の長さで徐々に変える"
              />
              {ramp && (
                <Fields>
                  <NumberField
                    label="終了BPM"
                    value={toBpm}
                    min={20}
                    max={400}
                    step={0.1}
                    onChange={setToBpm}
                  />
                  <NumberField
                    label="長さ（四分音符数）"
                    value={duration}
                    min={0.25}
                    max={section.length / PPQ}
                    step={0.25}
                    onChange={setDuration}
                  />
                </Fields>
              )}
            </>
          )}
          {kind === 'key' && (
            <>
              <KeyFields value={key} onChange={setKey} />
            </>
          )}
          {kind === 'meter' && (
            <>
              <Fields>
                <NumberField
                  label="分子"
                  value={numerator}
                  min={1}
                  max={32}
                  onChange={setNumerator}
                />
                <TextField
                  select
                  label="分母"
                  value={denominator}
                  onChange={(e) => setDenominator(Number(e.target.value) as 2 | 4 | 8 | 16)}
                  sx={{ minWidth: 100 }}
                >
                  {[2, 4, 8, 16].map((n) => (
                    <MenuItem value={n} key={n}>
                      {n}
                    </MenuItem>
                  ))}
                </TextField>
              </Fields>
            </>
          )}
          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>キャンセル</Button>
        <Button variant="contained" onClick={apply}>
          適用
        </Button>
      </DialogActions>
    </Dialog>
  );
}
