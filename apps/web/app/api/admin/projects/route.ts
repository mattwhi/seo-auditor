import { NextRequest, NextResponse } from 'next/server';
import { currentUser, db, sameOrigin } from '../../../../lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function DELETE(req: NextRequest) {
  if (!sameOrigin(req)) return NextResponse.json({ error: 'invalid_origin' }, { status: 403 });
  const actor = await currentUser(req);
  if (actor?.role !== 'ADMIN') return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  const { projectId, confirmName } = body as Record<string, unknown>;
  if (typeof projectId !== 'string' || projectId.length > 128 || typeof confirmName !== 'string')
    return NextResponse.json({ error: 'invalid_confirmation' }, { status: 400 });
  const project = await db.project.findUnique({ where: { id: projectId }, select: { name: true } });
  if (!project) return NextResponse.json({ error: 'project_not_found' }, { status: 404 });
  if (confirmName !== project.name) return NextResponse.json({ error: 'confirmation_does_not_match' }, { status: 400 });
  const active = await db.audit.count({ where: { projectId, status: { in: ['queued', 'running', 'crawling', 'analysing'] } } });
  if (active) return NextResponse.json({ error: 'project_has_active_audits_cancel_first' }, { status: 409 });
  // Unrelated project-scoped tables have no Prisma foreign key to Project.
  // Clean those up in the same transaction before deleting the cascaded audit records.
  await db.$transaction(async (tx) => {
    const audits = await tx.audit.findMany({ where: { projectId }, select: { id: true } });
    const auditIds = audits.map((audit) => audit.id);
    const proposals = await tx.remediationProposal.findMany({ where: { projectId }, select: { id: true } });
    const proposalIds = proposals.map((proposal) => proposal.id);
    await tx.remediationPreflight.deleteMany({ where: { proposalId: { in: proposalIds } } });
    await tx.remediationExecution.deleteMany({ where: { projectId } });
    await tx.remediationProposal.deleteMany({ where: { projectId } });
    await tx.wordPressWritePolicy.deleteMany({ where: { projectId } });
    await tx.wordPressCredential.deleteMany({ where: { projectId } });
    await tx.googleCredential.deleteMany({ where: { projectId } });
    // Preserve administrator activity logs, which are not foreign-keyed to projects.
    await tx.project.delete({ where: { id: projectId } });
    await tx.dashboardAdminEvent.create({ data: { actorId: actor.id, action: 'project.deleted', targetId: projectId, details: { name: project.name, auditCount: auditIds.length } } });
  });
  return NextResponse.json({ ok: true });
}
