import { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  List,
  ListItemButton,
  ListItemText,
  Stack,
  TextField,
} from '@mui/material';
import type { Project } from '../../core/types.ts';
import type { ScoreProject } from '../../core/score-projects.ts';
import type { WorkingBranch } from '../../core/history/revisions.ts';
import {
  createScoreProject,
  readProjects,
  readRevision,
} from '../../infrastructure/persistence/history-http.ts';
import { loadDraft } from '../../infrastructure/persistence/project-storage.ts';
import { MuiAppearance } from '../workbench/MuiAppearance.tsx';

export function ProjectLibrary({
  project,
  working,
  register,
  mode,
  load,
  close,
}: {
  project: Project;
  working: WorkingBranch | null;
  register: boolean;
  mode: 'light' | 'dark';
  load: (score: Project, branch: WorkingBranch | null) => Promise<void>;
  close: () => void;
}) {
  const [projects, setProjects] = useState<ScoreProject[]>([]);
  const [id] = useState(() => crypto.randomUUID());
  const [hasScratch, setHasScratch] = useState(false);
  const [form, setForm] = useState(register);
  const [title, setTitle] = useState(register ? project.title : '');
  const [section, setSection] = useState('');
  const [busy, setBusy] = useState(!register);
  const [error, setError] = useState('');
  useEffect(() => {
    if (register) return;
    let live = true;
    void Promise.all([readProjects(), loadDraft(null)])
      .then(([list, scratch]) => {
        if (live) {
          setProjects(list);
          setHasScratch(Boolean(scratch));
        }
      })
      .catch((failure: unknown) => {
        if (live)
          setError(
            failure instanceof Error ? failure.message : 'プロジェクト一覧を取得できません。',
          );
      })
      .finally(() => {
        if (live) setBusy(false);
      });
    return () => {
      live = false;
    };
  }, [register]);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await action();
      close();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'プロジェクトを操作できません。');
    } finally {
      setBusy(false);
    }
  };
  return (
    <MuiAppearance mode={mode}>
      <Dialog open fullWidth maxWidth="sm" onClose={busy ? undefined : close}>
        <DialogTitle>
          {register
            ? '作業中の曲をプロジェクトに保存'
            : form
              ? '新規プロジェクト'
              : 'プロジェクト一覧'}
        </DialogTitle>
        <DialogContent dividers>
          {error && <Alert severity="error">{error}</Alert>}
          {busy && <span role="status">読み込み中</span>}
          {form ? (
            <Stack
              spacing={1}
              id="score-project-form"
              component="form"
              onSubmit={(event) => {
                event.preventDefault();
                void run(async () => {
                  const saved = await createScoreProject(
                    register ? { id, title, score: project } : { id, title, section },
                  );
                  await load(saved.project, {
                    projectId: saved.id,
                    branch: 'main',
                    head: saved.head,
                  });
                });
              }}
            >
              <TextField
                required
                label="プロジェクト名"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
              {!register && (
                <TextField
                  required
                  label="最初のセクション名"
                  value={section}
                  onChange={(event) => setSection(event.target.value)}
                />
              )}
            </Stack>
          ) : (
            <List component="div" disablePadding aria-label="曲プロジェクト">
              {projects.map((item) => (
                <ListItemButton
                  key={item.id}
                  selected={working?.projectId === item.id}
                  disabled={busy || working?.projectId === item.id}
                  onClick={() =>
                    void run(async () => {
                      const draft = await loadDraft(item.id);
                      if (draft?.working) await load(draft.project, draft.working);
                      else
                        await load(await readRevision(item.id, item.head), {
                          projectId: item.id,
                          branch: 'main',
                          head: item.head,
                        });
                    })
                  }
                >
                  <ListItemText primary={item.title} />
                </ListItemButton>
              ))}
              {hasScratch && working && (
                <ListItemButton
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      const draft = await loadDraft(null);
                      if (!draft) throw new Error('端末の下書きがありません。');
                      await load(draft.project, null);
                    })
                  }
                >
                  <ListItemText primary="端末の下書き" />
                </ListItemButton>
              )}
              {!busy && !error && projects.length === 0 && (
                <ListItemText primary="プロジェクトがありません" />
              )}
            </List>
          )}
        </DialogContent>
        <DialogActions>
          <Button disabled={busy} onClick={close}>
            閉じる
          </Button>
          {!form && !working && (
            <Button
              disabled={busy}
              onClick={() => {
                setTitle(project.title);
                setForm(true);
              }}
            >
              新規
            </Button>
          )}
          {!form && working && (
            <Button disabled={busy} onClick={() => setForm(true)}>
              新規
            </Button>
          )}
          {form && (
            <Button
              variant="contained"
              type="submit"
              form="score-project-form"
              disabled={busy || !title.trim() || (!register && !section.trim())}
            >
              {register ? '保存' : '作成'}
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </MuiAppearance>
  );
}
