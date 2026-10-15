import { NextRequest, NextResponse } from 'next/server';
import { currentUser, db, sameOrigin } from '../../../../lib/auth';
import { getApplicationSettings, validSetting } from '@seo-auditor/database';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const error = (message: string, status: number) =>
  NextResponse.json({ error: message }, { status, headers: { 'Cache-Control': 'no-store' } });

export async function GET(req: NextRequest) {
  const actor = await currentUser(req);
  if (actor?.role !== 'ADMIN') return error('forbidden', 403);
  return NextResponse.json(
    {
      settings: await getApplicationSettings(),
      safeguards: {
        wordpressWrites: true,
        performanceInfrastructureEnabled: process.env.PERFORMANCE_ENABLED === 'true',
      },
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

export async function PATCH(req: NextRequest) {
  if (!sameOrigin(req)) return error('invalid_origin', 403);
  const actor = await currentUser(req);
  if (actor?.role !== 'ADMIN') return error('forbidden', 403);
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return error('invalid_json', 400);
  }
  if (!body || typeof body !== 'object' || Array.isArray(body))
    return error('invalid_request', 400);
  const { key, value } = body as Record<string, unknown>;
  if (typeof key !== 'string' || !validSetting(key, value)) return error('invalid_setting', 400);
  await db.$transaction(async (tx) => {
    const previous = await tx.applicationSetting.findUnique({ where: { key } });
    await tx.applicationSetting.upsert({
      where: { key },
      create: { key, value: value as boolean | number, updatedById: actor.id },
      update: { value: value as boolean | number, updatedById: actor.id },
    });
    await tx.dashboardAdminEvent.create({
      data: {
        actorId: actor.id,
        action: 'application.setting.updated',
        targetId: key,
        details: {
          previous: previous?.value ?? null,
          next: value as boolean | number,
        },
      },
    });
  });
  return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
}
