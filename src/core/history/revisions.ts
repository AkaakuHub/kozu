import { scoreKeys, scoreTables } from './score-rows.ts';
import type { ScoreRow, ScoreRows, ScoreTable } from './score-rows.ts';

export interface WorkingBranch {
  branch: string;
  head: string;
}
export interface ScoreCommit {
  id: string;
  parent: string | null;
  merge_parent: string | null;
  message: string;
  created_at: number;
}
export interface ScoreBranch {
  name: string;
  head: string | null;
}
export interface ScorePull {
  id: number;
  source: string;
  target: string;
  title: string;
  merged: string | null;
}

function identify(table: ScoreTable, row: ScoreRow) {
  return JSON.stringify(scoreKeys[table].map((key) => row[key]));
}

function equal(a: ScoreRow | undefined, b: ScoreRow | undefined) {
  if (!a || !b) return a === b;
  return (
    Object.entries(a).every(([key, value]) => (b[key] ?? null) === value) &&
    Object.entries(b).every(([key, value]) => (a[key] ?? null) === value)
  );
}

export function delta(table: ScoreTable, prior: ScoreRow[], next: ScoreRow[]): ScoreRow[] {
  const old = new Map(prior.map((row) => [identify(table, row), row]));
  if (table === 'score_header') return equal(prior[0], next[0]) ? [] : next;
  const changed: ScoreRow[] = [];
  for (const row of next) {
    const id = identify(table, row);
    if (!equal(old.get(id), row)) changed.push({ ...row, removed: 0 });
    old.delete(id);
  }
  for (const row of old.values())
    changed.push({
      ...Object.fromEntries(scoreKeys[table].map((key) => [key, row[key]!])),
      removed: 1,
    });
  return changed;
}

export function commonAncestor(
  commits: ScoreCommit[],
  source: string,
  target: string,
): string | null {
  const byId = new Map(commits.map((commit) => [commit.id, commit]));
  const distances = (id: string) => {
    const visited = new Map<string, number>();
    const queue = [{ id, distance: 0 }];
    for (let index = 0; index < queue.length; index++) {
      const item = queue[index]!;
      if (visited.has(item.id)) continue;
      visited.set(item.id, item.distance);
      const commit = byId.get(item.id);
      if (!commit) continue;
      for (const parent of [commit.parent, commit.merge_parent])
        if (parent) queue.push({ id: parent, distance: item.distance + 1 });
    }
    return visited;
  };
  const origin = distances(source);
  const destination = distances(target);
  let best: string | null = null;
  let distance = Infinity;
  for (const [id, from] of origin) {
    const to = destination.get(id);
    if (to !== undefined && from + to < distance) {
      best = id;
      distance = from + to;
    }
  }
  return best;
}

export function mergeRows(
  base: ScoreRows,
  source: ScoreRows,
  target: ScoreRows,
  resolve?: 'source' | 'target',
) {
  const conflicts: string[] = [];
  const rows = {} as ScoreRows;
  for (const table of scoreTables) {
    const index = (rows: ScoreRow[]) => new Map(rows.map((row) => [identify(table, row), row]));
    const previous = index(base[table]);
    const incoming = index(source[table]);
    const current = index(target[table]);
    rows[table] = [];
    for (const id of new Set([...previous.keys(), ...incoming.keys(), ...current.keys()])) {
      const ancestor = previous.get(id);
      const ours = current.get(id);
      const theirs = incoming.get(id);
      let chosen = ours;
      if (equal(ours, ancestor)) chosen = theirs;
      else if (!equal(theirs, ancestor) && !equal(ours, theirs)) {
        conflicts.push(`${table} ${id}`);
        if (resolve === 'source') chosen = theirs;
      }
      if (chosen) rows[table].push(chosen);
    }
  }
  return { rows, conflicts };
}
