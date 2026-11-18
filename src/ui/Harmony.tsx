import { changeHarmony, harmonyTechniques } from '../core/harmony-techniques.ts';
import { useState } from 'react';
import {
  Box,
  Button,
  Chip,
  Divider,
  FormControlLabel,
  MenuItem,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import type { Chord, ChordQuality, Degree, Project, Section } from '../core/types.ts';
import { PPQ, uid } from '../core/types.ts';
import {
  CHORDS,
  chordName,
  chordPitches,
  degreePitch,
  inScale,
  INTERVALS,
  pitchName,
  resolvePitch,
} from '../core/theory.ts';
import { keyAt } from '../core/time.ts';
import { makeChords, PROGRESSIONS } from '../core/presets.ts';
import { Fields, NumberField, Panel } from './shared.tsx';
interface Props {
  project: Project;
  section: Section;
  change: (update: (s: Section) => void) => void;
}
export function Harmony({ project, section, change }: Props) {
  const [preset, setPreset] = useState('royal'),
    [selected, setSelected] = useState('');
  const chord = section.chords.find((c) => c.id === selected) ?? section.chords[0];
  const k = keyAt(project, { sectionId: section.id, tick: chord?.at ?? 0 });
  const update = (values: Partial<Chord>) => {
    if (chord)
      change((s) => {
        const c = s.chords.find((c) => c.id === chord.id)!;
        Object.assign(c, values);
      });
  };
  return (
    <Stack gap={2}>
      <Panel title="コード進行">
        <Stack gap={2}>
          <TextField
            select
            label="プリセット"
            value={preset}
            onChange={(e) => setPreset(e.target.value)}
            fullWidth
          >
            {PROGRESSIONS.map((p) => (
              <MenuItem value={p.id} key={p.id}>
                {p.name} · {p.category}
              </MenuItem>
            ))}
          </TextField>
          <Button
            variant="outlined"
            onClick={() => {
              change((s) => {
                s.chords = makeChords(
                  PROGRESSIONS.find((p) => p.id === preset)!,
                  s.length,
                );
              });
              setSelected('');
            }}
          >
            このパートに配置
          </Button>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: 'repeat(2,minmax(0,1fr))', sm: 'repeat(4,minmax(0,1fr))' },
              gap: 1,
            }}
          >
            {section.chords.map((c, i) => (
              <Button
                key={c.id}
                variant={c.id === chord?.id ? 'contained' : 'outlined'}
                onClick={() => setSelected(c.id)}
                sx={{ py: 1.4, alignItems: 'flex-start', flexDirection: 'column' }}
              >
                <Typography variant="caption" sx={{ opacity: 0.75 }}>
                  {i + 1} · {(c.at / PPQ + 1).toFixed(c.at % PPQ ? 2 : 0)}拍目
                </Typography>
                <Typography fontWeight={700} fontSize={18}>
                  {chordName(c, keyAt(project, { sectionId: section.id, tick: c.at }))}
                </Typography>
                <Typography variant="caption">{c.duration / PPQ}拍</Typography>
              </Button>
            ))}
          </Box>
        </Stack>
      </Panel>
      {chord && (
        <Panel title={`和音を編集 · ${chordName(chord, k)}`}>
          <Stack gap={2.5}>
            <Fields>
              <TextField
                select
                label="根音の指定"
                value={chord.root.kind}
                onChange={(e) =>
                  update({
                    root:
                      e.target.value === 'degree'
                        ? degreePitch(resolvePitch(chord.root, k), k)
                        : { kind: 'absolute', midi: resolvePitch(chord.root, k) },
                  })
                }
                sx={{ minWidth: 120, flex: 1 }}
              >
                <MenuItem value="degree">キーの度数</MenuItem>
                <MenuItem value="absolute">固定音高</MenuItem>
              </TextField>
              {chord.root.kind === 'degree' ? (
                <>
                  <TextField
                    select
                    label="度数"
                    value={chord.root.degree}
                    onChange={(e) =>
                      update({
                        root: {
                          kind: 'degree',
                          degree: Number(e.target.value) as Degree,
                          accidental: chord.root.kind === 'degree' ? chord.root.accidental : 0,
                          octave: 3,
                        },
                      })
                    }
                    sx={{ minWidth: 80, flex: 1 }}
                  >
                    {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                      <MenuItem value={d} key={d}>
                        {d}
                      </MenuItem>
                    ))}
                  </TextField>
                  <NumberField
                    label="変化（半音）"
                    value={chord.root.accidental}
                    min={-2}
                    max={2}
                    onChange={(accidental) => {
                      if (chord.root.kind === 'degree')
                        update({ root: { ...chord.root, accidental } });
                    }}
                  />
                </>
              ) : (
                <NumberField
                  label="根音（MIDI）"
                  value={chord.root.midi}
                  min={0}
                  max={127}
                  onChange={(midi) => update({ root: { kind: 'absolute', midi } })}
                />
              )}
            </Fields>
            <TextField
              select
              label="和声の技法"
              value=""
              onChange={(event) => {
                const technique = Object.keys(harmonyTechniques).find(
                  (value) => value === event.target.value,
                ) as keyof typeof harmonyTechniques | undefined;
                if (!technique) return;
                const patch = changeHarmony(section.chords, chord.id, technique, (tick) =>
                  keyAt(project, { sectionId: section.id, tick }),
                );
                if (patch) update(patch);
              }}
            >
              {(Object.keys(harmonyTechniques) as (keyof typeof harmonyTechniques)[]).map(
                (technique) => (
                  <MenuItem
                    key={technique}
                    value={technique}
                    disabled={
                      (technique === 'secondary' || technique === 'cliche') &&
                      !changeHarmony(section.chords, chord.id, technique, (tick) =>
                        keyAt(project, { sectionId: section.id, tick }),
                      )
                    }
                  >
                    {harmonyTechniques[technique]}
                  </MenuItem>
                ),
              )}
            </TextField>
            <TextField
              select
              fullWidth
              label="和音の種類"
              value={chord.quality}
              onChange={(e) => update({ quality: e.target.value as ChordQuality, inversion: 0 })}
            >
              {Object.entries(CHORDS).map(([id, q]) => (
                <MenuItem key={id} value={id}>
                  {id === 'custom' ? '音程から作る' : q.suffix || 'メジャー'} ·{' '}
                  {q.intervals.join(' / ')}
                </MenuItem>
              ))}
            </TextField>
            <Fields>
              <NumberField
                label="転回回数"
                value={chord.inversion}
                min={0}
                max={6}
                onChange={(inversion) => update({ inversion })}
              />
              <Button
                variant="outlined"
                onClick={() => update({ quality: 'aug7', inversion: 3, bass: null })}
              >
                イキスギコードの代表形
              </Button>
            </Fields>
            <FormControlLabel
              control={
                <Switch
                  checked={chord.bass !== null}
                  onChange={(e) =>
                    update({
                      bass: e.target.checked
                        ? { kind: 'degree', degree: 1, accidental: 0, octave: 2 }
                        : null,
                    })
                  }
                />
              }
              label="ベース音を別に指定"
            />
            {chord.bass && (
              <TextField
                select
                label="ベース音"
                value={((resolvePitch(chord.bass, k) % 12) + 12) % 12}
                onChange={(e) => update({ bass: degreePitch(Number(e.target.value) + 36, k) })}
              >
                {Array.from({ length: 12 }, (_, pc) => (
                  <MenuItem value={pc} key={pc}>
                    {pitchName(pc, k.preferFlats)}
                  </MenuItem>
                ))}
              </TextField>
            )}
            {chord.quality === 'custom' && (
              <>
                <Fields>
                  {[
                    { name: '根音', semitones: 0 },
                    ...INTERVALS,
                    { name: '長9度', semitones: 14 },
                    { name: '完全11度', semitones: 17 },
                    { name: '長13度', semitones: 21 },
                  ].map((i) => (
                    <Chip
                      key={i.semitones}
                      label={`${i.name} · ${i.semitones}`}
                      color={chord.customIntervals.includes(i.semitones) ? 'primary' : 'default'}
                      onClick={() => {
                        const intervals = chord.customIntervals.includes(i.semitones)
                          ? chord.customIntervals.filter((n) => n !== i.semitones)
                          : [...chord.customIntervals, i.semitones].sort((a, b) => a - b);
                        if (intervals.length) update({ customIntervals: intervals });
                      }}
                    />
                  ))}
                </Fields>
              </>
            )}
            <Divider />
            <Fields>
              {chordPitches(chord, k).map((n, i) => (
                <Chip
                  key={`${n}-${i}`}
                  label={pitchName(n, k.preferFlats, true)}
                  color={inScale(n, k) ? 'default' : 'warning'}
                  variant="outlined"
                />
              ))}
            </Fields>
            <Fields>
              <Button
                variant="outlined"
                disabled={chord.duration < PPQ / 2}
                onClick={() =>
                  change((s) => {
                    const i = s.chords.findIndex((c) => c.id === chord.id),
                      c = s.chords[i]!,
                      first = Math.floor(c.duration / 2);
                    const next = {
                      ...structuredClone(c),
                      id: uid('chord'),
                      at: c.at + first,
                      duration: c.duration - first,
                    };
                    c.duration = first;
                    s.chords.splice(i + 1, 0, next);
                  })
                }
              >
                この和音の範囲を2分割
              </Button>
              <Button
                color="error"
                onClick={() =>
                  change((s) => {
                    s.chords = s.chords.filter((c) => c.id !== chord.id);
                  })
                }
              >
                削除
              </Button>
            </Fields>
          </Stack>
        </Panel>
      )}
    </Stack>
  );
}
