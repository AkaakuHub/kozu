import type { Project } from '../types.ts';
import type { WorkingBranch } from './revisions.ts';

async function fingerprint(project: Project) {
  const bytes = new TextEncoder().encode(JSON.stringify(project));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function committedBranch(
  branch: WorkingBranch,
  project: Project,
): Promise<WorkingBranch> {
  return { ...branch, fingerprint: await fingerprint(project) };
}

export async function hasUncommittedChanges(project: Project, branch: WorkingBranch | null) {
  return branch?.fingerprint === undefined || branch.fingerprint !== (await fingerprint(project));
}
