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
