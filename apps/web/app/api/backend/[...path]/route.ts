import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = process.env.API_INTERNAL_URL ?? 'http://localhost:4000';

async function proxy(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  const target = new URL(`/api/${path.join('/')}`, API_BASE_URL);
  target.search = request.nextUrl.search;

  const headers = new Headers(request.headers);
  headers.delete('host');
  headers.delete('content-length');

  const body = request.method === 'GET' || request.method === 'HEAD' ? undefined : await request.text();
  const response = await fetch(target, {
    method: request.method,
    headers,
    body,
    cache: 'no-store',
  });

  return new NextResponse(response.body, {
    status: response.status,
    headers: { 'content-type': response.headers.get('content-type') ?? 'application/json' },
  });
}

export const GET = proxy;
export const POST = proxy;
