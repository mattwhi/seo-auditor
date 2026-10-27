import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db, currentUser, sameOrigin, canMutate } from '../../../../lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const projectInput = z.string().min(1).max(128);
const competitorInput = z.object({
  projectId: projectInput,
  domain: z.string().trim().min(3).max(253),
  label: z.string().trim().max(120).optional(),
});
function canonicalDomain(input: string): string | null {
  try {
    const url = new URL(input.includes('://') ? input : `https://${input}`);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.port || url.pathname !== '/' || url.search || url.hash) return null;
    const host = url.hostname.toLowerCase().replace(/\.$/, '');
    if (host.length > 253 || !host.includes('.') || !/^[a-z0-9.-]+$/.test(host) || host.split('.').some(part => !part || part.length > 63 || part.startsWith('-') || part.endsWith('-'))) return null;
    return host;
  } catch { return null; }
}
async function projectExists(id: string) { return db.project.findUnique({ where: { id }, select: { id: true, baseUrl: true, name: true } }); }
export async function GET(request: NextRequest) {
  if (!await currentUser(request)) return NextResponse.json({ error: 'login_required' }, { status: 401 });
  const parsed = projectInput.safeParse(request.nextUrl.searchParams.get('projectId'));
  if (!parsed.success) return NextResponse.json({ error: 'invalid_project' }, { status: 400 });
  const project = await projectExists(parsed.data);
  if (!project) return NextResponse.json({ error: 'project_not_found' }, { status: 404 });
  const competitors = await db.intelligenceCompetitor.findMany({ where: { projectId: parsed.data }, orderBy: { createdAt: 'asc' }, select: { id: true, domain: true, label: true, createdAt: true } });
  return NextResponse.json({ project, competitors }, { headers: { 'Cache-Control': 'no-store' } });
}
export async function POST(request: NextRequest) {
  const user = await currentUser(request);
  if (!user) return NextResponse.json({ error: 'login_required' }, { status: 401 });
  if (!sameOrigin(request) || !canMutate(user.role)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const raw = await request.json().catch(() => null);
  const parsed = competitorInput.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: 'invalid_competitor' }, { status: 400 });
  const domain = canonicalDomain(parsed.data.domain);
  if (!domain) return NextResponse.json({ error: 'invalid_domain' }, { status: 400 });
  const project = await projectExists(parsed.data.projectId);
  if (!project) return NextResponse.json({ error: 'project_not_found' }, { status: 404 });
  const ownDomain = canonicalDomain(project.baseUrl);
  if (domain === ownDomain || (ownDomain && domain.replace(/^www\./, '') === ownDomain.replace(/^www\./, ''))) return NextResponse.json({ error: 'own_domain' }, { status: 400 });
  const count = await db.intelligenceCompetitor.count({ where: { projectId: project.id } });
  if (count >= 20) return NextResponse.json({ error: 'competitor_limit_reached' }, { status: 409 });
  try {
    const competitor = await db.intelligenceCompetitor.create({ data: { projectId: project.id, domain, label: parsed.data.label || null }, select: { id: true, domain: true, label: true, createdAt: true } });
    return NextResponse.json({ competitor }, { status: 201 });
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') return NextResponse.json({ error: 'competitor_exists' }, { status: 409 });
    throw error;
  }
}
export async function DELETE(request: NextRequest) {
  const user = await currentUser(request);
  if (!user) return NextResponse.json({ error: 'login_required' }, { status: 401 });
  if (!sameOrigin(request) || !canMutate(user.role)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const raw = await request.json().catch(() => null);
  const parsed = z.object({ projectId: projectInput, id: z.string().min(1).max(128) }).safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  const result = await db.intelligenceCompetitor.deleteMany({ where: { id: parsed.data.id, projectId: parsed.data.projectId } });
  if (!result.count) return NextResponse.json({ error: 'competitor_not_found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
