import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';

/** Production dashboard gate. Keep credentials server-side and terminate TLS upstream. */
export function proxy(request: NextRequest) {
  if (process.env.NODE_ENV !== 'production') return NextResponse.next();

  const user = process.env.SEO_AUDITOR_DASHBOARD_USER ?? '';
  const password = process.env.SEO_AUDITOR_DASHBOARD_PASSWORD ?? '';
  if (!user || password.length < 24) {
    return new NextResponse('Dashboard authentication is not configured', {
      status: 503,
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  const header = request.headers.get('authorization') ?? '';
  let supplied = '';
  if (header.startsWith('Basic ') && header.length < 4096) {
    try {
      supplied = Buffer.from(header.slice(6), 'base64').toString('utf8');
    } catch {
      supplied = '';
    }
  }
  const expected = `${user}:${password}`;
  const a = Buffer.from(supplied, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length === b.length && timingSafeEqual(a, b)) {
    const response = NextResponse.next();
    response.headers.set('Cache-Control', 'private, no-store, max-age=0');
    response.headers.set('CDN-Cache-Control', 'no-store');
    response.headers.set('Cloudflare-CDN-Cache-Control', 'no-store');
    return response;
  }

  return new NextResponse('Authentication required', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="SEO Auditor", charset="UTF-8"',
      'Cache-Control': 'no-store',
    },
  });
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
