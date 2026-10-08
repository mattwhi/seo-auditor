import assert from 'node:assert/strict';
import test from 'node:test';
import { isNonContentUtilityUrl } from './utility-links.js';
test('excludes Cloudflare email obfuscation endpoint, not normal pages', () => {
  assert.equal(isNonContentUtilityUrl('https://example.com/cdn-cgi/l/email-protection#abc'), true);
  assert.equal(isNonContentUtilityUrl('https://example.com/cdn-cgi/l/email-protection/'), true);
  assert.equal(isNonContentUtilityUrl('https://example.com/contact'), false);
});
