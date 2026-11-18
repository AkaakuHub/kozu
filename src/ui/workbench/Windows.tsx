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
import { lazy, Suspense, useState } from 'react';
import type { CompiledSong, Project, Section, Track } from '../../core/types.ts';
import { PPQ } from '../../core/types.ts';
import type { Appearance } from '../../core/preferences.ts';
import { MuiAppearance } from './MuiAppearance.tsx';
import { generateMelody } from '../../core/presets.ts';
import { timeline, valueAt } from '../../core/time.ts';
import { HarmonyVoice } from './HarmonyVoice.tsx';
import type { WorkingBranch } from '../../core/history/revisions.ts';
import { MotifWindow } from './MotifWindow.tsx';
import { MelodyWindow } from './MelodyWindow.tsx';
import { NumberField } from '../shared.tsx';

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
const TechniqueDialog = lazy(() =>
  import('../TechniqueDialog.tsx').then((module) => ({ default: module.TechniqueDialog })),
);
const TimelineDialog = lazy(() =>
  import('../TimelineDialog.tsx').then((module) => ({ default: module.TimelineDialog })),
);

const titles = {
  composition: '曲の構成',
  harmony: 'コード進行',
  progressions: 'コード進行ライブラリ',
  tracks: '楽器の設定',
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
  open,
  close,
  project,
  section,
  song,
  sectionStart,
  change,
  changeSection,
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
  open: (name: WindowName) => void;
  close: () => void;
  project: Project;
  section: Section;
  song: CompiledSong;
  sectionStart: number;
  change: (update: (p: Project) => void) => void;
  changeSection: (update: (s: Section, p: Project) => void) => void;
  commit: (project: Project) => void;
  setSelected: (id: string) => void;
  add: (name: string, ticks: number) => void;
}) {
  const [name, setName] = useState('');
  const [beats, setBeats] = useState(16);
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
          <HarmonyVoice
            track={track}
            section={section}
            start={sectionStart}
            change={changeSection}
            close={close}
          />
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
              {view === 'tracks' && <Tracks project={project} current={track.id} change={change} />}
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
                </Stack>
              )}
              {view === 'section' && (
                <Stack
                  gap={2}
                  component="form"
                  id="new-part"
                  onSubmit={(event) => {
                    event.preventDefault();
                    add(name.trim() || 'パート', Math.round(beats * PPQ));
                  }}
                >
                  <TextField
                    autoFocus
                    label="パート名"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                  />
                  <NumberField
                    label="四分音符数"
                    value={beats}
                    min={1}
                    max={1024}
                    onChange={setBeats}
                  />
                </Stack>
              )}
            </DialogContent>
            <DialogActions>
              <Button onClick={close}>閉じる</Button>
              {view === 'section' && (
                <Button variant="contained" type="submit" form="new-part">
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
