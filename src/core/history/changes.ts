import { delta, identify } from './revisions.ts';
import { projectRows, rowsProject, scoreKeys, scoreTables } from './score-rows.ts';
import type { ScoreRow, ScoreRows, ScoreTable } from './score-rows.ts';
import type { Project } from '../types.ts';

export type ScoreChanges = Partial<ScoreRows>;

export function scoreChanges(base: Project, score: Project): ScoreChanges {
  const before = projectRows(base);
  const after = projectRows(score);
  const changes: ScoreChanges = {};
  for (const table of scoreTables) {
    const rows = delta(table, before[table], after[table]);
    if (rows.length) changes[table] = rows;
  }
  return changes;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isRow(table: ScoreTable, value: unknown): value is ScoreRow {
  return (
    isRecord(value) &&
    Object.values(value).every(
      (cell) =>
        cell === null ||
        typeof cell === 'string' ||
        (typeof cell === 'number' && Number.isFinite(cell)),
    ) &&
    (table === 'score_header'
      ? !Object.hasOwn(value, 'removed')
      : value.removed === 0 || value.removed === 1) &&
    scoreKeys[table].every((key) =>
      key === 'pos'
        ? typeof value[key] === 'number' && Number.isSafeInteger(value[key]) && value[key] >= 0
        : typeof value[key] === 'string',
    )
  );
}

const invalid = () => new Error('譜面の差分が不正です。');

export function applyScoreChanges(base: ScoreRows, changes: unknown): Project {
  if (!isRecord(changes) || Object.keys(changes).some((table) => !Object.hasOwn(scoreKeys, table)))
    throw invalid();
  const rows = { ...base };
  for (const table of scoreTables) {
    if (!Object.hasOwn(changes, table)) continue;
    const patch: unknown = changes[table];
    if (!Array.isArray(patch) || !patch.length || !patch.every((row) => isRow(table, row)))
      throw invalid();
    const items = new Map(base[table].map((row) => [identify(table, row), row]));
    const touched = new Set<string>();
    for (const { removed, ...row } of patch) {
      const key = identify(table, row);
      if (touched.has(key)) throw invalid();
      touched.add(key);
      if (removed === 1) {
        if (!items.delete(key)) throw invalid();
      } else items.set(key, row);
    }
    rows[table] = [...items.values()];
  }
  return rowsProject(rows);
}
