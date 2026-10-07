import assert from 'node:assert/strict';
import test from 'node:test';

import {
  fetchWithRedirects,
  isRedirectStatus,
  RedirectError,
  resolveRedirectLocation,
} from './redirect.js';

test('identifies HTTP redirect status codes', () => {
  for (const status of [301, 302, 303, 307, 308]) assert.equal(isRedirectStatus(status), true);
  for (const status of [200, 300, 304, 404, 500]) assert.equal(isRedirectStatus(status), false);
});

test('resolves relative redirect locations', () => {
  assert.equal(
    resolveRedirectLocation('../new-page', 'https://example.com/old/page'),
    'https://example.com/new-page',
  );
});

test('resolves root-relative redirect locations', () => {
  assert.equal(
    resolveRedirectLocation('/new-page', 'https://example.com/old/page'),
    'https://example.com/new-page',
  );
});

test('preserves cross-origin redirect targets', () => {
  assert.equal(
    resolveRedirectLocation('https://www.example.org/new', 'https://example.com/old'),
    'https://www.example.org/new',
  );
});

test('rejects unsupported redirect protocols', () => {
  assert.throws(
    () => resolveRedirectLocation('mailto:test@example.com', 'https://example.com/old'),
    /Unsupported URL protocol/,
  );
});

test('redirect errors retain redirect evidence', () => {
  const error = new RedirectError(
    'Redirect loop detected',
    'https://example.com/a',
    [
      {
        url: 'https://example.com/a',
        statusCode: 301,
        location: '/b',
        targetUrl: 'https://example.com/b',
      },
    ],
    'loop',
  );

  assert.equal(error.reason, 'loop');
  assert.equal(error.hops.length, 1);
});


test('captures a complete redirect chain', async () => {
  const originalFetch = globalThis.fetch;
  const responses = [
    new Response(null, { status: 301, headers: { location: '/middle' } }),
    new Response(null, { status: 302, headers: { location: 'https://example.com/final' } }),
    new Response('<html></html>', { status: 200, headers: { 'content-type': 'text/html' } }),
  ];

  globalThis.fetch = async () => responses.shift() ?? new Response(null, { status: 500 });

  try {
    const result = await fetchWithRedirects(
      'https://example.com/start',
      {},
      { maxRetries: 0, baseDelayMs: 0, maxDelayMs: 0 },
      { maxRedirects: 5 },
    );

    assert.equal(result.finalUrl, 'https://example.com/final');
    assert.equal(result.hops.length, 2);
    assert.equal(result.hops[0]?.targetUrl, 'https://example.com/middle');
    assert.equal(result.hops[1]?.statusCode, 302);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('detects redirect loops', async () => {
  const originalFetch = globalThis.fetch;
  const responses = [
    new Response(null, { status: 301, headers: { location: '/b' } }),
    new Response(null, { status: 301, headers: { location: '/a' } }),
  ];

  globalThis.fetch = async () => responses.shift() ?? new Response(null, { status: 500 });

  try {
    await assert.rejects(
      fetchWithRedirects(
        'https://example.com/a',
        {},
        { maxRetries: 0, baseDelayMs: 0, maxDelayMs: 0 },
        { maxRedirects: 5 },
      ),
      (error: unknown) => error instanceof RedirectError && error.reason === 'loop',
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('enforces the maximum redirect count', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = String(input);
    const next = url.endsWith('/a') ? '/b' : '/c';
    return new Response(null, { status: 301, headers: { location: next } });
  };

  try {
    await assert.rejects(
      fetchWithRedirects(
        'https://example.com/a',
        {},
        { maxRetries: 0, baseDelayMs: 0, maxDelayMs: 0 },
        { maxRedirects: 1 },
      ),
      (error: unknown) => error instanceof RedirectError && error.reason === 'max-redirects',
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
