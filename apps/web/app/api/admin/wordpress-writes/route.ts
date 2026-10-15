import { NextRequest, NextResponse } from 'next/server';
import { currentUser, db, sameOrigin } from '../../../../lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

export async function GET(req: NextRequest) {
  const actor = await currentUser(req);
  if (actor?.role !== 'ADMIN') return fail('forbidden', 403);
  const projects = await db.project.findMany({ select: { id: true, baseUrl: true }, orderBy: { baseUrl: 'asc' }, take: 200 });
  const policies = await db.wordPressWritePolicy.findMany({ where: { projectId: { in: projects.map(p => p.id) } } });
  const byProject = new Map(policies.map(p => [p.projectId, p]));
  return NextResponse.json({ projects: projects.map(p => ({ ...p, enabled: byProject.get(p.id)?.enabled === true })), infrastructureEnabled: true }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function PATCH(req: NextRequest) {
  if (!sameOrigin(req)) return fail('invalid_origin', 403);
  const actor = await currentUser(req);
  if (actor?.role !== 'ADMIN') return fail('forbidden', 403);
  let data: unknown;
  try { data = await req.json(); } catch { return fail('invalid_json', 400); }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return fail('invalid_request', 400);
  const { projectId, enabled } = data as Record<string, unknown>;
  if (typeof projectId !== 'string' || projectId.length > 128 || typeof enabled !== 'boolean') return fail('invalid_policy', 400);
  const project = await db.project.findUnique({ where: { id: projectId }, select: { id: true } });
  if (!project) return fail('project_not_found', 404);
  await db.$transaction(async tx => {
    await tx.wordPressWritePolicy.upsert({ where: { projectId }, create: { projectId, enabled, updatedById: actor.id }, update: { enabled, updatedById: actor.id } });
    await tx.dashboardAdminEvent.create({ data: { actorId: actor.id, action: 'wordpress.write_policy.updated', targetId: projectId, details: { enabled } } });
  });
  return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
}
