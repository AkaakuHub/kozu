import { parsePreferences } from '../core/preferences.ts';

export async function handlePreferences(request: Request, db: D1Database, subject: string) {
  const headers = { 'Cache-Control': 'no-store' };
  if (request.method === 'GET') {
    const saved = await db
      .prepare('SELECT settings FROM preferences WHERE subject = ?')
      .bind(subject)
      .first<string>('settings');
    return new Response(saved ?? '{}', {
      headers: { ...headers, 'Content-Type': 'application/json' },
    });
  }
  if (request.method !== 'PATCH') return new Response(null, { status: 405, headers });
  if (request.headers.get('Origin') !== new URL(request.url).origin)
    return new Response(null, { status: 403, headers });
  const length = Number(request.headers.get('Content-Length'));
  if (!length || length > 512) return new Response(null, { status: 413, headers });
  try {
    const settings = parsePreferences(await request.json());
    await db
      .prepare(`INSERT INTO preferences (subject, settings) VALUES (?, ?)
      ON CONFLICT (subject) DO UPDATE SET settings = json_patch(preferences.settings, excluded.settings)`)
      .bind(subject, JSON.stringify(settings))
      .run();
    return new Response(null, { status: 204, headers });
  } catch {
    return new Response(null, { status: 400, headers });
  }
}
