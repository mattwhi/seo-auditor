import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import type { NextRequest } from 'next/server';
export { db } from '@seo-auditor/database';
import { db } from '@seo-auditor/database';
const scrypt = promisify(scryptCallback);

export const SESSION_COOKIE = 'seo_auditor_session';
export const ROLES = ['ADMIN', 'USER', 'READ_ONLY'] as const;
export type Role = (typeof ROLES)[number];
export const token = () => randomBytes(32).toString('hex');
export const digest = (value: string) => createHash('sha256').update(value).digest('hex');
export const normalizeEmail = (value: string) => value.trim().toLowerCase();

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const hash = (await scrypt(password, Buffer.from(salt, 'hex'), 64)) as Buffer;
  return `scrypt:${salt}:${hash.toString('hex')}`;
}
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [method, salt, hex] = stored.split(':');
  if (
    method !== 'scrypt' ||
    !/^[a-f0-9]{32}$/.test(salt ?? '') ||
    !/^[a-f0-9]{128}$/.test(hex ?? '')
  )
    return false;
  const expected = Buffer.from(hex, 'hex');
  const actual = (await scrypt(password, Buffer.from(salt, 'hex'), 64)) as Buffer;
  return timingSafeEqual(actual, expected);
}
export async function currentUser(request: NextRequest) {
  const raw = request.cookies.get(SESSION_COOKIE)?.value;
  if (!raw || !/^[a-f0-9]{64}$/.test(raw)) return null;
  const session = await db.dashboardSession.findUnique({
    where: { tokenHash: digest(raw) },
    include: { user: true },
  });
  if (!session || session.expiresAt <= new Date() || session.user.disabled) return null;
  return { id: session.user.id, email: session.user.email, role: session.user.role as Role };
}
export function sameOrigin(request: NextRequest) {
  const origin = request.headers.get('origin');
  const host = request.headers.get('host');
  if (!origin || !host) return false;
  try {
    const url = new URL(origin);
    return url.host === host && ['http:', 'https:'].includes(url.protocol);
  } catch {
    return false;
  }
}
export const canMutate = (role: Role) => role === 'ADMIN' || role === 'USER';
