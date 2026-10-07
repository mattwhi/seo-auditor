import assert from 'node:assert/strict';
import test from 'node:test';

import {
  calculateRetryDelay,
  isRetryableStatus,
  parseRetryAfter,
} from './retry.js';

test('identifies transient HTTP status codes as retryable', () => {
  for (const status of [408, 429, 500, 502, 503, 504]) {
    assert.equal(isRetryableStatus(status), true);
  }
  for (const status of [200, 301, 400, 401, 403, 404]) {
    assert.equal(isRetryableStatus(status), false);
  }
});

test('parses Retry-After seconds', () => {
  assert.equal(parseRetryAfter('3'), 3000);
});

test('parses Retry-After HTTP dates', () => {
  const now = Date.parse('Wed, 07 Oct 2026 09:00:00 GMT');
  assert.equal(parseRetryAfter('Wed, 07 Oct 2026 09:00:05 GMT', now), 5000);
});

test('rejects invalid Retry-After values', () => {
  assert.equal(parseRetryAfter('not-a-date'), null);
  assert.equal(parseRetryAfter('-1'), null);
});

test('uses bounded exponential backoff', () => {
  const options = { maxRetries: 3, baseDelayMs: 100, maxDelayMs: 250 };
  assert.equal(calculateRetryDelay(1, options), 100);
  assert.equal(calculateRetryDelay(2, options), 200);
  assert.equal(calculateRetryDelay(3, options), 250);
});

test('honours Retry-After but caps excessive delays', () => {
  const options = { maxRetries: 3, baseDelayMs: 100, maxDelayMs: 2000 };
  assert.equal(calculateRetryDelay(1, options, '1'), 1000);
  assert.equal(calculateRetryDelay(1, options, '30'), 2000);
});
