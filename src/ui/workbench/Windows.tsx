import {
  Button,
  Chip,
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
import { lazy, Suspense, useState } from 'react';
import type { CompiledSong, Project, Section, Track } from '../../core/types.ts';
import type { Appearance } from '../../core/preferences.ts';
import { MuiAppearance } from './MuiAppearance.tsx';
import { generateMelody } from '../../core/presets.ts';
import { timeline, valueAt } from '../../core/time.ts';
import { HarmonyVoice } from './HarmonyVoice.tsx';
import type { WorkingBranch } from '../../core/history/revisions.ts';
import { MotifWindow } from './MotifWindow.tsx';
import { MelodyWindow } from './MelodyWindow.tsx';
import { NumberField } from '../shared.tsx';
import { sectionLimit } from '../../core/section-length.ts';

const ProgressionLibrary = lazy(() =>
  import('../progressions/ProgressionLibrary.tsx').then((module) => ({
    default: module.ProgressionLibrary,
  })),
);
const Composition = lazy(() =>
  import('./Composition.tsx').then((module) => ({ default: module.Composition })),
);
const Harmony = lazy(() =>
  import('../Harmony.tsx').then((module) => ({ default: module.Harmony })),
);
const Tracks = lazy(() => import('../Tracks.tsx').then((module) => ({ default: module.Tracks })));
const InstrumentPicker = lazy(() =>
  import('./InstrumentPicker.tsx').then((module) => ({ default: module.InstrumentPicker })),
);
const TechniqueDialog = lazy(() =>
  import('../TechniqueDialog.tsx').then((module) => ({ default: module.TechniqueDialog })),
);
const TimelineDialog = lazy(() =>
  import('../TimelineDialog.tsx').then((module) => ({ default: module.TimelineDialog })),
);

const titles = {
  composition: 'セクション管理',
  harmony: 'コード進行',
  progressions: 'コード進行ライブラリ',
  tracks: 'トラック設定',
  instruments: '音源ライブラリ',
  diagnostics: '曲の検証',
  settings: '設定',
  technique: '作曲技法',
  timeline: 'テンポ・キー・拍子',
  melody: '旋律を生成',
  voice: 'ハモリを作成',
  motif: 'フレーズを変形',
  section: 'パートを追加',
};
export type WindowName = keyof typeof titles;

export function Windows({
  view,
  timelineTick,
  track,
  working,
  mode,
  appearance,
  setAppearance,
  scaleGuide,
  setScaleGuide,
  notePreview,
  setNotePreview,
  open,
  close,
  project,
  section,
  song,
  sectionStart,
  sectionMeasure,
  change,
  changeSection,
  requestDelete,
  commit,
  setSelected,
  add,
}: {
  view: WindowName;
  timelineTick: number;
  track: Track;
  working: WorkingBranch | null;
  mode: 'light' | 'dark';
  appearance: Appearance;
  setAppearance: (value: Appearance) => void;
  scaleGuide: boolean;
  setScaleGuide: (value: boolean) => void;
  notePreview: boolean;
  setNotePreview: (value: boolean) => void;
  open: (name: WindowName) => void;
  close: () => void;
  project: Project;
  section: Section;
  song: CompiledSong;
  sectionStart: number;
  sectionMeasure: number;
  change: (update: (p: Project) => void) => void;
  changeSection: (update: (s: Section, p: Project) => void) => void;
  requestDelete: (id: string) => void;
  commit: (project: Project) => void;
  setSelected: (id: string) => void;
  add: (name: string, ticks: number, autoExtend: boolean) => void;
}) {
  const [name, setName] = useState('');
  const [bars, setBars] = useState(4);
  const [autoLength, setAutoLength] = useState(true);
  return (
    <MuiAppearance mode={mode}>
      <Suspense fallback={null}>
        {view === 'technique' ? (
          <TechniqueDialog project={project} section={section} onApply={commit} onClose={close} />
        ) : view === 'timeline' ? (
          <TimelineDialog
            tick={timelineTick}
            project={project}
            section={section}
            onApply={commit}
            onClose={close}
          />
        ) : view === 'melody' ? (
          <MelodyWindow
            track={track.name}
            section={section.name}
            close={close}
            apply={(options) => {
              changeSection((section, next) => {
                next.seed++;
                const keys = timeline(next).keys;
                section.notes[track.id] = generateMelody(
                  section,
                  track.id,
                  next.seed,
                  (tick) => valueAt(keys, sectionStart + tick).key,
                  options,
                );
              });
              close();
            }}
          />
        ) : view === 'voice' ? (
          <HarmonyVoice track={track} project={project} change={change} close={close} />
        ) : view === 'motif' ? (
          <MotifWindow
            project={project}
            track={track}
            section={section}
            start={sectionStart}
            change={changeSection}
            close={close}
          />
        ) : view === 'progressions' ? (
          <ProgressionLibrary
            project={project}
            working={working}
            section={section}
            close={close}
            apply={(chords) =>
              changeSection((current) => {
                current.chords = chords;
              })
            }
          />
        ) : (
          <Dialog open onClose={close} fullWidth maxWidth="md">
            <DialogTitle>{titles[view]}</DialogTitle>
            <DialogContent dividers>
              {view === 'composition' && (
                <Composition
                  {...{
                    project,
                    section,
                    song,
                    sectionStart,
                    sectionMeasure,
                    commit,
                    change,
                    changeSection,
                    setSelected,
                    open,
                  }}
                />
              )}
              {view === 'harmony' && (
                <Harmony project={project} section={section} change={changeSection} />
              )}
              {view === 'tracks' && (
                <Tracks
                  project={project}
                  current={track.id}
                  change={change}
                  requestDelete={requestDelete}
                />
              )}
              {view === 'instruments' && (
                <InstrumentPicker
                  selected={track.program}
                  choose={(program) => {
                    if (program !== track.program)
                      change((next) => {
                        const target = next.tracks.find(({ id }) => id === track.id)!;
                        if (program === undefined) delete target.program;
                        else target.program = program;
                      });
                    close();
                  }}
                />
              )}
              {view === 'diagnostics' &&
                (song.diagnostics.length ? (
                  <ul>
                    {song.diagnostics.map((item, index) => (
                      <li key={index}>{item.message}</li>
                    ))}
                  </ul>
                ) : (
                  'エラーはありません。'
                ))}
              {view === 'settings' && (
                <Stack spacing={1}>
                  <TextField
                    select
                    label="外観"
                    value={appearance}
                    fullWidth
                    onChange={(event) => {
                      const value = event.target.value;
                      if (value === 'light' || value === 'dark' || value === 'system')
                        setAppearance(value);
                    }}
                  >
                    <MenuItem value="system">端末の設定</MenuItem>
                    <MenuItem value="light">ライト</MenuItem>
                    <MenuItem value="dark">ダーク</MenuItem>
                  </TextField>
                  <FormControlLabel
                    label="スケール内の音を強調"
                    control={
                      <Switch
                        checked={scaleGuide}
                        onChange={(_, checked) => setScaleGuide(checked)}
                      />
                    }
                  />
                  <FormControlLabel
                    label="鍵盤と音符の試聴"
                    control={
                      <Switch
                        checked={notePreview}
                        onChange={(_, checked) => setNotePreview(checked)}
                      />
                    }
                  />
                </Stack>
              )}
              {view === 'section' && (
                <Stack
                  gap={2}
                  component="form"
                  id="new-part"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const length = Math.round(bars * sectionMeasure);
                    if (name.trim() && length > 0 && length <= sectionLimit)
                      add(name.trim(), length, autoLength);
                  }}
                >
                  <TextField
                    autoFocus
                    label="パート名"
                    required
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                  />
                  <Stack gap={0.5} direction="row" flexWrap="wrap">
                    {['イントロ', 'Aメロ', 'Bメロ', 'サビ', '間奏', 'アウトロ'].map((preset) => (
                      <Chip key={preset} label={preset} onClick={() => setName(preset)} />
                    ))}
                  </Stack>
                  <FormControlLabel
                    label="音符に合わせて自動で伸ばす"
                    control={
                      <Switch
                        checked={autoLength}
                        onChange={(_, checked) => setAutoLength(checked)}
                      />
                    }
                  />
                  <NumberField
                    label={autoLength ? '初期長（小節）' : '長さ（小節）'}
                    value={bars}
                    min={1}
                    max={Math.floor(sectionLimit / sectionMeasure)}
                    onChange={setBars}
                  />
                </Stack>
              )}
            </DialogContent>
            <DialogActions>
              <Button onClick={close}>閉じる</Button>
              {view === 'section' && (
                <Button variant="contained" type="submit" form="new-part" disabled={!name.trim()}>
                  追加
                </Button>
              )}
            </DialogActions>
          </Dialog>
        )}
      </Suspense>
    </MuiAppearance>
  );
}
