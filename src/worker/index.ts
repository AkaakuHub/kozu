import { createRemoteJWKSet, jwtVerify } from 'jose';
import { handlePreferences } from './preferences.ts';
import { referencesApi } from './references.ts';
import { historyApi } from './history/api.ts';
import { projectOwner, projectsApi } from './projects.ts';

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
    if (
      !['/api/history', '/api/preferences', '/api/progressions', '/api/projects'].includes(
        url.pathname,
      )
    )
      return response(404);
    const subject = import.meta.env.DEV ? 'local' : await authorize(request, env);
    if (!subject) return response(401);
    if (url.pathname === '/api/projects') return projectsApi(request, env.DB, subject);
    if (url.pathname === '/api/progressions') return referencesApi(request, env.DB, subject);
    if (url.pathname === '/api/history') {
      const owner = await projectOwner(env.DB, subject, url.searchParams.get('project'));
      return owner ? historyApi(request, env.DB, owner) : response(404);
    }
    return handlePreferences(request, env.DB, subject);
  },
} satisfies ExportedHandler<Env>;
