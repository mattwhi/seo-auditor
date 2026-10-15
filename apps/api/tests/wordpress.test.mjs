import test from 'node:test';
import assert from 'node:assert/strict';
import {
  remediationPreview,
  wordpressContentCandidate,
  seoFieldForRule,
} from '../dist/wordpress.js';

test('remediation preview is never directly executable', () => {
  const result = remediationPreview('description.missing', 'https://example.com/a', 'https://example.com');
  assert.equal(result.executable, false);
  assert.equal(result.requiresApproval, true);
  assert.throws(() => remediationPreview('title.missing', 'https://evil.example/', 'https://example.com'), /page_outside_project/);
});

test('only supported title and description rules map to Rank Math metadata', () => {
  assert.equal(seoFieldForRule('title.too-short'), 'rank_math_title');
  assert.equal(seoFieldForRule('description.missing'), 'rank_math_description');
  assert.equal(seoFieldForRule('image.alt-missing'), null);
});

test('WordPress mapping rejects external pages and non-content slugs', () => {
  assert.throws(() => wordpressContentCandidate('https://evil.example/product/a', 'https://example.com'), /page_outside_project/);
  assert.equal(wordpressContentCandidate('https://example.com/', 'https://example.com').supported, false);
  assert.deepEqual(wordpressContentCandidate('https://example.com/product/beef-chews/', 'https://example.com').candidates, ['posts', 'pages', 'product']);
});

test('WordPress mapping rejects HTTP sites unless the specific staging host is opted in', () => {
  const previous = process.env.WORDPRESS_STAGING_HTTP_ENABLED;
  const staging = 'http://seo-auditor-wp-test-wordpress-1';
  try {
    delete process.env.WORDPRESS_STAGING_HTTP_ENABLED;
    assert.throws(() => wordpressContentCandidate(`${staging}/test/`, staging), /page_outside_project/);
    process.env.WORDPRESS_STAGING_HTTP_ENABLED = 'true';
    assert.equal(wordpressContentCandidate(`${staging}/test/`, staging).supported, true);
    assert.throws(() => wordpressContentCandidate('http://untrusted.example/test/', 'http://untrusted.example'), /page_outside_project/);
    assert.throws(() => wordpressContentCandidate('http://another-wordpress-container/test/', staging), /page_outside_project/);
  } finally {
    if (previous === undefined) delete process.env.WORDPRESS_STAGING_HTTP_ENABLED;
    else process.env.WORDPRESS_STAGING_HTTP_ENABLED = previous;
  }
});
