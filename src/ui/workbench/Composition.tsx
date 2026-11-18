import {
  Box,
  Button,
  Chip,
  FormControlLabel,
  List,
  ListItemButton,
  ListItemText,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import { PPQ } from '../../core/types.ts';
import type { CompiledSong, Effect, Project, Section } from '../../core/types.ts';
import { duplicateSection, removeSection } from '../../core/editing.ts';
import { keyAt, ticksToSeconds, valueAt } from '../../core/time.ts';
import { keyName } from '../../core/theory.ts';
import { minimumSectionLength, sectionLimit } from '../../core/section-length.ts';
import { Caption, Fields, KeyFields, NumberField, Panel } from '../shared.tsx';
import { secondsLabel } from './time-label.ts';
const EFFECT_NAMES: Record<Effect['kind'], string> = {
  break: 'ブレイク',
  accent: 'アクセント',
  thin: '伴奏を減らす',
  groove: 'リズム切り替え',
  fill: 'ドラムフィル',
  octave: 'オクターブ追加',
};

export function Composition({
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
}: {
  project: Project;
  section: Section;
  song: CompiledSong;
  sectionStart: number;
  sectionMeasure: number;
  commit: (project: Project) => void;
  change: (fn: (project: Project) => void) => void;
  changeSection: (fn: (section: Section, project: Project) => void) => void;
  setSelected: (id: string) => void;
  open: (view: 'technique' | 'timeline' | 'section') => void;
}) {
  const listEvents = [
    ...project.tempoChanges.map((e) => ({
      id: e.id,
      at: e.at,
      label: `BPM ${e.bpm}${e.ramp ? ` → ${e.ramp.toBpm}` : ''}`,
      type: 'tempo',
    })),
    ...project.keyChanges.map((e) => ({
      id: e.id,
      at: e.at,
      label: `キー ${keyName(e.key)}`,
      type: 'key',
    })),
    ...project.meterChanges.map((e) => ({
      id: e.id,
      at: e.at,
      label: `拍子 ${e.numerator}/${e.denominator}`,
      type: 'meter',
    })),
    ...project.effects.map((e) => ({
      id: e.id,
      at: e.at,
      label: EFFECT_NAMES[e.kind] + (e.kind === 'groove' ? ` (${e.pattern})` : ''),
      type: 'effect',
    })),
  ]
    .filter((e) => e.at.sectionId === section.id)
    .sort((a, b) => a.at.tick - b.at.tick);
  const move = (delta: number) =>
    change((p) => {
      const i = p.sections.findIndex((s) => s.id === section.id),
        j = i + delta;
      if (j < 0 || j >= p.sections.length) return;
      const [moved] = p.sections.splice(i, 1);
      p.sections.splice(j, 0, moved!);
    });
  const minimum = minimumSectionLength(project, section);
  return (
    <Stack gap={2}>
      <List
        component="div"
        disablePadding
        aria-label="セクション一覧"
        sx={{ maxHeight: 220, overflow: 'auto' }}
      >
        {project.sections.map((item) => (
          <ListItemButton
            key={item.id}
            selected={section.id === item.id}
            onClick={() => setSelected(item.id)}
          >
            <ListItemText primary={item.name || '名称未設定'} />
          </ListItemButton>
        ))}
      </List>
      <Panel title="曲の設定">
        <Stack gap={2}>
          <TextField
            label="タイトル"
            value={project.title}
            onChange={(e) => change((p) => (p.title = e.target.value))}
            fullWidth
          />
          <Fields>
            <NumberField
              label="開始BPM"
              value={project.initialTempo}
              min={20}
              max={400}
              step={0.1}
              onChange={(v) => change((p) => (p.initialTempo = v))}
            />
            <Chip
              label={`${secondsLabel(ticksToSeconds(song.totalTicks, song.tempos))} / ${project.sections.length}パート`}
            />
          </Fields>
          <KeyFields
            value={project.initialKey}
            onChange={(v) => change((p) => (p.initialKey = v))}
          />
        </Stack>
      </Panel>
      <Panel
        title={section.name}
        action={<Chip size="small" label={`${section.length / PPQ}四分音符`} />}
      >
        <Stack gap={2}>
          <TextField
            label="パート名"
            value={section.name}
            onChange={(e) =>
              changeSection((s) => {
                s.name = e.target.value;
                s.role = e.target.value;
              })
            }
            fullWidth
          />
          <Fields>
            <FormControlLabel
              label="音符に合わせて自動で伸ばす"
              control={
                <Switch
                  checked={section.autoExtend === true}
                  onChange={(_, enabled) =>
                    changeSection((current) => {
                      if (enabled) current.autoExtend = true;
                      else delete current.autoExtend;
                    })
                  }
                />
              }
            />
            {!section.autoExtend && (
              <NumberField
                label="長さ（小節）"
                value={section.length / sectionMeasure}
                min={
                  Math.min(section.length, Math.ceil(minimum / sectionMeasure) * sectionMeasure) /
                  sectionMeasure
                }
                max={sectionLimit / sectionMeasure}
                onChange={(value) => {
                  const length = Math.round(value * sectionMeasure);
                  if (length >= minimum && length <= sectionLimit)
                    changeSection((current) => {
                      current.length = length;
                    });
                }}
              />
            )}
          </Fields>
          <Fields>
            <Chip label={keyName(keyAt(project, { sectionId: section.id, tick: 0 }))} />
            <Chip
              label={`BPM ${Number((song.tempos.length ? valueAt(song.tempos, sectionStart).bpm : project.initialTempo).toFixed(1))}`}
            />
          </Fields>
          <Fields>
            <Button variant="contained" onClick={() => open('technique')}>
              技法を挿入
            </Button>
            <Button variant="outlined" onClick={() => open('timeline')}>
              BPM・キー・拍子
            </Button>
          </Fields>
          <Fields>
            <Button onClick={() => move(-1)} disabled={project.sections[0]!.id === section.id}>
              前へ
            </Button>
            <Button onClick={() => move(1)} disabled={project.sections.at(-1)!.id === section.id}>
              後ろへ
            </Button>
            <Button
              onClick={() => {
                const p = duplicateSection(project, section.id);
                commit(p);
                setSelected(p.sections[p.sections.findIndex((s) => s.id === section.id) + 1]!.id);
              }}
            >
              複製
            </Button>
            <Button
              color="error"
              disabled={project.sections.length === 1}
              onClick={() => {
                if (window.confirm('このパートとパート内の変更イベントを削除しますか？'))
                  commit(removeSection(project, section.id));
              }}
            >
              削除
            </Button>
          </Fields>
          <Button
            variant="outlined"
            disabled={project.sections.length >= 128}
            onClick={() => open('section')}
          >
            この後にパートを追加
          </Button>
        </Stack>
      </Panel>
      <Panel title="このパートのタイムライン">
        <Stack gap={1}>
          {!listEvents.length && <Caption>途中の変更はまだありません。</Caption>}
          {listEvents.map((e) => (
            <Stack
              key={e.id}
              direction="row"
              alignItems="center"
              justifyContent="space-between"
              gap={1}
            >
              <Box>
                <Typography variant="body2">{e.label}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {e.at.tick / PPQ + 1}拍目から
                </Typography>
              </Box>
              <Button
                size="small"
                onClick={() =>
                  change((p) => {
                    if (e.type === 'tempo')
                      p.tempoChanges = p.tempoChanges.filter((x) => x.id !== e.id);
                    else if (e.type === 'key')
                      p.keyChanges = p.keyChanges.filter((x) => x.id !== e.id);
                    else if (e.type === 'meter')
                      p.meterChanges = p.meterChanges.filter((x) => x.id !== e.id);
                    else p.effects = p.effects.filter((x) => x.id !== e.id);
                  })
                }
              >
                削除
              </Button>
            </Stack>
          ))}
        </Stack>
      </Panel>
    </Stack>
  );
}
