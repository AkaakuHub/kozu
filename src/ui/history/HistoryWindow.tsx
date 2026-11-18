import { useEffect, useState } from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
  Alert,
} from '@mui/material';
import { createTwoFilesPatch } from 'diff';
import type { Project } from '../../core/types.ts';
import { MuiAppearance } from '../workbench/MuiAppearance.tsx';
import type { WorkingBranch } from '../../core/history/revisions.ts';
import { commonAncestor } from '../../core/history/revisions.ts';
import { committedBranch } from '../../core/history/fingerprint.ts';
import {
  HistoryError,
  readHistory,
  readRevision,
  writeHistory,
} from '../../infrastructure/persistence/history-http.ts';
import type {
  HistoryCommand,
  HistoryState,
} from '../../infrastructure/persistence/history-http.ts';
import { Fields } from '../shared.tsx';
import { CommitGraph } from './CommitGraph.tsx';
import './history.css';

interface Props {
  project: Project;
  working: WorkingBranch;
  mark: (branch: WorkingBranch) => void;
  load: (project: Project, branch: WorkingBranch) => void;
  close: () => void;
  commitMode: boolean;
  mode: 'light' | 'dark';
}
const empty: HistoryState = { branches: [], commits: [], pulls: [] };

export function HistoryWindow({ project, working, mark, load, close, commitMode, mode }: Props) {
  const [history, setHistory] = useState(empty);
  const [branch, setBranch] = useState(working.branch);
  const projectId = working.projectId;
  const [revision, select] = useState('');
  const [message, setMessage] = useState('');
  const [newBranch, setNewBranch] = useState('');
  const [source, setSource] = useState('');
  const [title, setTitle] = useState('');
  const [pullId, selectPull] = useState(0);
  const [diff, setDiff] = useState('');
  const [conflicts, setConflicts] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    let live = true;
    void readHistory(projectId)
      .then((state) => {
        if (!live) return;
        setHistory(state);
        select(state.branches.find((b) => b.name === branch)?.head ?? '');
      })
      .catch((error) => {
        if (live) setError(String(error));
      })
      .finally(() => {
        if (live) setBusy(false);
      });
    return () => {
      live = false;
    };
  }, [projectId]);

  const head = history.branches.find((b) => b.name === branch)?.head ?? null;
  const selected = history.commits.find((entry) => entry.id === revision);
  const pull = history.pulls.find((entry) => entry.id === pullId);
  const incoming = history.branches.find((b) => b.name === pull?.source)?.head;
  const destination = history.branches.find((b) => b.name === pull?.target)?.head;
  const expected = working.branch === branch ? working.head : null;
  const refresh = async () => {
    const state = await readHistory(projectId);
    setHistory(state);
    return state;
  };
  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError('');
    setConflicts([]);
    try {
      await action();
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
      if (error instanceof HistoryError) setConflicts(error.conflicts);
    } finally {
      setBusy(false);
    }
  };
  const send = async (command: HistoryCommand) => {
    const result = await writeHistory(projectId, command);
    await refresh().catch(() =>
      setError('更新を保存しました。履歴の表示は「更新」で読み込み直してください。'),
    );
    return result;
  };
  const commit = () =>
    void run(async () => {
      const result = await send({ op: 'commit', branch, expected, message, score: project });
      if (typeof result.id === 'string') {
        mark(await committedBranch({ projectId, branch, head: result.id }, project));
        select(result.id);
      }
      setMessage('');
    });
  const checkout = () =>
    void run(async () => {
      if (
        !head ||
        !window.confirm(
          `${branch}の先端を開きますか？現在の編集は「取り消す」で戻すことができます。`,
        )
      )
        return;
      const score = await readRevision(projectId, head);
      load(score, await committedBranch({ projectId, branch, head }, score));
      select(head);
      close();
    });
  const restore = () =>
    void run(async () => {
      if (!revision || !window.confirm('選択した譜面を新しいコミットとして復元しますか？')) return;
      const result = await send({
        op: 'restore',
        branch,
        expected: head,
        from: revision,
        message: message.trim() || `復元 ${revision.slice(0, 7)}`,
      });
      if (typeof result.id === 'string') {
        const score = await readRevision(projectId, result.id);
        load(score, await committedBranch({ projectId, branch, head: result.id }, score));
        select(result.id);
        setMessage('');
      }
    });
  const compare = (first: string | null, second: string | Project) =>
    void run(async () => {
      const [a, b] = await Promise.all([
        first ? readRevision(projectId, first) : null,
        typeof second === 'string' ? readRevision(projectId, second) : second,
      ]);
      setDiff(
        createTwoFilesPatch(
          first?.slice(0, 7) ?? '初版',
          typeof second === 'string' ? second.slice(0, 7) : '作業中',
          a ? JSON.stringify(a, null, 2) : '',
          JSON.stringify(b, null, 2),
          undefined,
          undefined,
          { context: 2 },
        ) ?? '',
      );
    });
  const comparePull = () => {
    if (incoming && destination)
      compare(commonAncestor(history.commits, incoming, destination), incoming);
  };
  const merge = (resolve?: 'source' | 'target') =>
    void run(async () => {
      if (!pull || !incoming || !destination) return;
      const result = await send({
        op: 'merge',
        pull: pull.id,
        source: incoming,
        target: destination,
        ...(resolve ? { resolve } : {}),
      });
      if (typeof result.id === 'string') select(result.id);
    });

  return (
    <MuiAppearance mode={mode}>
      <Dialog open fullWidth maxWidth="md" onClose={busy ? undefined : close}>
        <DialogTitle>{commitMode ? '譜面をコミット' : '履歴とブランチ'}</DialogTitle>
        <DialogContent>
          <Stack gap={2}>
            {error && <Alert severity="error">{error}</Alert>}
            {conflicts.length > 0 && (
              <Stack gap={1}>
                <pre className="score-diff">{conflicts.join('\n')}</pre>
                <Fields>
                  <Button onClick={() => merge('target')}>競合箇所は取り込み先を採用</Button>
                  <Button onClick={() => merge('source')}>競合箇所は取り込み元を採用</Button>
                </Fields>
              </Stack>
            )}
            <Fields>
              <TextField
                select
                label="ブランチ"
                value={history.branches.length ? branch : ''}
                className="history-field"
                onChange={(event) => {
                  setBranch(event.target.value);
                  select(history.branches.find((b) => b.name === event.target.value)?.head ?? '');
                }}
              >
                {history.branches.map((item) => (
                  <MenuItem key={item.name} value={item.name}>
                    {item.name}
                  </MenuItem>
                ))}
              </TextField>
              <Button
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    await refresh();
                  })
                }
              >
                更新
              </Button>
              <Button disabled={busy || !head} onClick={checkout}>
                Pull
              </Button>
              <Button disabled={busy} onClick={() => compare(head, project)}>
                作業中の差分
              </Button>
            </Fields>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                commit();
              }}
            >
              <Fields>
                <TextField
                  label="コミットメッセージ"
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  className="history-title"
                  slotProps={{ htmlInput: { maxLength: 200 } }}
                />
                <Button
                  type="submit"
                  variant="contained"
                  disabled={busy || !message.trim() || head !== expected}
                >
                  コミット
                </Button>
              </Fields>
            </form>
            {head !== expected && (
              <Alert severity="warning">
                クラウドの先端をPullしてから、このブランチにコミットしてください。
              </Alert>
            )}
            {history.commits.length > 0 && (
              <CommitGraph
                commits={history.commits}
                branches={history.branches}
                selected={revision}
                choose={select}
              />
            )}
            <Fields>
              <Button
                disabled={busy || !selected}
                onClick={() => {
                  if (selected) compare(selected.parent, selected.id);
                }}
              >
                コミットの差分
              </Button>
              <Button disabled={busy || !selected || head === revision} onClick={restore}>
                この版へ復元
              </Button>
              <TextField
                label="新しいブランチ名"
                value={newBranch}
                onChange={(event) => setNewBranch(event.target.value)}
                className="history-field"
              />
              <Button
                disabled={busy || !revision || !newBranch.trim()}
                onClick={() =>
                  void run(async () => {
                    await send({ op: 'branch', name: newBranch.trim(), from: revision });
                    setBranch(newBranch.trim());
                    setNewBranch('');
                  })
                }
              >
                選択したコミットから分岐
              </Button>
            </Fields>
            {history.branches.length > 1 && (
              <Fields>
                <TextField
                  select
                  label="PRの取り込み元"
                  value={source}
                  onChange={(event) => setSource(event.target.value)}
                  className="history-field"
                >
                  {history.branches
                    .filter((b) => b.name !== branch && b.head)
                    .map((b) => (
                      <MenuItem key={b.name} value={b.name}>
                        {b.name}
                      </MenuItem>
                    ))}
                </TextField>
                <TextField
                  label="PRの件名"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  className="history-title"
                />
                <Button
                  disabled={busy || !source || source === branch || !title.trim()}
                  onClick={() =>
                    void run(async () => {
                      const result = await send({ op: 'pull', source, target: branch, title });
                      if (typeof result.id === 'number') selectPull(result.id);
                      setTitle('');
                    })
                  }
                >
                  PR作成
                </Button>
              </Fields>
            )}
            {history.pulls.length > 0 && (
              <Fields>
                <TextField
                  select
                  label="PR"
                  value={pullId || ''}
                  onChange={(event) => {
                    selectPull(Number(event.target.value));
                    setConflicts([]);
                  }}
                  className="history-title"
                >
                  {history.pulls.map((p) => (
                    <MenuItem key={p.id} value={p.id}>
                      {p.title} · {p.source} → {p.target}
                      {p.merged ? ' ✓' : ''}
                    </MenuItem>
                  ))}
                </TextField>
                <Button disabled={busy || !pull} onClick={comparePull}>
                  PRの差分
                </Button>
                <Button disabled={busy || !pull || Boolean(pull.merged)} onClick={() => merge()}>
                  マージ
                </Button>
              </Fields>
            )}
            {diff && <pre className="score-diff">{diff}</pre>}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={close}>閉じる</Button>
        </DialogActions>
      </Dialog>
    </MuiAppearance>
  );
}
