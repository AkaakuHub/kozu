import { createRemoteJWKSet, jwtVerify } from 'jose';
import { handlePreferences } from './preferences.ts';
import { referencesApi } from './references.ts';
import { historyApi } from './history/api.ts';

const keys = new Map<string, ReturnType<typeof createRemoteJWKSet>>();
const headers = { 'Cache-Control': 'no-store' };
const response = (status: number) => new Response(null, { status, headers });

async function authorize(request: Request, env: Env) {
  const token = request.headers.get('Cf-Access-Jwt-Assertion');
  if (!token) return null;
  const issuer = env.ACCESS_ISSUER;
  const jwks = keys.get(issuer) ?? createRemoteJWKSet(new URL('/cdn-cgi/access/certs', issuer));
  keys.set(issuer, jwks);
  try {
    const { payload } = await jwtVerify(token, jwks, {
      issuer,
      audience: env.ACCESS_AUD,
      algorithms: ['RS256'],
    });
    return payload.type === 'app' && typeof payload.email === 'string' && payload.sub
      ? payload.sub
      : null;
  } catch {
    return null;
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!['/api/history', '/api/preferences', '/api/progressions'].includes(url.pathname))
      return response(404);
    const subject = import.meta.env.DEV ? 'local' : await authorize(request, env);
    if (!subject) return response(401);
    if (url.pathname === '/api/progressions') return referencesApi(request, env.DB, subject);
    return url.pathname === '/api/history'
      ? historyApi(request, env.DB, subject)
      : handlePreferences(request, env.DB, subject);
  },
} satisfies ExportedHandler<Env>;
