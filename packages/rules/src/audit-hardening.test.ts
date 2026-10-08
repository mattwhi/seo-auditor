import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateAudit, type AuditPageFacts } from './audit.js';
const page = (id: string, overrides: Partial<AuditPageFacts> = {}): AuditPageFacts => ({
  id, url: `https://example.com/${id}`, finalUrl: `https://example.com/${id}`, statusCode: 200,
  contentType: 'text/html', title: 'Shared', metaDescription: 'Shared description', canonical: null,
  robots: [], xRobotsTag: [], crawlDepth: 1, contentHash: null, outgoingLinks: [], hreflang: [], jsonLdErrors: 0,
  ...overrides,
});
test('canonicalized variants do not produce actionable duplicate titles', () => {
  const findings = evaluateAudit([page('a'), page('b', { canonical: 'https://example.com/a' })], 'https://example.com/a');
  assert.equal(findings.filter((f) => f.ruleId === 'metadata.title-duplicate' && f.severity !== 'info').length, 0);
});
test('two competing indexable pages produce actionable duplicate titles', () => {
  const findings = evaluateAudit([page('a'), page('b')], 'https://example.com/a');
  assert.equal(findings.filter((f) => f.ruleId === 'metadata.title-duplicate' && f.severity === 'medium').length, 2);
});
test('email obfuscation is ignored and repeated broken links collapse per source', () => {
  const src = page('a', { outgoingLinks: [
    { href: 'https://example.com/cdn-cgi/l/email-protection#abc', internal: true, text: 'email' },
    { href: 'https://example.com/b', internal: true, text: 'one' },
    { href: 'https://example.com/b', internal: true, text: 'two' },
  ] });
  const findings = evaluateAudit([src, page('b', { statusCode: 404 })], 'https://example.com/a');
  assert.equal(findings.filter((f) => f.ruleId === 'links.broken-internal').length, 1);
});
