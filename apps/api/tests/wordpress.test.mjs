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

test('WordPress configuration requires HTTPS except for explicitly allowed staging', () => {
  const previous = {
    enabled: process.env.WORDPRESS_INTEGRATIONS_ENABLED,
    sites: process.env.WORDPRESS_PROJECT_SITES,
    staging: process.env.WORDPRESS_STAGING_HTTP_ENABLED,
  };

  const stagingOrigin = 'http://seo-auditor-wp-test-wordpress-1';
  const configure = (projectUrl, siteUrl = projectUrl) => {
    process.env.WORDPRESS_PROJECT_SITES = JSON.stringify({
      [projectUrl]: { enabled: true, siteUrl },
    });
  };

  try {
    process.env.WORDPRESS_INTEGRATIONS_ENABLED = 'true';
    delete process.env.WORDPRESS_STAGING_HTTP_ENABLED;

    configure('https://example.com', 'https://example.com/');
    assert.equal(wordpressConfig('https://example.com'), 'https://example.com');

    configure('http://example.com', 'http://example.com/');
    assert.throws(
      () => wordpressConfig('http://example.com'),
      /wordpress_site_origin_mismatch/,
    );

    configure(stagingOrigin, `${stagingOrigin}/`);
    assert.throws(
      () => wordpressConfig(stagingOrigin),
      /wordpress_site_origin_mismatch/,
    );

    process.env.WORDPRESS_STAGING_HTTP_ENABLED = 'true';
    assert.equal(wordpressConfig(stagingOrigin), stagingOrigin);

    configure('http://another-wordpress-container', 'http://another-wordpress-container/');
    assert.throws(
      () => wordpressConfig('http://another-wordpress-container'),
      /wordpress_site_origin_mismatch/,
    );

    configure(stagingOrigin, 'http://another-wordpress-container/');
    assert.throws(
      () => wordpressConfig(stagingOrigin),
      /wordpress_site_origin_mismatch/,
    );

    configure(stagingOrigin, 'http://user:password@seo-auditor-wp-test-wordpress-1/');
    assert.throws(
      () => wordpressConfig(stagingOrigin),
      /wordpress_site_origin_mismatch/,
    );
  } finally {
    const restore = (key, value) => {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    };
    restore('WORDPRESS_INTEGRATIONS_ENABLED', previous.enabled);
    restore('WORDPRESS_PROJECT_SITES', previous.sites);
    restore('WORDPRESS_STAGING_HTTP_ENABLED', previous.staging);
  }
});
