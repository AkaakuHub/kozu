import { useEffect, useState } from 'react';
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
import { fitProgression, referenceKey } from '../../core/progression-library.ts';
import type { ProgressionReference } from '../../core/progression-library.ts';
import { keyName } from '../../core/theory.ts';
import type { Chord, Project, Section } from '../../core/types.ts';
import type { WorkingBranch } from '../../core/history/revisions.ts';
import { readRevision } from '../../infrastructure/persistence/history-http.ts';
import { Fields } from '../shared.tsx';

const endpoint = '/api/progressions';

async function list(): Promise<ProgressionReference[]> {
  const response = await fetch(endpoint, { cache: 'no-store' });
  if (!response.ok) throw new Error('コード進行ライブラリを読み込めません。');
  return response.json();
}

export function ProgressionLibrary({
  working,
  section,
  project,
  apply,
  close,
}: {
  working: WorkingBranch | null;
  section: Section;
  project: Project;
  apply: (chords: Chord[]) => void;
  close: () => void;
}) {
  const [listings, setListings] = useState<ProgressionReference[]>([]);
  const [selected, select] = useState('');
  const [entry, setEntry] = useState({ title: project.title, artist: '', source: '', note: '' });
  const [original, setOriginal] = useState<{ score: Project; section: Section } | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const item = listings.find((record) => record.id === selected);

  useEffect(() => {
    let live = true;
    void list()
      .then((items) => {
        if (live) setListings(items);
      })
      .catch((error) => {
        if (live) setError(error instanceof Error ? error.message : String(error));
      });
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    setOriginal(null);
    if (!item) return;
    let live = true;
    void readRevision(item.revision)
      .then((score) => {
        const section = score.sections.find((part) => part.id === item.section_id);
        if (live && section) setOriginal({ score, section });
      })
      .catch((error) => {
        if (live) setError(error instanceof Error ? error.message : String(error));
      });
    return () => {
      live = false;
    };
  }, [item]);

  const change = (key: keyof typeof entry, value: string) =>
    setEntry((old) => ({ ...old, [key]: value }));
  const mutate = async (method: 'POST' | 'DELETE') => {
    setBusy(true);
    setError('');
    try {
      const response = await fetch(
        method === 'POST' ? endpoint : `${endpoint}?id=${encodeURIComponent(selected)}`,
        method === 'POST'
          ? {
              method,
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ...entry, revision: working?.head, section_id: section.id }),
            }
          : { method },
      );
      const result: { id?: string; error?: string } = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'ライブラリを更新できません。');
      setListings(await list());
      select(method === 'POST' ? (result.id ?? '') : '');
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onClose={close} maxWidth="sm" fullWidth>
      <DialogTitle>コード進行ライブラリ</DialogTitle>
      <DialogContent>
        <Stack gap={2}>
          {error && <Alert severity="error">{error}</Alert>}
          {listings.length > 0 && (
            <TextField
              select
              label="登録した進行"
              value={selected}
              onChange={(e) => select(e.target.value)}
            >
              {listings.map((entry) => (
                <MenuItem key={entry.id} value={entry.id}>
                  {entry.title}
                  {entry.artist && ` · ${entry.artist}`}
                </MenuItem>
              ))}
            </TextField>
          )}
          {original && item && (
            <>
              <p>
                {original.section.name} · {keyName(referenceKey(original.score, original.section))}
              </p>
              {item.note && <p>{item.note}</p>}
              {item.source && (
                <a href={item.source} target="_blank" rel="noreferrer">
                  参照元
                </a>
              )}
              <Fields>
                <Button
                  variant="contained"
                  onClick={() => {
                    apply(fitProgression(original.score, original.section, section.length));
                    close();
                  }}
                >
                  このパートに配置
                </Button>
                <Button
                  color="error"
                  disabled={busy}
                  onClick={() => {
                    if (window.confirm('このライブラリ登録を削除しますか？')) void mutate('DELETE');
                  }}
                >
                  登録を削除
                </Button>
              </Fields>
            </>
          )}
          <TextField
            label="題名"
            value={entry.title}
            onChange={(e) => change('title', e.target.value)}
          />
          <TextField
            label="アーティスト"
            value={entry.artist}
            onChange={(e) => change('artist', e.target.value)}
          />
          <TextField
            label="参照元URL"
            type="url"
            value={entry.source}
            onChange={(e) => change('source', e.target.value)}
          />
          <TextField
            label="分析メモ"
            multiline
            minRows={2}
            value={entry.note}
            onChange={(e) => change('note', e.target.value)}
          />
          <Button
            disabled={!working || !entry.title.trim() || busy}
            onClick={() => void mutate('POST')}
          >
            現在のコミットから登録
          </Button>
          {!working && <span role="status">先に譜面をコミットしてください。</span>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={close}>閉じる</Button>
      </DialogActions>
    </Dialog>
  );
}
