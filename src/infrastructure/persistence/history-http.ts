import type { ScoreBranch, ScoreCommit, ScorePull } from '../../core/history/revisions.ts';
import type { Project } from '../../core/types.ts';
import { parseProject } from '../../core/validate.ts';
import type { ScoreProject } from '../../core/score-projects.ts';
import type { ScoreChanges } from '../../core/history/changes.ts';

const historyUrl = (projectId: string, revision?: string) => {
  const params = new URLSearchParams({ project: projectId });
  if (revision) params.set('revision', revision);
  return `/api/history?${params}`;
};

export interface HistoryState {
  branches: ScoreBranch[];
  commits: ScoreCommit[];
  pulls: ScorePull[];
}
export type HistoryCommand =
  | { op: 'commit'; branch: string; expected: string; message: string; changes: ScoreChanges }
  | { op: 'restore'; branch: string; expected: string | null; message: string; from: string }
  | { op: 'branch'; name: string; from: string }
  | { op: 'pull'; source: string; target: string; title: string }
  | { op: 'merge'; pull: number; source: string; target: string; resolve?: 'source' | 'target' };

export class HistoryError extends Error {
  constructor(
    message: string,
    readonly conflicts: string[] = [],
  ) {
    super(message);
  }
}

export async function readHistory(projectId: string): Promise<HistoryState> {
  const response = await fetch(historyUrl(projectId), { cache: 'no-store' });
  if (!response.ok) throw new Error('クラウドの履歴を取得できません。');
  return response.json();
}

export async function readRevision(projectId: string, id: string): Promise<Project> {
  const response = await fetch(historyUrl(projectId, id), {
    cache: 'no-store',
  });
  if (!response.ok) throw new Error('コミットの譜面を取得できません。');
  return parseProject(await response.text());
}

export async function writeHistory(
  projectId: string,
  command: HistoryCommand,
): Promise<{ id?: string | number; name?: string; createdAt?: number }> {
  const response = await fetch(historyUrl(projectId), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(command),
  });
  const result: {
    error?: string;
    conflicts?: string[];
    id?: string | number;
    name?: string;
    createdAt?: number;
  } = await response.json();
  if (!response.ok)
    throw new HistoryError(result.error ?? '履歴を更新できません。', result.conflicts);
  return result;
}

export async function readProjects(): Promise<ScoreProject[]> {
  const response = await fetch('/api/projects', { cache: 'no-store' });
  if (!response.ok) throw new Error('プロジェクト一覧を取得できません。');
  return response.json();
}

export async function createScoreProject(
  input: { id: string; title: string } & ({ section: string } | { score: Project }),
): Promise<ScoreProject & { project: Project }> {
  const response = await fetch('/api/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const error: unknown = await response.json().catch(() => null);
    throw new Error(
      error && typeof error === 'object' && 'error' in error && typeof error.error === 'string'
        ? error.error
        : 'プロジェクトを保存できませんでした。',
    );
  }
  return response.json();
}
