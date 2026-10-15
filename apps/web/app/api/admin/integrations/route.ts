import { NextRequest, NextResponse } from 'next/server';
import { currentUser, db, sameOrigin } from '../../../../lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

export async function GET(req: NextRequest) {
  const actor = await currentUser(req);
  if (actor?.role !== 'ADMIN') return fail('forbidden', 403);
  const projects = await db.project.findMany({ select: { id: true, baseUrl: true, name: true }, orderBy: { baseUrl: 'asc' }, take: 200 });
  const mappings = await db.projectIntegration.findMany({ where: { projectId: { in: projects.map(p => p.id) } } });
  const byId = new Map(mappings.map(m => [m.projectId, m]));
  const credentials = await db.wordPressCredential.findMany({ where: { projectId: { in: projects.map(p => p.id) } }, select: { projectId: true } });
  const credentialIds = new Set(credentials.map(c => c.projectId));
  const googleCredentials = await db.googleCredential.findMany({ where: { projectId: { in: projects.map(p => p.id) } }, select: { projectId: true, accountEmail: true } });
  const googleById = new Map(googleCredentials.map(c => [c.projectId, c.accountEmail]));
  return NextResponse.json({
    projects: projects.map(p => ({ ...p, wordpressEnabled: byId.get(p.id)?.wordpressEnabled ?? false, wordpressCredentialsConfigured: credentialIds.has(p.id), googleCredentialsConfigured: googleById.has(p.id), googleAccountEmail: googleById.get(p.id) ?? null, wordpressSiteUrl: byId.get(p.id)?.wordpressSiteUrl ?? '', searchConsoleSiteUrl: byId.get(p.id)?.searchConsoleSiteUrl ?? '', ga4PropertyId: byId.get(p.id)?.ga4PropertyId ?? '' })),
    safeguards: { wordpress: true, google: true, googleCredentials: null, wordpressCredentials: null },
  }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function PATCH(req: NextRequest) {
  if (!sameOrigin(req)) return fail('invalid_origin', 403);
  const actor = await currentUser(req);
  if (actor?.role !== 'ADMIN') return fail('forbidden', 403);
  let raw: unknown;
  try { raw = await req.json(); } catch { return fail('invalid_json', 400); }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return fail('invalid_request', 400);
  const { projectId, wordpressEnabled, wordpressSiteUrl, searchConsoleSiteUrl, ga4PropertyId } = raw as Record<string, unknown>;
  if (typeof projectId !== 'string' || !projectId.trim() || projectId.length > 128 || typeof wordpressEnabled !== 'boolean') return fail('invalid_mapping', 400);
  // Optional inputs may be omitted or null; do not reject an entire form for an empty optional field.
  const optional = [wordpressSiteUrl, searchConsoleSiteUrl, ga4PropertyId];
  if (optional.some(v => v != null && (typeof v !== 'string' || v.length > 512))) return fail('invalid_mapping', 400);
  const wpInput = typeof wordpressSiteUrl === 'string' ? wordpressSiteUrl.trim() : '';
  const sc = typeof searchConsoleSiteUrl === 'string' ? searchConsoleSiteUrl.trim() : '';
  const ga = typeof ga4PropertyId === 'string' ? ga4PropertyId.trim() : '';
  const project = await db.project.findUnique({ where: { id: projectId }, select: { baseUrl: true } });
  if (!project) return fail('project_not_found', 404);
  // Default discovery to the project's canonical origin; keep same-origin SSRF protection.
  let wp = wpInput;
  if (wordpressEnabled && !wp) wp = new URL('/', project.baseUrl).href;
  if (wp) {
    try {
      const origin = new URL(project.baseUrl); const site = new URL(wp);
      if (site.protocol !== 'https:' || site.origin !== origin.origin || site.pathname !== '/' || site.search || site.hash || site.username || site.password) return fail('wordpress_origin_mismatch', 400);
    } catch { return fail('invalid_wordpress_url', 400); }
  }
  if (sc && !(sc.startsWith('sc-domain:') && /^sc-domain:[a-z0-9.-]+$/i.test(sc) || (() => { try { const u = new URL(sc); return u.protocol === 'https:' && !u.username && !u.password && !u.hash; } catch { return false; } })())) return fail('invalid_search_console_property', 400);
  if (ga && !/^\d{1,30}$/.test(ga)) return fail('invalid_ga4_property_id', 400);
  const data = { wordpressEnabled, wordpressSiteUrl: wp || null, searchConsoleSiteUrl: sc || null, ga4PropertyId: ga || null, updatedById: actor.id };
  await db.$transaction(async tx => {
    await tx.projectIntegration.upsert({ where: { projectId }, create: { projectId, ...data }, update: data });
    await tx.dashboardAdminEvent.create({ data: { actorId: actor.id, action: 'integration.mapping.updated', targetId: projectId, details: { wordpressEnabled, wordpressSiteUrl: wp || null, searchConsoleSiteUrl: sc || null, ga4PropertyId: ga || null } } });
  });
  return NextResponse.json({ ok: true });
}
