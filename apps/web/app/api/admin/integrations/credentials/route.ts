import { NextRequest, NextResponse } from 'next/server';
import { currentUser, db, sameOrigin } from '../../../../../lib/auth';
import { encryptWordPressPassword } from '../../../../../lib/wordpress-crypto';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const fail = (error: string, status: number) => NextResponse.json({ error }, { status });
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return fail('invalid_origin', 403);
  const actor = await currentUser(req);
  if (actor?.role !== 'ADMIN') return fail('forbidden', 403);
  let data: unknown;
  try { data = await req.json(); } catch { return fail('invalid_json', 400); }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return fail('invalid_request', 400);
  const { projectId, username, applicationPassword } = data as Record<string, unknown>;
  if (typeof projectId !== 'string' || !/^[a-zA-Z0-9_-]{8,64}$/.test(projectId) ||
      typeof username !== 'string' || !username.trim() || username.length > 200 ||
      typeof applicationPassword !== 'string' || !applicationPassword.trim() || applicationPassword.length > 512)
    return fail('invalid_credentials', 400);
  const mapping = await db.projectIntegration.findUnique({ where: { projectId } });
  if (!mapping?.wordpressEnabled || !mapping.wordpressSiteUrl) return fail('wordpress_mapping_not_enabled', 409);
  let encryptedPassword: string;
  try { encryptedPassword = encryptWordPressPassword(applicationPassword); }
  catch { return fail('wordpress_encryption_key_not_configured', 503); }
  await db.$transaction(async tx => {
    await tx.wordPressCredential.upsert({ where: { projectId }, create: { projectId, username: username.trim(), encryptedPassword, updatedById: actor.id }, update: { username: username.trim(), encryptedPassword, updatedById: actor.id } });
    await tx.dashboardAdminEvent.create({ data: { actorId: actor.id, action: 'wordpress.credentials.updated', targetId: projectId } });
  });
  return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
}
export async function DELETE(req: NextRequest) {
  if (!sameOrigin(req)) return fail('invalid_origin', 403);
  const actor = await currentUser(req);
  if (actor?.role !== 'ADMIN') return fail('forbidden', 403);
  let data: unknown;
  try { data = await req.json(); } catch { return fail('invalid_json', 400); }
  const projectId = (data && typeof data === 'object' && 'projectId' in data) ? (data as {projectId: unknown}).projectId : null;
  if (typeof projectId !== 'string' || !/^[a-zA-Z0-9_-]{8,64}$/.test(projectId)) return fail('invalid_request', 400);
  await db.$transaction(async tx => {
    await tx.wordPressCredential.deleteMany({ where: { projectId } });
    await tx.dashboardAdminEvent.create({ data: { actorId: actor.id, action: 'wordpress.credentials.deleted', targetId: projectId } });
  });
  return NextResponse.json({ ok: true });
}
