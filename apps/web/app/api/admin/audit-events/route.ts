import { NextRequest, NextResponse } from 'next/server';
import { currentUser, db } from '../../../../lib/auth';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(req: NextRequest) {
  const actor = await currentUser(req);
  if (actor?.role !== 'ADMIN') return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const archived = req.nextUrl.searchParams.get('view') === 'archived';
  const events = await db.dashboardAdminEvent.findMany({
    where: archived ? { archivedAt: { not: null } } : { archivedAt: null },
    select: { id: true, action: true, targetId: true, createdAt: true, actor: { select: { email: true } } },
    orderBy: { createdAt: 'desc' }, take: 200,
  });
  const retention = await db.applicationSetting.findUnique({ where: { key: 'activity.retentionDays' } });
  return NextResponse.json({ events, view: archived ? 'archived' : 'active', retentionDays: typeof retention?.value === 'number' ? retention.value : 30 }, { headers: { 'Cache-Control': 'no-store' } });
}
