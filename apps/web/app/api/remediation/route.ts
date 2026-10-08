import { NextRequest, NextResponse } from 'next/server';
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const API = process.env.API_INTERNAL_URL ?? 'http://localhost:4000';
const COOKIE = 'seo_remediation_session';
const SESSION_SECONDS = 60 * 60 * 4;
const attempts = new Map<string, { count: number; until: number }>();
const configured = () => Boolean(process.env.REMEDIATION_UI_PASSWORD && process.env.REMEDIATION_UI_PASSWORD.length >= 16 && process.env.REMEDIATION_UI_SESSION_SECRET && process.env.REMEDIATION_UI_SESSION_SECRET.length >= 48 && process.env.REMEDIATION_OPERATOR_TOKEN && process.env.REMEDIATION_OPERATOR_TOKEN.length >= 32);
const eq = (a: string, b: string) => { const aa = Buffer.from(a), bb = Buffer.from(b); return aa.length === bb.length && timingSafeEqual(aa, bb); };
function signature(payload: string) { return createHmac('sha256', process.env.REMEDIATION_UI_SESSION_SECRET ?? '').update(payload).digest('hex'); }
function valid(req: NextRequest) {
  if (!configured()) return false;
  const cookie = req.cookies.get(COOKIE)?.value ?? '';
  const [timestamp, nonce, mac] = cookie.split('.');
  if (!timestamp || !nonce || !mac || !/^\d+$/.test(timestamp) || !/^[a-f0-9]{32}$/.test(nonce)) return false;
  const ts = Number(timestamp);
  return ts <= Date.now() && Date.now() - ts < SESSION_SECONDS * 1000 && eq(mac, signature(`${timestamp}.${nonce}`));
}
function session() {
  const payload = `${Date.now()}.${randomBytes(16).toString('hex')}`;
  return `${payload}.${signature(payload)}`;
}
function error(message: string, status: number) { return NextResponse.json({ error: message }, { status, headers: { 'Cache-Control': 'no-store' } }); }
function originAllowed(req: NextRequest) {
  const origin = req.headers.get('origin');
  const host = req.headers.get('host');
  if (!origin || !host) return false;
  try { return new URL(origin).host === host && ['http:', 'https:'].includes(new URL(origin).protocol); } catch { return false; }
}
async function upstream(method: 'GET' | 'POST', endpoint: string, body?: unknown, execution = false) {
  const token = execution ? process.env.REMEDIATION_EXECUTION_TOKEN : process.env.REMEDIATION_OPERATOR_TOKEN;
  if (!token) return error(execution ? 'execution_token_not_configured' : 'operator_token_not_configured', 503);
  const response = await fetch(new URL(endpoint, API), {
    method, cache: 'no-store', signal: AbortSignal.timeout(20000),
    headers: { authorization: `Bearer ${token}`, ...(body ? { 'content-type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return new NextResponse(await response.text(), { status: response.status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
}
const projectId = (s: unknown) => typeof s === 'string' && /^[a-zA-Z0-9_-]{8,64}$/.test(s);
const objectId = (s: unknown) => typeof s === 'string' && /^[a-zA-Z0-9_-]{8,64}$/.test(s);
export async function GET(req: NextRequest) {
  const action = req.nextUrl.searchParams.get('action');
  if (action === 'session') return NextResponse.json({ configured: configured(), authenticated: valid(req), executionConfigured: Boolean(process.env.REMEDIATION_EXECUTION_TOKEN) }, { headers: { 'Cache-Control': 'no-store' } });
  if (!valid(req)) return error('login_required', 401);
  const project = req.nextUrl.searchParams.get('projectId');
  const proposal = req.nextUrl.searchParams.get('proposalId');
  if (action === 'proposals' && projectId(project)) return upstream('GET', `/api/v1/projects/${project}/wordpress/proposals`);
  if (action === 'preflights' && objectId(proposal)) return upstream('GET', `/api/v1/wordpress/proposals/${proposal}/preflights`);
  if (action === 'execution' && objectId(proposal)) return upstream('GET', `/api/v1/wordpress/proposals/${proposal}/execution`);
  return error('invalid_request', 400);
}
export async function POST(req: NextRequest) {
  if (!originAllowed(req) || req.headers.get('x-remediation-intent') !== '1') return error('csrf_check_failed', 403);
  let data: Record<string, unknown>;
  try { data = await req.json(); if (!data || typeof data !== 'object' || Array.isArray(data)) throw Error(); } catch { return error('invalid_json', 400); }
  const action = data.action;
  if (action === 'login') {
    if (!configured()) return error('ui_not_configured', 503);
    const key = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const now = Date.now(); const entry = attempts.get(key);
    if (entry && entry.until > now && entry.count >= 5) return error('too_many_attempts', 429);
    const supplied = typeof data.password === 'string' ? data.password : '';
    const expected = process.env.REMEDIATION_UI_PASSWORD ?? '';
    const salt = process.env.REMEDIATION_UI_SESSION_SECRET ?? '';
    const good = supplied.length <= 1024 && timingSafeEqual(scryptSync(supplied, salt, 32), scryptSync(expected, salt, 32));
    if (!good) { attempts.set(key, { count: (entry?.until ?? 0) > now ? entry!.count + 1 : 1, until: now + 15 * 60 * 1000 }); return error('invalid_credentials', 401); }
    attempts.delete(key);
    const res = NextResponse.json({ authenticated: true });
    res.cookies.set(COOKIE, session(), { httpOnly: true, secure: req.nextUrl.protocol === 'https:', sameSite: 'strict', path: '/api/remediation', maxAge: SESSION_SECONDS });
    return res;
  }
  if (action === 'logout') { const res = NextResponse.json({ authenticated: false }); res.cookies.set(COOKIE, '', { httpOnly: true, sameSite: 'strict', path: '/api/remediation', maxAge: 0 }); return res; }
  if (!valid(req)) return error('login_required', 401);
  const project = data.projectId, proposal = data.proposalId;
  if (action === 'create' && projectId(project)) {
    const body = data.payload;
    if (!body || typeof body !== 'object' || Array.isArray(body)) return error('invalid_proposal', 400);
    return upstream('POST', `/api/v1/projects/${project}/wordpress/proposals`, body);
  }
  if (objectId(proposal)) {
    if (action === 'approve' || action === 'reject' || action === 'preflight') return upstream('POST', `/api/v1/wordpress/proposals/${proposal}/${action}`);
    if (action === 'execute' && objectId(data.preflightId) && data.confirm === 'EXECUTE_APPROVED_REMEDIATION') return upstream('POST', `/api/v1/wordpress/proposals/${proposal}/execute`, { preflightId: data.preflightId, confirm: data.confirm }, true);
    if (action === 'rollback' && data.confirm === 'ROLLBACK_REMEDIATION') return upstream('POST', `/api/v1/wordpress/proposals/${proposal}/rollback`, { confirm: data.confirm }, true);
  }
  return error('invalid_request', 400);
}
