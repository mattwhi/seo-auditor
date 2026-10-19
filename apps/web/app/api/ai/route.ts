import { NextRequest, NextResponse } from 'next/server';
import { currentUser, sameOrigin, SESSION_COOKIE } from '../../../lib/auth';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const base = process.env.API_INTERNAL_URL ?? 'http://localhost:4000';
const id = (v: unknown): v is string => typeof v === 'string' && /^[a-zA-Z0-9_-]{8,64}$/.test(v);
async function handler(req: NextRequest) {
  const user = await currentUser(req);
  if (!user || user.role !== 'ADMIN') return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  if (req.method !== 'GET' && !sameOrigin(req)) return NextResponse.json({ error: 'invalid_origin' }, { status: 403 });
  const projectId = req.nextUrl.searchParams.get('projectId');
  if (!id(projectId)) return NextResponse.json({ error: 'invalid_project' }, { status: 400 });
  const action = req.nextUrl.searchParams.get('action');
  const routes: Record<string, string> = { settings: 'settings', analyses: 'analyses', analyse: 'analyse', reviews: 'reviews', review: 'reviews', proposal: 'reviews', suggestFix: 'suggest-fix', issueContext: 'issue-context' };
  if (!action || !routes[action]) return NextResponse.json({ error: 'invalid_action' }, { status: 400 });
  if ((action === 'proposal' && req.method !== 'POST') || (action === 'review' && req.method !== 'PATCH') || (action === 'reviews' && req.method !== 'GET') || (action === 'analyse' && req.method !== 'POST') || (action === 'suggestFix' && req.method !== 'POST') || (action === 'issueContext' && req.method !== 'GET') || (action === 'settings' && !['GET','PUT'].includes(req.method)) || (action === 'analyses' && req.method !== 'GET')) return NextResponse.json({ error: 'method_not_allowed' }, { status: 405 });
  const url = new URL(`/api/v1/projects/${projectId}/ai/${routes[action]}`, base);
  if (action === 'review' || action === 'proposal') {
    const reviewId = req.nextUrl.searchParams.get('reviewId');
    if (!id(reviewId)) return NextResponse.json({ error: 'invalid_review' }, { status: 400 });
    url.pathname += `/${reviewId}${action === 'proposal' ? '/proposal' : ''}`;
  }
  if (action === 'issueContext') {
    const issueId = req.nextUrl.searchParams.get('issueId'), contextAuditId = req.nextUrl.searchParams.get('auditId');
    if (!id(issueId) || !id(contextAuditId)) return NextResponse.json({error:'invalid_issue_context'}, {status:400});
    url.searchParams.set('issueId', issueId); url.searchParams.set('auditId', contextAuditId);
  }
  const analysisId = req.nextUrl.searchParams.get('analysisId');
  if (action === 'reviews' && id(analysisId)) url.searchParams.set('analysisId', analysisId);
  const auditId = req.nextUrl.searchParams.get('auditId');
  if (action === 'analyses' && id(auditId)) url.searchParams.set('auditId', auditId);
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return NextResponse.json({ error: 'authentication_required' }, { status: 401 });
  try {
    const upstream = await fetch(url, { method: req.method, cache: 'no-store', signal: AbortSignal.timeout(40000),
      headers: { authorization: `Bearer ${token}`, ...(req.method !== 'GET' ? { 'content-type': 'application/json' } : {}) },
      body: req.method === 'GET' ? undefined : await req.text() });
    return new NextResponse(await upstream.text(), { status: upstream.status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
  } catch { return NextResponse.json({ error: 'ai_service_unavailable' }, { status: 502 }); }
}
export const GET = handler;
export const PUT = handler;
export const POST = handler;

export const PATCH = handler;
