import test from 'node:test';
import assert from 'node:assert/strict';
import { getGoogleConfig, googleStatus } from '../dist/google.js';

test('google is disabled by default', () => {
  const original = process.env.GOOGLE_INTEGRATIONS_ENABLED;
  delete process.env.GOOGLE_INTEGRATIONS_ENABLED;
  assert.equal(googleStatus('https://example.com').enabled, false);
  if (original === undefined) delete process.env.GOOGLE_INTEGRATIONS_ENABLED;
  else process.env.GOOGLE_INTEGRATIONS_ENABLED = original;
});

test('project mapping normalises trailing slash and hostname case', () => {
  const original = process.env.GOOGLE_PROJECT_PROPERTIES;
  process.env.GOOGLE_PROJECT_PROPERTIES = JSON.stringify({ 'https://Example.com/': { searchConsoleSiteUrl: 'sc-domain:example.com', ga4PropertyId: '1234' } });
  assert.equal(getGoogleConfig('https://example.com').ga4PropertyId, '1234');
  assert.deepEqual(getGoogleConfig('https://another.com'), {});
  if (original === undefined) delete process.env.GOOGLE_PROJECT_PROPERTIES;
  else process.env.GOOGLE_PROJECT_PROPERTIES = original;
});
