import { getApplicationSettings } from '@seo-auditor/database';
import { NextRequest, NextResponse } from 'next/server';
import { currentUser, db, digest, hashPassword, normalizeEmail, ROLES, sameOrigin, SESSION_COOKIE, token, verifyPassword } from '../../../../lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const reply = (error: string, status: number) => NextResponse.json({ error }, { status, headers: { 'Cache-Control': 'no-store' } });
const attempts = new Map<string, { count: number; until: number }>();

export async function GET(req: NextRequest, ctx: { params: Promise<{ action: string }> }) {
  const { action } = await ctx.params;
  if (action === 'me') {
    const user = await currentUser(req);
    return user ? NextResponse.json({ user }, { headers: { 'Cache-Control': 'no-store' } }) : reply('login_required', 401);
  }
  if (action === 'invitation') {
    const raw = req.nextUrl.searchParams.get('token') ?? '';
    if (!/^[a-f0-9]{64}$/.test(raw)) return reply('invalid_invitation', 400);
    const invite = await db.dashboardInvitation.findUnique({ where: { tokenHash: digest(raw) } });
    if (!invite || invite.acceptedAt || invite.revokedAt || invite.expiresAt <= new Date()) return reply('invalid_or_expired_invitation', 404);
    return NextResponse.json({ email: invite.email, expiresAt: invite.expiresAt }, { headers: { 'Cache-Control': 'no-store' } });
  }
  return reply('not_found', 404);
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ action: string }> }) {
  if (!sameOrigin(req)) return reply('invalid_origin', 403);
  const { action } = await ctx.params;
  let data: Record<string, unknown>;
  try { data = await req.json(); if (!data || typeof data !== 'object' || Array.isArray(data)) throw Error(); }
  catch { return reply('invalid_json', 400); }

  if (action === 'login') {
    const email = typeof data.email === 'string' ? normalizeEmail(data.email) : '';
    const password = typeof data.password === 'string' ? data.password : '';
    if (!email || email.length > 254 || password.length > 1024) return reply('invalid_credentials', 401);
    const key = digest(email);
    const now = Date.now(); const state = attempts.get(key);
    if (state && state.until > now && state.count >= 5) return reply('too_many_attempts', 429);
    const user = await db.dashboardUser.findUnique({ where: { email } });
    const valid = user && !user.disabled && await verifyPassword(password, user.passwordHash);
    if (!valid) {
      attempts.set(key, { count: state && state.until > now ? state.count + 1 : 1, until: now + 15 * 60_000 });
      return reply('invalid_credentials', 401);
    }
    attempts.delete(key);
    const raw = token();
    await db.dashboardSession.create({ data: { userId: user.id, tokenHash: digest(raw), expiresAt: new Date(now + 8 * 60 * 60_000) } });
    const response = NextResponse.json({ ok: true, role: user.role });
    response.cookies.set(SESSION_COOKIE, raw, { httpOnly: true, secure: req.nextUrl.protocol === 'https:', sameSite: 'lax', path: '/', maxAge: 8 * 60 * 60 });
    response.headers.set('Cache-Control', 'no-store');
    return response;
  }
  if (action === 'register') {
    const raw = typeof data.token === 'string' ? data.token : '';
    const password = typeof data.password === 'string' ? data.password : '';
    if (!/^[a-f0-9]{64}$/.test(raw) || password.length < 12 || password.length > 1024) return reply('invalid_invitation_or_password', 400);
    const passwordHash = await hashPassword(password);
    try {
      await db.$transaction(async (tx) => {
        const invitation = await tx.dashboardInvitation.findUnique({ where: { tokenHash: digest(raw) } });
        if (!invitation || invitation.acceptedAt || invitation.revokedAt || invitation.expiresAt <= new Date() || !ROLES.includes(invitation.role as typeof ROLES[number])) throw Error('invalid_invitation');
        const updated = await tx.dashboardInvitation.updateMany({ where: { id: invitation.id, acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } }, data: { acceptedAt: new Date() } });
        if (updated.count !== 1) throw Error('invalid_invitation');
        await tx.dashboardUser.create({ data: { email: invitation.email, passwordHash, role: invitation.role } });
      });
    } catch { return reply('invalid_or_used_invitation', 409); }
    return NextResponse.json({ ok: true }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
  }
  if (action === 'logout') {
    const raw = req.cookies.get(SESSION_COOKIE)?.value;
    if (raw) await db.dashboardSession.deleteMany({ where: { tokenHash: digest(raw) } });
    const response = NextResponse.json({ ok: true });
    response.cookies.set(SESSION_COOKIE, '', { path: '/', maxAge: 0, httpOnly: true });
    return response;
  }
  if (action === 'invite') {
    const actor = await currentUser(req);
    if (actor?.role !== 'ADMIN') return reply('forbidden', 403);
    const email = typeof data.email === 'string' ? normalizeEmail(data.email) : '';
    const role = typeof data.role === 'string' ? data.role : 'READ_ONLY';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || !ROLES.includes(role as typeof ROLES[number])) return reply('invalid_invitation', 400);
    if (await db.dashboardUser.findUnique({ where: { email } })) return reply('user_already_exists', 409);
    const raw = token();
    const expiryHours = (await getApplicationSettings())['security.invitationExpiryHours'];
    await db.$transaction(async (tx) => {
      const invite = await tx.dashboardInvitation.create({ data: { email, role, tokenHash: digest(raw), invitedById: actor.id, expiresAt: new Date(Date.now() + expiryHours * 60 * 60_000) } });
      await tx.dashboardAdminEvent.create({ data: { actorId: actor.id, action: 'invitation.created', targetId: invite.id, details: { email, role } } });
    });
    // No SMTP provider configured: admin securely delivers this one-time URL out-of-band.
    return NextResponse.json({ inviteUrl: `${req.nextUrl.origin}/register?token=${raw}`, expiresInHours: expiryHours }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
  }
  return reply('not_found', 404);
}
