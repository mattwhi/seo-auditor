import { NextRequest, NextResponse } from 'next/server';
import { currentUser, db, ROLES, sameOrigin } from '../../../../lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const fail = (error: string, status: number) => NextResponse.json({ error }, { status, headers: { 'Cache-Control': 'no-store' } });

export async function GET(req: NextRequest) {
  const actor = await currentUser(req);
  if (actor?.role !== 'ADMIN') return fail('forbidden', 403);
  const [users, invitations, events] = await Promise.all([
    db.dashboardUser.findMany({ select: { id: true, email: true, role: true, disabled: true, createdAt: true }, orderBy: { createdAt: 'asc' }, take: 200 }),
    db.dashboardInvitation.findMany({ select: { id: true, email: true, role: true, expiresAt: true, acceptedAt: true, revokedAt: true, createdAt: true }, orderBy: { createdAt: 'desc' }, take: 100 }),
    db.dashboardAdminEvent.findMany({ select: { id: true, action: true, targetId: true, createdAt: true, actor: { select: { email: true } } }, orderBy: { createdAt: 'desc' }, take: 100 }),
  ]);
  return NextResponse.json({ users, invitations, events }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function PATCH(req: NextRequest) {
  if (!sameOrigin(req)) return fail('invalid_origin', 403);
  const actor = await currentUser(req);
  if (actor?.role !== 'ADMIN') return fail('forbidden', 403);
  let data: Record<string, unknown>;
  try { data = await req.json(); if (!data || typeof data !== 'object' || Array.isArray(data)) throw Error(); }
  catch { return fail('invalid_json', 400); }
  const id = typeof data.id === 'string' ? data.id : '';
  const action = data.action;
  if (!id || id.length > 128) return fail('invalid_id', 400);
  if (action === 'revoke_invitation') {
    const changed = await db.$transaction(async (tx) => {
      const updated = await tx.dashboardInvitation.updateMany({ where: { id, acceptedAt: null, revokedAt: null }, data: { revokedAt: new Date() } });
      if (updated.count) await tx.dashboardAdminEvent.create({ data: { actorId: actor.id, action: 'invitation.revoked', targetId: id } });
      return updated.count;
    });
    return changed ? NextResponse.json({ ok: true }) : fail('invitation_not_pending', 409);
  }
  if (action !== 'update_user') return fail('invalid_action', 400);
  if (typeof data.role !== 'string' || !ROLES.includes(data.role as typeof ROLES[number]) || typeof data.disabled !== 'boolean') return fail('invalid_user_update', 400);
  const role = data.role; const disabled = data.disabled;
  try {
    await db.$transaction(async (tx) => {
      // Serializable transaction prevents simultaneous admins from removing the last admin.
      const target = await tx.dashboardUser.findUnique({ where: { id } });
      if (!target) throw Error('user_not_found');
      if (target.role === 'ADMIN' && !target.disabled && (role !== 'ADMIN' || disabled)) {
        const count = await tx.dashboardUser.count({ where: { role: 'ADMIN', disabled: false } });
        if (count <= 1) throw Error('last_admin');
      }
      await tx.dashboardUser.update({ where: { id }, data: { role, disabled } });
      if (disabled || target.role !== role) await tx.dashboardSession.deleteMany({ where: { userId: id } });
      await tx.dashboardAdminEvent.create({ data: { actorId: actor.id, action: 'user.updated', targetId: id, details: { oldRole: target.role, newRole: role, oldDisabled: target.disabled, newDisabled: disabled } } });
    }, { isolationLevel: 'Serializable' });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message === 'last_admin') return fail('cannot_remove_last_admin', 409);
    if (error instanceof Error && error.message === 'user_not_found') return fail('user_not_found', 404);
    return fail('update_conflict_retry', 409);
  }
}
