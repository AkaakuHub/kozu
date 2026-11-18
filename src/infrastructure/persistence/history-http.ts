import type { ScoreBranch, ScoreCommit, ScorePull } from '../../core/history/revisions.ts';
import type { Project } from '../../core/types.ts';
import { parseProject } from '../../core/validate.ts';

export interface HistoryState {
  branches: ScoreBranch[];
  commits: ScoreCommit[];
  pulls: ScorePull[];
}
export type HistoryCommand =
  | { op: 'commit'; branch: string; expected: string | null; message: string; score: Project }
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

export async function readHistory(): Promise<HistoryState> {
  const response = await fetch('/api/history', { cache: 'no-store' });
  if (!response.ok) throw new Error('クラウドの履歴を取得できません。');
  return response.json();
}

export async function readRevision(id: string): Promise<Project> {
  const response = await fetch(`/api/history?revision=${encodeURIComponent(id)}`, {
    cache: 'no-store',
  });
  if (!response.ok) throw new Error('コミットの譜面を取得できません。');
  return parseProject(await response.text());
}

export async function writeHistory(
  command: HistoryCommand,
): Promise<{ id?: string | number; name?: string }> {
  const response = await fetch('/api/history', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(command),
  });
  const result: { error?: string; conflicts?: string[]; id?: string | number; name?: string } =
    await response.json();
  if (!response.ok)
    throw new HistoryError(result.error ?? '履歴を更新できません。', result.conflicts);
  return result;
}
