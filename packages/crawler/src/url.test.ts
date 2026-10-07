import assert from 'node:assert/strict';
import test from 'node:test';

import { isSameOrigin, isSupportedUrl, normalizeUrl } from './url.js';

test('removes URL fragments', () => {
  assert.equal(
    normalizeUrl('https://example.com/products/dog-treats#reviews'),
    'https://example.com/products/dog-treats',
  );
});

test('resolves relative URLs against a base URL', () => {
  assert.equal(
    normalizeUrl('../treats', 'https://example.com/shop/category/'),
    'https://example.com/shop/treats',
  );
});

test('normalizes host casing', () => {
  assert.equal(normalizeUrl('https://EXAMPLE.COM/products'), 'https://example.com/products');
});

test('normalizes default HTTPS ports', () => {
  assert.equal(normalizeUrl('https://example.com:443/products'), 'https://example.com/products');
});

test('normalizes default HTTP ports', () => {
  assert.equal(normalizeUrl('http://example.com:80/products'), 'http://example.com/products');
});

test('preserves non-default ports', () => {
  assert.equal(
    normalizeUrl('https://example.com:8443/products'),
    'https://example.com:8443/products',
  );
});

test('preserves query parameters', () => {
  assert.equal(
    normalizeUrl('https://example.com/products?sort=price&page=2'),
    'https://example.com/products?sort=price&page=2',
  );
});

test('preserves trailing slash differences', () => {
  assert.notEqual(
    normalizeUrl('https://example.com/products'),
    normalizeUrl('https://example.com/products/'),
  );
});

test('rejects unsupported protocols', () => {
  assert.throws(() => normalizeUrl('mailto:test@example.com'), /Unsupported URL protocol/);

  assert.throws(() => normalizeUrl('javascript:void(0)'), /Unsupported URL protocol/);
});

test('identifies URLs on the same origin', () => {
  assert.equal(isSameOrigin('https://example.com/products', 'https://example.com'), true);

  assert.equal(isSameOrigin('https://shop.example.com/products', 'https://example.com'), false);
});

test('identifies supported URLs safely', () => {
  assert.equal(isSupportedUrl('/products', 'https://example.com'), true);
  assert.equal(isSupportedUrl('https://example.com/products'), true);
  assert.equal(isSupportedUrl('mailto:test@example.com'), false);
  assert.equal(isSupportedUrl('not a valid absolute url'), false);
});
