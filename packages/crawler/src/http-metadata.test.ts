import assert from 'node:assert/strict';
import test from 'node:test';

import { extractHttpResponseMetadata } from './http-metadata.js';

test('extracts SEO-relevant HTTP response metadata', () => {
  const headers = new Headers({
    'content-length': '1234',
    'content-language': 'en-GB',
    'content-encoding': 'br',
    'cache-control': 'public, max-age=3600',
    etag: '"abc123"',
    'last-modified': 'Wed, 07 Oct 2026 09:00:00 GMT',
    'x-robots-tag': 'noindex, nofollow',
  });

  assert.deepEqual(extractHttpResponseMetadata(headers), {
    contentLength: 1234,
    contentEncoding: 'br',
    contentLanguage: 'en-GB',
    cacheControl: 'public, max-age=3600',
    etag: '"abc123"',
    lastModified: 'Wed, 07 Oct 2026 09:00:00 GMT',
    xRobotsTag: ['noindex', 'nofollow'],
  });
});

test('returns null or empty values for absent metadata', () => {
  assert.deepEqual(extractHttpResponseMetadata(new Headers()), {
    contentLength: null,
    contentEncoding: null,
    contentLanguage: null,
    cacheControl: null,
    etag: null,
    lastModified: null,
    xRobotsTag: [],
  });
});

test('rejects invalid content-length values', () => {
  const headers = new Headers({ 'content-length': '-1' });
  assert.equal(extractHttpResponseMetadata(headers).contentLength, null);
});

test('normalizes X-Robots-Tag directives', () => {
  const headers = new Headers({ 'x-robots-tag': ' NoIndex, FOLLOW , noarchive ' });
  assert.deepEqual(extractHttpResponseMetadata(headers).xRobotsTag, [
    'noindex',
    'follow',
    'noarchive',
  ]);
});
