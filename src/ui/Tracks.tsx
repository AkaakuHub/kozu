import { useState } from 'react';
import { Alert, Button, Divider, MenuItem, Stack, TextField } from '@mui/material';
import type { Pattern, Project, Track, TrackKind } from '../core/types.ts';
import { createTrack } from '../core/presets.ts';
import { Fields, NumberField, Panel } from './shared.tsx';
interface Props {
  project: Project;
  current: string;
  change: (update: (p: Project) => void) => void;
}
const KIND_NAMES: Record<TrackKind, string> = {
  melody: 'メロディ',
  chords: '和音',
  guitar: 'ギター',
  bass: 'ベース',
  drums: 'ドラム',
};
const PATTERNS: Record<Pattern, string> = {
  sustain: '持続音',
  eighths: '8分音符',
  arp: 'アルペジオ',
  cutting: 'カッティング',
  pop: 'ポップ',
  halftime: 'ハーフタイム',
  doubletime: 'ダブルタイム',
  fourOnFloor: '四つ打ち',
  trap: 'トラップ',
  twoStep: '2ステップ',
};
export function Tracks({ project, current, change }: Props) {
  const [selected, select] = useState(current);
  const track = project.tracks.find((track) => track.id === selected) ?? project.tracks[0]!;
  const [kind, setKind] = useState<TrackKind>('melody');
  const update = (id: string, fn: (t: Track) => void) =>
    change((p) => fn(p.tracks.find((t) => t.id === id)!));
  const remove = (id: string) => {
    if (project.tracks.length <= 1 || !window.confirm('このトラックと、その音符を削除しますか？'))
      return;
    change((p) => {
      p.tracks = p.tracks.filter((t) => t.id !== id);
      for (const s of p.sections) delete s.notes[id];
      p.effects = p.effects
        .filter((e) => e.kind !== 'octave' || e.trackId !== id)
        .map((e) => {
          if ('tracks' in e) e.tracks = e.tracks.filter((t) => t !== id);
          if (e.kind === 'thin') e.keepTracks = e.keepTracks.filter((t) => t !== id);
          return e;
        });
    });
  };
  return (
    <Stack gap={2}>
      <Panel title="トラックを追加">
        <Fields>
          <TextField
            select
            label="種類"
            value={kind}
            onChange={(e) => setKind(e.target.value as TrackKind)}
            sx={{ minWidth: 160, flex: 1 }}
          >
            {Object.entries(KIND_NAMES).map(([k, v]) => (
              <MenuItem key={k} value={k}>
                {v}
              </MenuItem>
            ))}
          </TextField>
          <Button
            variant="contained"
            disabled={
              project.tracks.length >= 16 ||
              (kind !== 'drums' && project.tracks.filter((t) => t.kind !== 'drums').length >= 15)
            }
            onClick={() => {
              const track = createTrack(kind);
              change((p) => p.tracks.push(track));
              select(track.id);
            }}
          >
            追加
          </Button>
        </Fields>
      </Panel>
      <Panel
        key={track.id}
        title={track.name}
        action={
          <Button
            color="error"
            disabled={project.tracks.length === 1}
            onClick={() => remove(track.id)}
          >
            削除
          </Button>
        }
      >
        <Stack gap={2}>
          <TextField
            label="名前"
            value={track.name}
            onChange={(e) => update(track.id, (t) => (t.name = e.target.value))}
            fullWidth
          />
          <Fields>
            <TextField
              select
              label="自動伴奏"
              value={track.pattern}
              onChange={(e) => update(track.id, (t) => (t.pattern = e.target.value as Pattern))}
              sx={{ minWidth: 150, flex: 1 }}
            >
              {Object.entries(PATTERNS)
                .filter(([k]) =>
                  track.kind === 'drums'
                    ? ['pop', 'halftime', 'doubletime', 'fourOnFloor', 'trap', 'twoStep'].includes(
                        k,
                      )
                    : ['sustain', 'eighths', 'arp'].includes(k) ||
                      (k === 'cutting' && track.kind === 'guitar'),
                )
                .map(([k, v]) => (
                  <MenuItem key={k} value={k}>
                    {v}
                  </MenuItem>
                ))}
            </TextField>

            <NumberField
              label="伴奏オクターブ"
              min={0}
              max={7}
              value={track.octave}
              onChange={(v) => update(track.id, (t) => (t.octave = Math.round(v)))}
            />
          </Fields>
          {track.kind === 'guitar' && (
            <>
              <Divider />
              <TextField
                select
                fullWidth
                label="Logicへ渡す演奏データ"
                value={track.guitar.output}
                onChange={(e) =>
                  update(
                    track.id,
                    (t) => (t.guitar.output = e.target.value as Track['guitar']['output']),
                  )
                }
              >
                <MenuItem value="voiced">単音音源用：弦ごとのボイシング</MenuItem>
                <MenuItem value="powerNotes">単音音源用：パワーコードを構成音へ展開</MenuItem>
                <MenuItem value="powerTrigger">コード収録音源用：根音1ノートのみ</MenuItem>
              </TextField>
              <TextField
                label="Logicの音源・パッチ名（メモ）"
                value={track.guitar.patchName}
                onChange={(e) => update(track.id, (t) => (t.guitar.patchName = e.target.value))}
                fullWidth
              />
              {track.guitar.output === 'voiced' && (
                <>
                  <Fields>
                    <NumberField
                      label="弦間の発音差（ms）"
                      min={0}
                      max={80}
                      value={track.guitar.strumMs}
                      onChange={(v) => update(track.id, (t) => (t.guitar.strumMs = v))}
                    />
                    <NumberField
                      label="最高フレット"
                      min={0}
                      max={24}
                      value={track.guitar.maxFret}
                      onChange={(v) => update(track.id, (t) => (t.guitar.maxFret = Math.round(v)))}
                    />
                    <NumberField
                      label="フレット間隔の上限"
                      min={1}
                      max={6}
                      value={track.guitar.maxSpan}
                      onChange={(v) => update(track.id, (t) => (t.guitar.maxSpan = Math.round(v)))}
                    />
                  </Fields>
                </>
              )}
              {track.guitar.output === 'powerTrigger' && (
                <>
                  <NumberField
                    label="トリガー音高補正（半音）"
                    value={track.guitar.triggerTranspose}
                    min={-24}
                    max={24}
                    onChange={(v) =>
                      update(track.id, (t) => (t.guitar.triggerTranspose = Math.round(v)))
                    }
                  />
                  <Alert severity="info">
                    1ノートで和音を鳴らす音源に、和音全体を重ねて入力しないための出力です。パッチの実際の音域・奏法切替はLogic側で確認してください。試聴音は簡易的な5度の和音です。
                  </Alert>
                </>
              )}
            </>
          )}
        </Stack>
      </Panel>
    </Stack>
  );
}
