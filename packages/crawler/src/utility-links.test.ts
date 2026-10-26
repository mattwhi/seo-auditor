import assert from 'node:assert/strict';
import test from 'node:test';
import { isNonContentUtilityUrl } from './utility-links.js';
test('excludes Cloudflare email obfuscation endpoint, not normal pages', () => {
  assert.equal(isNonContentUtilityUrl('https://example.com/cdn-cgi/l/email-protection#abc'), true);
  assert.equal(isNonContentUtilityUrl('https://example.com/cdn-cgi/l/email-protection/'), true);
  assert.equal(isNonContentUtilityUrl('https://example.com/contact'), false);
});

test('legacy email protection utility route is excluded', () => {
  assert.equal(isNonContentUtilityUrl('https://example.com/email-protection/'), true);
});

test('excludes WordPress sharing URLs but preserves ordinary content parameters', () => {
  for (const url of [
    'https://example.com/product/dog-treat/?share=facebook',
    'https://example.com/post/?shared=email',
    'https://example.com/post/?print=1',
    'https://www.facebook.com/sharer/sharer.php?u=https%3A%2F%2Fexample.com',
    'https://twitter.com/intent/tweet?url=https%3A%2F%2Fexample.com',
    'https://www.linkedin.com/sharing/share-offsite/?url=https%3A%2F%2Fexample.com',
    'https://api.whatsapp.com/send?text=Hello',
  ]) assert.equal(isNonContentUtilityUrl(url), true, url);
  for (const url of [
    'https://example.com/product/dog-treat/?attribute_pa_size=large',
    'https://example.com/shop/?orderby=price',
    'https://example.com/article-about-sharing/',
  ]) assert.equal(isNonContentUtilityUrl(url), false, url);
});
