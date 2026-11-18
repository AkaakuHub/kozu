import type { Project } from '../../core/types.ts';
import { projectRows, rowsProject, scoreTables } from '../../core/history/score-rows.ts';
import type { ScoreRow, ScoreRows } from '../../core/history/score-rows.ts';
import { delta } from '../../core/history/revisions.ts';
import type { ScoreBranch, ScoreCommit, ScorePull } from '../../core/history/revisions.ts';
import { revisionQuery } from './revision-query.ts';
import { revisionWrites } from './revision-writes.ts';

export async function readHistory(db: D1Database, owner: string) {
  const [branches, commits, pulls] = await db.batch([
    db.prepare('SELECT name, head FROM score_branches WHERE owner = ? ORDER BY name').bind(owner),
    db
      .prepare(
        'SELECT id, parent, merge_parent, message, created_at FROM score_commits WHERE owner = ? ORDER BY created_at DESC, rowid DESC',
      )
      .bind(owner),
    db
      .prepare(
        'SELECT id, source, target, title, merged FROM score_pulls WHERE owner = ? ORDER BY id DESC',
      )
      .bind(owner),
  ]);
  return {
    branches: (branches?.results.length
      ? branches.results
      : [{ name: 'main', head: null }]) as ScoreBranch[],
    commits: (commits?.results ?? []) as ScoreCommit[],
    pulls: (pulls?.results ?? []) as ScorePull[],
  };
}

export async function loadRows(
  db: D1Database,
  owner: string,
  id: string,
): Promise<ScoreRows | null> {
  const result = await db.batch<ScoreRow>(
    scoreTables.map((table) => db.prepare(revisionQuery(table)).bind(id, owner)),
  );
  if (!result[0]?.results.length) return null;
  return Object.fromEntries(
    scoreTables.map((table, index) => [
      table,
      result[index]!.results.map(
        ({ revision: _revision, nearest: _nearest, removed: _removed, ...row }) => row,
      ),
    ]),
  ) as ScoreRows;
}

export async function loadScore(db: D1Database, owner: string, id: string) {
  const rows = await loadRows(db, owner, id);
  return rows ? rowsProject(rows) : null;
}

interface Save {
  owner: string;
  branch: string;
  expected: string | null;
  message: string;
  project: Project;
  before?: ScoreRows;
  registerProject?: { subject: string; id: string };
  merge?: { id: number; branch: string; head: string };
}
export async function appendCommit(
  db: D1Database,
  save: Save,
): Promise<{ id: string; createdAt: number } | { error: string; status: number }> {
  const { owner, branch, expected, message, merge } = save;
  const before = save.before ?? (expected ? await loadRows(db, owner, expected) : null);
  if (expected && !before) return { error: '変更元のコミットが見つかりません。', status: 409 };
  const next = projectRows(save.project);
  const id = crypto.randomUUID();
  const createdAt = Date.now();
  const changes = scoreTables.flatMap((table) =>
    revisionWrites(table, delta(table, before?.[table] ?? [], next[table])).map(
      ({ query, payload }) => db.prepare(query).bind(id, payload, id),
    ),
  );
  if (!changes.length && !merge) return { error: '譜面に変更がありません。', status: 409 };
  const seed = db
    .prepare(`INSERT INTO score_branches (owner, name)
    SELECT ?, 'main' WHERE ? = 'main' AND ? IS NULL ON CONFLICT DO NOTHING`)
    .bind(owner, branch, expected);
  const guard = merge
    ? `AND EXISTS (SELECT 1 FROM score_branches b JOIN score_pulls p
    ON p.owner = b.owner AND p.source = b.name WHERE b.owner = ? AND b.name = ? AND b.head = ?
    AND p.id = ? AND p.target = ? AND p.merged IS NULL)`
    : '';
  const insert =
    db.prepare(`INSERT INTO score_commits (id, owner, parent, merge_parent, message, created_at)
    SELECT ?, ?, ?, ?, ?, ? WHERE EXISTS (
      SELECT 1 FROM score_branches WHERE owner = ? AND name = ? AND head IS ?
    ) ${guard}`);
  const params = [
    id,
    owner,
    expected,
    merge?.head ?? null,
    message,
    createdAt,
    owner,
    branch,
    expected,
  ];
  const commit = merge
    ? insert.bind(...params, owner, merge.branch, merge.head, merge.id, branch)
    : insert.bind(...params);
  const update = db
    .prepare(`UPDATE score_branches SET head = ? WHERE owner = ? AND name = ?
    AND EXISTS (SELECT 1 FROM score_commits WHERE id = ?)`)
    .bind(id, owner, branch, id);
  const finish = merge
    ? [
        db
          .prepare(`UPDATE score_pulls SET merged = ? WHERE owner = ? AND id = ?
    AND EXISTS (SELECT 1 FROM score_commits WHERE id = ?)`)
          .bind(id, owner, merge.id, id),
      ]
    : [];
  const register = save.registerProject
    ? [
        db
          .prepare(`INSERT INTO score_projects
    (subject, id, owner, title, created_at) VALUES (?, ?, ?, ?, ?)`)
          .bind(
            save.registerProject.subject,
            save.registerProject.id,
            owner,
            save.project.title,
            Date.now(),
          ),
      ]
    : [];
  const title =
    branch === 'main' && save.project.title.trim()
      ? [
          db
            .prepare(`UPDATE score_projects SET title = ?
    WHERE owner = ? AND title <> ? AND EXISTS (SELECT 1 FROM score_commits WHERE id = ?)`)
            .bind(save.project.title, owner, save.project.title, id),
        ]
      : [];
  const results = await db.batch([
    ...register,
    seed,
    commit,
    ...changes,
    update,
    ...title,
    ...finish,
  ]);
  const result = results[register.length + 1];
  return result?.meta.changes
    ? { id, createdAt }
    : { error: 'ブランチが更新されています。最新の履歴を読み込んでください。', status: 409 };
}
