import { useEffect, useState } from 'react';
import { createBlankProject } from '../../core/presets.ts';
import type { Project } from '../../core/types.ts';
import { loadProject, saveProject } from '../../infrastructure/persistence/project-storage.ts';
import type { WorkingBranch } from '../../core/history/revisions.ts';

export function useProject(notify: (message: string) => void) {
  const [history, setHistory] = useState<{ past: Project[]; present: Project; future: Project[] }>(
    () => ({
      past: [],
      present: createBlankProject(),
      future: [],
    }),
  );
  const [ready, setReady] = useState(false);
  const [storageBlocked, setStorageBlocked] = useState(false);
  const [lastSaved, setLastSaved] = useState<{
    project: Project;
    working: WorkingBranch | null;
  } | null>(null);
  const [working, mark] = useState<WorkingBranch | null>(null);
  const project = history.present;
  useEffect(() => {
    let live = true;
    void loadProject()
      .then((saved) => {
        if (!live || !saved) return;
        setHistory({ past: [], present: saved.project, future: [] });
        mark(saved.working);
        setLastSaved(saved);
      })
      .catch(() => {
        if (!live) return;
        setStorageBlocked(true);
        notify('端末に保存された曲を読み込めませんでした。');
      })
      .finally(() => {
        if (live) setReady(true);
      });
    return () => {
      live = false;
    };
  }, [notify]);

  useEffect(() => {
    if (
      !ready ||
      storageBlocked ||
      (project === lastSaved?.project && working === lastSaved.working)
    )
      return;
    let live = true;
    const timer = setTimeout(() => {
      void saveProject(project, working)
        .then(() => {
          if (live) setLastSaved({ project, working });
        })
        .catch(() => {
          if (live) notify('曲を端末に保存できませんでした。');
        });
    }, 450);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [project, working, ready, storageBlocked, lastSaved, notify]);

  const commit = (next: Project) =>
    setHistory((old) => ({
      past: [...old.past, old.present].slice(-50),
      present: next,
      future: [],
    }));
  const undo = () =>
    setHistory((old) => {
      const previous = old.past.at(-1);
      return previous
        ? { past: old.past.slice(0, -1), present: previous, future: [old.present, ...old.future] }
        : old;
    });
  const redo = () =>
    setHistory((old) => {
      const next = old.future[0];
      return next
        ? { past: [...old.past, old.present], present: next, future: old.future.slice(1) }
        : old;
    });
  return {
    project,
    ready,
    commit,
    replace: async (next: Project, origin: WorkingBranch | null) => {
      if (storageBlocked) throw new Error('端末への保存を再開してから曲を切り替えてください。');
      await saveProject(project, working);
      await saveProject(next, origin);
      setHistory({ past: [], present: next, future: [] });
      mark(origin);
      setLastSaved({ project: next, working: origin });
    },
    undo: history.past.length ? undo : null,
    redo: history.future.length ? redo : null,
    working,
    mark,
    storageBlocked,
    resumeSaving: () => setStorageBlocked(false),
    saved: project === lastSaved?.project && working === lastSaved.working,
  };
}
