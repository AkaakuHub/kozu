import { loadScore } from './history/repository.ts';
import type { ProgressionReference } from '../core/progression-library.ts';

const headers = { 'Cache-Control': 'no-store' };
const json = (value: unknown, status = 200) => Response.json(value, { status, headers });
const short = (value: unknown): value is string => typeof value === 'string' && value.length <= 200;

export async function referencesApi(request: Request, db: D1Database, owner: string) {
  if (request.method === 'GET') {
    const { results } = await db
      .prepare(`SELECT id, revision, section_id, title, artist, source, note
      FROM score_references WHERE owner = ? ORDER BY title, id`)
      .bind(owner)
      .all<ProgressionReference>();
    return json(results);
  }
  if (request.headers.get('Origin') !== new URL(request.url).origin)
    return json({ error: '異なるサイトから操作できません。' }, 403);
  if (request.method === 'DELETE') {
    const id = new URL(request.url).searchParams.get('id');
    if (!id) return json({ error: '登録を選択してください。' }, 400);
    const removed = await db
      .prepare('DELETE FROM score_references WHERE owner = ? AND id = ?')
      .bind(owner, id)
      .run();
    return removed.meta.changes ? json({ id }) : json({ error: '登録が見つかりません。' }, 404);
  }
  if (request.method !== 'POST') return json({ error: 'この操作には対応していません。' }, 405);
  const size = Number(request.headers.get('Content-Length'));
  if (!size || size > 20_000) return json({ error: '入力が長すぎます。' }, 413);
  let value: unknown;
  try {
    value = await request.json();
  } catch {
    return json({ error: '入力を確認してください。' }, 400);
  }
  if (
    !value ||
    typeof value !== 'object' ||
    !(
      'revision' in value &&
      'section_id' in value &&
      'title' in value &&
      'artist' in value &&
      'source' in value &&
      'note' in value
    ) ||
    !short(value.revision) ||
    !short(value.section_id) ||
    !short(value.title) ||
    !value.title.trim() ||
    !short(value.artist) ||
    typeof value.source !== 'string' ||
    value.source.length > 2048 ||
    typeof value.note !== 'string' ||
    value.note.length > 1500
  )
    return json({ error: '題名と各項目の長さを確認してください。' }, 400);
  if (value.source) {
    try {
      if (!['http:', 'https:'].includes(new URL(value.source).protocol)) throw new Error();
    } catch {
      return json({ error: '参照元にはhttpまたはhttpsのURLを入力してください。' }, 400);
    }
  }
  const saved = await loadScore(db, owner, value.revision);
  const section = saved?.sections.find(
    (item) => 'section_id' in value && item.id === value.section_id,
  );
  if (!section?.chords.length)
    return json({ error: 'コード進行が含まれるパートを先にコミットしてください。' }, 409);
  const id = crypto.randomUUID();
  const result = await db
    .prepare(`INSERT INTO score_references (owner, id, revision, section_id, title, artist, source, note)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT DO NOTHING`)
    .bind(
      owner,
      id,
      value.revision,
      value.section_id,
      value.title.trim(),
      value.artist.trim(),
      value.source,
      value.note.trim(),
    )
    .run();
  return result.meta.changes
    ? json({ id }, 201)
    : json({ error: 'このコミットのパートはすでに登録されています。' }, 409);
}
