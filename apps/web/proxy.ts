import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE } from './lib/auth-constants';

// Fast navigation gate only. All data/API handlers MUST validate sessions against DB.
export function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (path.startsWith('/api/')) return NextResponse.next();
  if (path === '/login' || path === '/register') return NextResponse.next();
  if (request.cookies.has(SESSION_COOKIE)) return NextResponse.next();
  return NextResponse.redirect(new URL('/login', request.url));
}
export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };
