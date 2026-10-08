import test from 'node:test';
import assert from 'node:assert/strict';
import { wordpressConfig, remediationPreview, discoverWordpress } from '../dist/wordpress.js';

test('disabled unless explicitly enabled', async () => {
  const old = process.env.WORDPRESS_INTEGRATIONS_ENABLED;
  process.env.WORDPRESS_INTEGRATIONS_ENABLED = 'false';
  assert.equal(wordpressConfig('https://example.com'), null);
  assert.equal((await discoverWordpress('https://example.com')).enabled, false);
  if (old === undefined) delete process.env.WORDPRESS_INTEGRATIONS_ENABLED; else process.env.WORDPRESS_INTEGRATIONS_ENABLED = old;
});
test('rejects mismatched host and non-https target', () => {
  const oldEnabled = process.env.WORDPRESS_INTEGRATIONS_ENABLED;
  const oldSites = process.env.WORDPRESS_PROJECT_SITES;
  process.env.WORDPRESS_INTEGRATIONS_ENABLED = 'true';
  process.env.WORDPRESS_PROJECT_SITES = JSON.stringify({ 'https://example.com': { enabled: true, siteUrl: 'https://other.example/' } });
  assert.throws(() => wordpressConfig('https://example.com'), /wordpress_site_origin_mismatch/);
  if (oldEnabled === undefined) delete process.env.WORDPRESS_INTEGRATIONS_ENABLED; else process.env.WORDPRESS_INTEGRATIONS_ENABLED = oldEnabled;
  if (oldSites === undefined) delete process.env.WORDPRESS_PROJECT_SITES; else process.env.WORDPRESS_PROJECT_SITES = oldSites;
});
test('remediation preview is never executable', () => {
  const result = remediationPreview('description.missing', 'https://example.com/a', 'https://example.com');
  assert.equal(result.executable, false);
  assert.equal(result.requiresApproval, true);
  assert.throws(() => remediationPreview('title.missing', 'https://evil.example/', 'https://example.com'), /page_outside_project/);
});

test('v0.8.1 WordPress connection remains disabled without site opt-in', async () => {
  const { wordpressConnectionStatus } = await import('../dist/wordpress.js');
  const old = process.env.WORDPRESS_INTEGRATIONS_ENABLED;
  process.env.WORDPRESS_INTEGRATIONS_ENABLED = 'false';
  const status = await wordpressConnectionStatus('https://example.com');
  assert.equal(status.enabled, false);
  assert.equal(status.authenticated, false);
  if (old === undefined) delete process.env.WORDPRESS_INTEGRATIONS_ENABLED; else process.env.WORDPRESS_INTEGRATIONS_ENABLED = old;
});

test('v0.8.1 mapping rejects external pages and non-content slugs', async () => {
  const { wordpressContentCandidate } = await import('../dist/wordpress.js');
  assert.throws(() => wordpressContentCandidate('https://evil.example/product/a', 'https://example.com'), /page_outside_project/);
  assert.equal(wordpressContentCandidate('https://example.com/', 'https://example.com').supported, false);
  assert.deepEqual(wordpressContentCandidate('https://example.com/product/beef-chews/', 'https://example.com').candidates, ['posts', 'pages', 'product']);
});
