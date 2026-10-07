import assert from 'node:assert/strict';
import test from 'node:test';
import { compareAudits, issueFingerprint } from './index.js';

test('uses rule and final URL as stable page finding identity', () => {
  const a = { ruleId: 'title.missing', severity: 'high', category: 'metadata', message: 'a', page: { url: 'https://example.com/a', finalUrl: 'https://example.com/a' } };
  const b = { ...a, message: 'changed wording' };
  assert.equal(issueFingerprint(a), issueFingerprint(b));
});

test('compares pages, score and finding lifecycle', () => {
  const baseline = { id: 'old', score: 90, pages: [{ url: 'https://example.com/a', finalUrl: 'https://example.com/a' }, { url: 'https://example.com/old', finalUrl: 'https://example.com/old' }], issues: [
    { ruleId: 'title.missing', severity: 'high', category: 'metadata', message: 'missing', page: { url: 'https://example.com/a', finalUrl: 'https://example.com/a' } },
    { ruleId: 'status.client-error', severity: 'high', category: 'crawlability', message: '404', page: { url: 'https://example.com/old', finalUrl: 'https://example.com/old' } },
  ] };
  const current = { id: 'new', score: 95, pages: [{ url: 'https://example.com/a', finalUrl: 'https://example.com/a' }, { url: 'https://example.com/new', finalUrl: 'https://example.com/new' }], issues: [
    { ruleId: 'title.missing', severity: 'high', category: 'metadata', message: 'missing', page: { url: 'https://example.com/a', finalUrl: 'https://example.com/a' } },
    { ruleId: 'description.missing', severity: 'medium', category: 'metadata', message: 'missing', page: { url: 'https://example.com/new', finalUrl: 'https://example.com/new' } },
  ] };
  const result = compareAudits(current, baseline);
  assert.equal(result.score.delta, 5);
  assert.deepEqual(result.pages.added, ['https://example.com/new']);
  assert.deepEqual(result.pages.removed, ['https://example.com/old']);
  assert.equal(result.issues.new.length, 1);
  assert.equal(result.issues.resolved.length, 1);
  assert.equal(result.issues.persistent.length, 1);
});
