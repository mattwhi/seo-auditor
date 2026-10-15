import { NextRequest, NextResponse } from 'next/server';
import { currentUser, db, sameOrigin } from '../../../../../lib/auth';
import { encryptWordPressPassword } from '../../../../../lib/wordpress-crypto';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const fail = (error: string, status: number) => NextResponse.json({ error }, { status });
async function authorize(req: NextRequest) {
  if (!sameOrigin(req)) return null;
  const actor = await currentUser(req);
  return actor?.role === 'ADMIN' ? actor : null;
}
export async function POST(req: NextRequest) {
  const actor = await authorize(req);
  if (!actor) return fail('forbidden', 403);
  let input: unknown;
  try { input = await req.json(); } catch { return fail('invalid_json', 400); }
  if (!input || typeof input !== 'object' || Array.isArray(input)) return fail('invalid_request', 400);
  const { projectId, serviceAccountJson } = input as Record<string, unknown>;
  if (typeof projectId !== 'string' || !/^[a-zA-Z0-9_-]{8,64}$/.test(projectId) || typeof serviceAccountJson !== 'string' || serviceAccountJson.length > 25000) return fail('invalid_request', 400);
  const project = await db.project.findUnique({ where: { id: projectId }, select: { id: true } });
  if (!project) return fail('project_not_found', 404);
  let parsed: unknown;
  try { parsed = JSON.parse(serviceAccountJson); } catch { return fail('invalid_google_json', 400); }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return fail('invalid_google_json', 400);
  const value = parsed as Record<string, unknown>;
  if (value.type !== 'service_account' || typeof value.client_email !== 'string' || !/^[^\s@]+@[^\s@]+$/.test(value.client_email) || typeof value.private_key !== 'string' || !value.private_key.includes('BEGIN PRIVATE KEY')) return fail('invalid_google_service_account', 400);
  let encryptedJson: string;
  try { encryptedJson = encryptWordPressPassword(JSON.stringify(value)); } catch { return fail('encryption_unavailable', 503); }
  await db.$transaction(async tx => {
    await tx.googleCredential.upsert({ where: { projectId }, create: { projectId, encryptedJson, accountEmail: value.client_email as string, updatedById: actor.id }, update: { encryptedJson, accountEmail: value.client_email as string, updatedById: actor.id } });
    await tx.dashboardAdminEvent.create({ data: { actorId: actor.id, action: 'google.credentials.updated', targetId: projectId } });
  });
  return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
}
export async function DELETE(req: NextRequest) {
  const actor = await authorize(req);
  if (!actor) return fail('forbidden', 403);
  let input: unknown;
  try { input = await req.json(); } catch { return fail('invalid_json', 400); }
  const projectId = input && typeof input === 'object' && 'projectId' in input ? (input as {projectId: unknown}).projectId : null;
  if (typeof projectId !== 'string' || !/^[a-zA-Z0-9_-]{8,64}$/.test(projectId)) return fail('invalid_request', 400);
  await db.$transaction(async tx => {
    await tx.googleCredential.deleteMany({ where: { projectId } });
    await tx.dashboardAdminEvent.create({ data: { actorId: actor.id, action: 'google.credentials.deleted', targetId: projectId } });
  });
  return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
}
