import { NextRequest, NextResponse } from 'next/server';
import { currentUser, db } from '../../../../../lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const API = process.env.API_INTERNAL_URL ?? 'http://localhost:4000';
const kinds = ['wordpress', 'wordpress-auth', 'search-console', 'analytics'] as const;
type Kind = (typeof kinds)[number];

// All requests go to the fixed internal API, never to a URL supplied by the browser.
// Only administrators can trigger outbound integration probes.
export async function GET(req: NextRequest) {
  const actor = await currentUser(req);
  if (actor?.role !== 'ADMIN') return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const projectId = req.nextUrl.searchParams.get('projectId');
  const kind = req.nextUrl.searchParams.get('kind');
  if (!projectId || !/^[a-zA-Z0-9_-]{8,64}$/.test(projectId) || !kinds.includes(kind as Kind))
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  const project = await db.project.findUnique({ where: { id: projectId }, select: { id: true } });
  if (!project) return NextResponse.json({ error: 'project_not_found' }, { status: 404 });

  const endpoint =
    kind === 'wordpress-auth'
      ? `/api/v1/projects/${projectId}/wordpress/connection`
      : kind === 'wordpress'
      ? `/api/v1/projects/${projectId}/wordpress/status`
      : `/api/v1/projects/${projectId}/google/${kind}`;
  const target = new URL(endpoint, API);
  if (kind !== 'wordpress') {
    // Google reports use completed days; querying real data tests token, permissions and property.
    const yesterday = new Date(Date.now() - 86400000);
    const weekAgo = new Date(Date.now() - 8 * 86400000);
    target.searchParams.set('startDate', weekAgo.toISOString().slice(0, 10));
    target.searchParams.set('endDate', yesterday.toISOString().slice(0, 10));
  }
  try {
    const response = await fetch(target, { cache: 'no-store', signal: AbortSignal.timeout(35000) });
    const payload: unknown = await response.json().catch(() => null);
    const result =
      payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};
    if (kind === 'wordpress-auth') {
      return NextResponse.json({ kind, ok: response.ok && result.authenticated === true,
        message: result.authenticated === true ? 'Authenticated WordPress REST access verified' : String(result.reason ?? 'WordPress authentication failed') },
        { headers: { 'Cache-Control': 'no-store' } });
    }
    if (kind === 'wordpress') {
      return NextResponse.json(
        {
          kind,
          ok: response.ok && result.enabled === true && result.restApi === true,
          enabled: result.enabled === true,
          restApi: result.restApi === true,
          wordpress: result.wordpress === true,
          wooCommerce: result.wooCommerce === true,
          message:
            result.enabled !== true
              ? 'Discovery is disabled for this project'
              : result.restApi !== true
                ? String(result.error ?? 'WordPress REST API unavailable')
                : 'WordPress REST API responded successfully (public, read-only)',
        },
        { headers: { 'Cache-Control': 'no-store' } },
      );
    }
    return NextResponse.json(
      {
        kind,
        ok: response.ok,
        message: response.ok
          ? 'Google API query succeeded; service account has access to this property'
          : String(result.error ?? `Google API returned HTTP ${response.status}`),
        status: response.status,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch {
    return NextResponse.json(
      { kind, ok: false, message: 'Internal API unavailable or connection timed out' },
      { status: 502 },
    );
  }
}
