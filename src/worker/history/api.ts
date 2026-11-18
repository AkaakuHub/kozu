import { commonAncestor, mergeRows } from '../../core/history/revisions.ts';
import { rowsProject } from '../../core/history/score-rows.ts';
import { parseProjectValue } from '../../core/validate.ts';
import { appendCommit, loadRows, loadScore, readHistory } from './repository.ts';

const headers = { 'Cache-Control': 'no-store' };
const json = (value: unknown, status = 200) => Response.json(value, { status, headers });
const failure = (error: string, status: number) => json({ error }, status);
const name = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^[a-zA-Z0-9][a-zA-Z0-9_/-]{0,63}$/.test(value) &&
  !value.endsWith('/');
const revision = (value: unknown): value is string =>
  typeof value === 'string' && /^[0-9a-f-]{36}$/.test(value);
const summary = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0 && value.length <= 200;

export async function historyApi(request: Request, db: D1Database, owner: string) {
  const url = new URL(request.url);
  if (request.method === 'GET') {
    const id = url.searchParams.get('revision');
    if (!id) return json(await readHistory(db, owner));
    if (!revision(id)) return failure('コミットIDが不正です。', 400);
    const score = await loadScore(db, owner, id);
    return score ? json(score) : failure('コミットが見つかりません。', 404);
  }
  if (request.method !== 'POST') return failure('この操作には対応していません。', 405);
  if (request.headers.get('Origin') !== url.origin)
    return failure('異なるサイトから操作できません。', 403);
  // Bound decoding to 1/8 of the Workers 128 MiB memory limit. D1 writes are split independently.
  const limit = 16 * 1024 * 1024;
  const length = Number(request.headers.get('Content-Length'));
  if (!length || length > limit) return failure('1回の送信が16MiBの上限を超えています。', 413);
  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return failure('操作の形式が不正です。', 400);
  }
  if (!input || typeof input !== 'object' || !('op' in input))
    return failure('操作を指定してください。', 400);

  if (input.op === 'commit' || input.op === 'restore') {
    if (
      !('branch' in input && 'expected' in input && 'message' in input) ||
      !name(input.branch) ||
      !summary(input.message) ||
      !(input.expected === null || revision(input.expected))
    )
      return failure('ブランチ、親コミット、メッセージを確認してください。', 400);
    if (input.op === 'restore' && (!('from' in input) || !revision(input.from)))
      return failure('復元元のコミットを選択してください。', 400);
    let project;
    try {
      project =
        input.op === 'restore' && 'from' in input && revision(input.from)
          ? await loadScore(db, owner, input.from)
          : 'score' in input
            ? parseProjectValue(input.score)
            : null;
    } catch (error) {
      return failure(error instanceof Error ? error.message : '譜面の形式が不正です。', 422);
    }
    if (!project) return failure('対象の譜面が見つかりません。', 404);
    const result = await appendCommit(db, {
      owner,
      branch: input.branch,
      expected: input.expected,
      message: input.message.trim(),
      project,
    });
    return 'error' in result ? failure(result.error, result.status) : json(result, 201);
  }

  if (input.op === 'branch') {
    if (!('name' in input && 'from' in input) || !name(input.name) || !revision(input.from))
      return failure('ブランチ名と分岐元のコミットを確認してください。', 400);
    const result = await db
      .prepare(`INSERT INTO score_branches (owner, name, head)
      SELECT ?, ?, id FROM score_commits WHERE owner = ? AND id = ? ON CONFLICT DO NOTHING`)
      .bind(owner, input.name, owner, input.from)
      .run();
    return result.meta.changes
      ? json({ name: input.name }, 201)
      : failure('同名のブランチがあるか、分岐元が見つかりません。', 409);
  }

  if (input.op === 'pull') {
    if (
      !('source' in input && 'target' in input && 'title' in input) ||
      !name(input.source) ||
      !name(input.target) ||
      input.source === input.target ||
      !summary(input.title)
    )
      return failure('PRのブランチと件名を確認してください。', 400);
    const result = await db
      .prepare(`INSERT INTO score_pulls (owner, source, target, title)
      SELECT b.owner, b.name, t.name, ? FROM score_branches b
      JOIN score_branches t ON t.owner = b.owner
      WHERE b.owner = ? AND b.name = ? AND t.name = ?
        AND b.head IS NOT NULL AND t.head IS NOT NULL AND b.head <> t.head
      ON CONFLICT DO NOTHING RETURNING id`)
      .bind(input.title.trim(), owner, input.source, input.target)
      .first<{ id: number }>();
    return result
      ? json(result, 201)
      : failure('変更がある別ブランチを選択してください。既存のPRも確認してください。', 409);
  }

  if (input.op === 'merge') {
    if (
      !('pull' in input && 'source' in input && 'target' in input) ||
      typeof input.pull !== 'number' ||
      !Number.isSafeInteger(input.pull) ||
      !revision(input.source) ||
      !revision(input.target)
    )
      return failure('PRと確認済みのコミットを選択してください。', 400);
    const history = await readHistory(db, owner);
    const pull = history.pulls.find(
      (entry) => 'pull' in input && entry.id === input.pull && !entry.merged,
    );
    const source = history.branches.find((entry) => entry.name === pull?.source);
    const target = history.branches.find((entry) => entry.name === pull?.target);
    if (
      !pull ||
      !source?.head ||
      !target?.head ||
      source.head !== input.source ||
      target.head !== input.target
    )
      return failure('PRまたはブランチが更新されています。差分を確認し直してください。', 409);
    const base = commonAncestor(history.commits, source.head, target.head);
    if (!base) return failure('共通のコミットが見つかりません。', 409);
    if (base === source.head) return failure('この変更はすでに取り込まれています。', 409);
    const [ancestor, incoming, current] = await Promise.all(
      [base, source.head, target.head].map((id) => loadRows(db, owner, id)),
    );
    if (!ancestor || !incoming || !current) return failure('マージ元の譜面が見つかりません。', 409);
    const resolution =
      'resolve' in input && (input.resolve === 'source' || input.resolve === 'target')
        ? input.resolve
        : undefined;
    const { rows, conflicts } = mergeRows(ancestor, incoming, current, resolution);
    if (conflicts.length && !resolution)
      return json({ error: '同じ項目に変更があります。', conflicts }, 409);
    let project;
    try {
      project = rowsProject(rows);
    } catch (error) {
      return failure(error instanceof Error ? error.message : 'マージ結果の譜面が不正です。', 422);
    }
    const result = await appendCommit(db, {
      owner,
      branch: target.name,
      expected: target.head,
      message: pull.title,
      project,
      merge: { id: pull.id, branch: source.name, head: source.head },
    });
    return 'error' in result ? failure(result.error, result.status) : json(result, 201);
  }

  return failure('不明な操作です。', 400);
}
