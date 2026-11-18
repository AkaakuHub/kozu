import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Button,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  LinearProgress,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { FileMusic, Plus } from 'lucide-react';
import type { Project } from '../../core/types.ts';
import type { ScoreProject } from '../../core/score-projects.ts';
import type { WorkingBranch } from '../../core/history/revisions.ts';
import { shouldResumeDraft } from '../../core/history/fingerprint.ts';
import {
  createScoreProject,
  readProjects,
  readRevision,
} from '../../infrastructure/persistence/history-http.ts';
import {
  loadDraft,
  rememberRevision,
  saveProject,
} from '../../infrastructure/persistence/project-storage.ts';
import { importScore } from '../../infrastructure/persistence/import-score.ts';
import { useAppearance } from '../workbench/appearance.ts';
import { MuiAppearance } from '../workbench/MuiAppearance.tsx';
import { usePreferences } from '../workbench/usePreferences.ts';

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

async function openEditor(score: Project, branch: WorkingBranch | null) {
  await saveProject(score, branch);
  location.assign('/editor');
}

export default function ProjectLibrary() {
  const [projects, setProjects] = useState<ScoreProject[]>([]);
  const [scratch, setScratch] = useState<Project | null>(null);
  const [form, setForm] = useState(false);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  const { preferences } = usePreferences(setError);
  const mode = useAppearance(preferences.appearance ?? 'system');

  useEffect(() => {
    let live = true;
    const list = readProjects().then((scores) => {
      if (live) setProjects(scores);
    });
    const draft = loadDraft(null).then((saved) => {
      if (live) setScratch(saved?.project ?? null);
    });
    void Promise.allSettled([list, draft]).then((results) => {
      if (!live) return;
      const failure = results.find((result) => result.status === 'rejected');
      if (failure) setError(errorMessage(failure.reason));
      setBusy(false);
    });
    return () => {
      live = false;
    };
  }, []);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (failure) {
      setError(errorMessage(failure));
      setBusy(false);
    }
  };

  return (
    <MuiAppearance mode={mode}>
      <Container component="main" maxWidth="sm" sx={{ my: 4, color: 'text.primary' }}>
        <Stack spacing={2}>
          <Typography variant="h5" component="h1">
            プロジェクト
          </Typography>
          <Stack direction="row" spacing={1}>
            <Button
              variant="contained"
              startIcon={<Plus size={16} />}
              disabled={busy}
              onClick={() => setForm(true)}
            >
              新規プロジェクト
            </Button>
            <Button
              variant="outlined"
              startIcon={<FileMusic size={16} />}
              disabled={busy}
              onClick={() => fileInput.current?.click()}
            >
              MIDI・JSONを開く
            </Button>
          </Stack>
          <input
            ref={fileInput}
            type="file"
            hidden
            accept=".mid,.midi,.json,audio/midi,application/json"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (file && (!scratch || window.confirm('端末の下書きを置き換えますか？')))
                void run(async () => openEditor(await importScore(file), null));
            }}
          />
          {error && <Alert severity="error">{error}</Alert>}
          {busy && <LinearProgress aria-label="プロジェクトを読み込み中" />}
          {(projects.length > 0 || scratch) && (
            <Paper variant="outlined">
              <List disablePadding component="div" aria-label="曲プロジェクト">
                {projects.map((item) => (
                  <ListItemButton
                    key={item.id}
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        const draft = await loadDraft(item.id);
                        if (
                          draft?.working &&
                          (await shouldResumeDraft(draft.project, draft.working, item.head))
                        )
                          await openEditor(draft.project, draft.working);
                        else {
                          const score = await readRevision(item.id, item.head);
                          await openEditor(
                            score,
                            await rememberRevision(
                              { projectId: item.id, branch: 'main', head: item.head },
                              score,
                            ),
                          );
                        }
                      })
                    }
                  >
                    <ListItemText primary={item.title} />
                  </ListItemButton>
                ))}
                {scratch && (
                  <ListItemButton
                    disabled={busy}
                    onClick={() => void run(() => openEditor(scratch, null))}
                  >
                    <ListItemText primary={`端末の下書き · ${scratch.title}`} />
                  </ListItemButton>
                )}
              </List>
            </Paper>
          )}
          {!busy && !error && !projects.length && !scratch && (
            <Typography>プロジェクトがありません</Typography>
          )}
        </Stack>
      </Container>
      {form && <ProjectForm mode={mode} load={openEditor} close={() => setForm(false)} />}
    </MuiAppearance>
  );
}

export function ProjectForm({
  project,
  load,
  close,
  mode,
}: {
  project?: Project;
  mode: 'light' | 'dark';
  load: (score: Project, branch: WorkingBranch) => Promise<void>;
  close: () => void;
}) {
  const [id] = useState(() => crypto.randomUUID());
  const [title, setTitle] = useState(project?.title ?? '');
  const [section, setSection] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      const saved = await createScoreProject(
        project ? { id, title, score: project } : { id, title, section },
      );
      await load(
        saved.project,
        await rememberRevision(
          { projectId: saved.id, branch: 'main', head: saved.head },
          saved.project,
        ),
      );
      close();
    } catch (failure) {
      setError(errorMessage(failure));
      setBusy(false);
    }
  };

  return (
    <MuiAppearance mode={mode}>
      <Dialog open fullWidth maxWidth="xs" onClose={busy ? undefined : close}>
        <DialogTitle>{project ? '作業中の曲をプロジェクトに保存' : '新規プロジェクト'}</DialogTitle>
        <DialogContent>
          <Stack
            spacing={2}
            id="score-project-form"
            component="form"
            onSubmit={(event) => {
              event.preventDefault();
              if (!busy) void submit();
            }}
          >
            {error && <Alert severity="error">{error}</Alert>}
            <TextField
              required
              label="プロジェクト名"
              disabled={busy}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
            {!project && (
              <TextField
                required
                label="最初のセクション名"
                disabled={busy}
                value={section}
                onChange={(event) => setSection(event.target.value)}
              />
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button disabled={busy} onClick={close}>
            キャンセル
          </Button>
          <Button
            variant="contained"
            type="submit"
            form="score-project-form"
            disabled={busy || !title.trim() || (!project && !section.trim())}
          >
            {project ? '保存' : '作成'}
          </Button>
        </DialogActions>
      </Dialog>
    </MuiAppearance>
  );
}
