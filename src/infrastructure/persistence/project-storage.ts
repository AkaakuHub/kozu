import type { WorkingBranch } from '../../core/history/revisions.ts';
import type { Project } from '../../core/types.ts';
import { parseProject } from '../../core/validate.ts';
import { committedBranch } from '../../core/history/fingerprint.ts';
const DB = 'music-workbench-v2';
const draftKey = (projectId: string | null) =>
  projectId === null ? 'scratch' : `project:${projectId}`;
function branchRef(value: unknown): WorkingBranch | null {
  return value &&
    typeof value === 'object' &&
    'branch' in value &&
    'head' in value &&
    'projectId' in value &&
    typeof value.branch === 'string' &&
    typeof value.head === 'string' &&
    typeof value.projectId === 'string'
    ? {
        branch: value.branch,
        head: value.head,
        projectId: value.projectId,
        ...('fingerprint' in value && typeof value.fingerprint === 'string'
          ? { fingerprint: value.fingerprint }
          : {}),
      }
    : null;
}
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 2);
    request.onupgradeneeded = (event) => {
      if (event.oldVersion === 0) {
        request.result.createObjectStore('projects');
        return;
      }
      const store = request.transaction!.objectStore('projects');
      const branch = store.get('branch');
      branch.onsuccess = () => {
        const saved: unknown = branch.result;
        if (saved && typeof saved === 'object' && 'branch' in saved && 'head' in saved)
          store.put({ ...saved, projectId: 'initial' }, 'branch');
      };
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('端末の譜面が別のウィンドウで使用されています。'));
  });
}
export async function loadProject(): Promise<{
  project: Project;
  working: WorkingBranch | null;
} | null> {
  const db = await openDB();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction('projects', 'readonly'),
        req = tx.objectStore('projects').get('current'),
        base = tx.objectStore('projects').get('branch');
      tx.oncomplete = () => {
        try {
          const working = branchRef(base.result);
          resolve(
            typeof req.result === 'string' ? { project: parseProject(req.result), working } : null,
          );
        } catch (e) {
          reject(e);
        }
      };
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

export async function loadDraft(projectId: string | null): ReturnType<typeof loadProject> {
  const db = await openDB();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction('projects', 'readonly');
      const request = tx.objectStore('projects').get(draftKey(projectId));
      tx.oncomplete = () => {
        try {
          const draft: unknown = request.result;
          resolve(
            draft &&
              typeof draft === 'object' &&
              'payload' in draft &&
              typeof draft.payload === 'string'
              ? {
                  project: parseProject(draft.payload),
                  working: 'working' in draft ? branchRef(draft.working) : null,
                }
              : null,
          );
        } catch (error) {
          reject(error);
        }
      };
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}
export async function saveProject(project: Project, working: WorkingBranch | null): Promise<void> {
  const payload = JSON.stringify(project);
  parseProject(payload);
  const db = await openDB();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('projects', 'readwrite');
      tx.objectStore('projects').put(payload, 'current');
      tx.objectStore('projects').put(working, 'branch');
      tx.objectStore('projects').put({ payload, working }, draftKey(working?.projectId ?? null));
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(tx.error);
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

export async function loadCachedRevision(projectId: string, head: string): Promise<Project | null> {
  const db = await openDB();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction('projects', 'readonly');
      const request = tx.objectStore('projects').get(`base:${projectId}`);
      tx.oncomplete = () => {
        const row: unknown = request.result;
        try {
          resolve(
            row &&
              typeof row === 'object' &&
              'head' in row &&
              row.head === head &&
              'payload' in row &&
              typeof row.payload === 'string'
              ? parseProject(row.payload)
              : null,
          );
        } catch (error) {
          reject(error);
        }
      };
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

export async function cacheRevision(branch: WorkingBranch, project: Project): Promise<void> {
  const payload = JSON.stringify(project);
  const db = await openDB();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('projects', 'readwrite');
      tx.objectStore('projects').put({ head: branch.head, payload }, `base:${branch.projectId}`);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

export async function rememberRevision(
  branch: WorkingBranch,
  project: Project,
): Promise<WorkingBranch> {
  await cacheRevision(branch, project);
  return committedBranch(branch, project);
}
