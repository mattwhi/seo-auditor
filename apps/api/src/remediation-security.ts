import { timingSafeEqual } from 'node:crypto';

/** Fail-closed execution authorization. Never log or return token values. */
export function executionAuthorized(authorization: string | undefined): boolean {
  const expected = process.env.REMEDIATION_EXECUTION_TOKEN;
  if (!expected || expected.length < 48 || !authorization?.startsWith('Bearer ')) return false;
  const received = Buffer.from(authorization.slice(7), 'utf8');
  const secret = Buffer.from(expected, 'utf8');
  return received.length === secret.length && timingSafeEqual(received, secret);
}

/** Exact-origin allowlist. A production project is never implicitly authorized. */
export function writesEnabled(baseUrl: string): boolean {
  if (process.env.REMEDIATION_WRITES_ENABLED !== 'true') return false;
  const allowed = (process.env.REMEDIATION_WRITE_ALLOWED_ORIGINS ?? '')
    .split(',').map((v) => v.trim()).filter(Boolean);
  return allowed.includes(new URL(baseUrl).origin);
}
