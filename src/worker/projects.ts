import { createBlankProject } from '../core/presets.ts';
import type { ScoreProject } from '../core/score-projects.ts';
import { parseProjectValue } from '../core/validate.ts';
import { appendCommit, loadScore } from './history/repository.ts';

const headers = { 'Cache-Control': 'no-store' };
const json = (data: unknown, status = 200) => Response.json(data, { status, headers });

export async function projectOwner(db: D1Database, subject: string, id: string | null) {
  if (!id) return null;
  return db
    .prepare('SELECT owner FROM score_projects WHERE subject = ? AND id = ?')
    .bind(subject, id)
    .first<string>('owner');
}

export async function projectsApi(request: Request, db: D1Database, subject: string) {
  if (request.method === 'GET') {
    const { results } = await db
      .prepare(`SELECT p.id, p.title, b.head
      FROM score_projects p JOIN score_branches b ON b.owner = p.owner AND b.name = 'main'
      WHERE p.subject = ? AND b.head IS NOT NULL ORDER BY p.created_at DESC, p.id`)
      .bind(subject)
      .all<ScoreProject>();
    return json(results);
  }
  if (request.method !== 'POST') return json({ error: 'この操作には対応していません。' }, 405);
  if (request.headers.get('Origin') !== new URL(request.url).origin)
    return json({ error: '異なるサイトから操作できません。' }, 403);
  const length = Number(request.headers.get('Content-Length'));
  if (length <= 0 || length > 16 * 1024 * 1024)
    return json({ error: '譜面のサイズを確認してください。' }, 413);
  let project;
  let id;
  try {
    const input: unknown = await request.json();
    if (
      typeof input !== 'object' ||
      input === null ||
      !('id' in input) ||
      typeof input.id !== 'string' ||
      !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(input.id) ||
      !('title' in input) ||
      typeof input.title !== 'string'
    )
      throw new Error('プロジェクト名を入力してください。');
    id = input.id;
    const title = input.title.trim();
    if (!title || title.length > 200)
      throw new Error('プロジェクト名は1〜200文字で入力してください。');
    if ('score' in input) project = parseProjectValue(input.score);
    else {
      const section =
        'section' in input && typeof input.section === 'string' ? input.section.trim() : '';
      if (!section || section.length > 200)
        throw new Error('最初のセクション名は1〜200文字で入力してください。');
      project = createBlankProject();
      project.sections[0]!.name = section;
      project.sections[0]!.role = section;
    }
    project.title = title;
  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : '譜面を確認してください。' },
      422,
    );
  }
  const existing = async () => {
    const saved = await db
      .prepare(`SELECT p.owner, p.title, b.head FROM score_projects p
      JOIN score_branches b ON b.owner = p.owner AND b.name = 'main'
      WHERE p.subject = ? AND p.id = ? AND b.head IS NOT NULL`)
      .bind(subject, id)
      .first<{ owner: string; title: string; head: string }>();
    if (!saved) return null;
    const loaded = await loadScore(db, saved.owner, saved.head);
    return loaded ? json({ id, title: saved.title, head: saved.head, project: loaded }) : null;
  };
  const previous = await existing();
  if (previous) return previous;
  let result;
  try {
    result = await appendCommit(db, {
      owner: crypto.randomUUID(),
      branch: 'main',
      expected: null,
      message: '初版',
      project,
      registerProject: { subject, id },
    });
  } catch (error) {
    const saved = await existing();
    if (saved) return saved;
    throw error;
  }
  if ('error' in result) {
    return json({ error: result.error }, result.status);
  }
  return json({ id, title: project.title, head: result.id, project }, 201);
}
