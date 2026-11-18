import type { WorkingBranch } from '../../core/history/revisions.ts';
import type { Project } from '../../core/types.ts';
import { parseProject } from '../../core/validate.ts';
const DB = 'music-workbench-v2';
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore('projects');
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
          const ref: unknown = base.result;
          const working =
            ref &&
            typeof ref === 'object' &&
            'branch' in ref &&
            'head' in ref &&
            typeof ref.branch === 'string' &&
            typeof ref.head === 'string'
              ? { branch: ref.branch, head: ref.head }
              : null;
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
export async function saveProject(project: Project, working: WorkingBranch | null): Promise<void> {
  const payload = JSON.stringify(project);
  parseProject(payload);
  const db = await openDB();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('projects', 'readwrite');
      tx.objectStore('projects').put(payload, 'current');
      tx.objectStore('projects').put(working, 'branch');
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(tx.error);
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}
