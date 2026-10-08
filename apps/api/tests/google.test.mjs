import test from 'node:test';
import assert from 'node:assert/strict';
import { credentials, getGoogleConfig, googleStatus } from '../dist/google.js';

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

import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('mounted credentials file is preferred to legacy JSON environment', () => {
  const dir = mkdtempSync(join(tmpdir(), 'seo-google-test-'));
  const previousFile = process.env.GOOGLE_SERVICE_ACCOUNT_FILE;
  const previousJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  try {
    const file = join(dir, 'service-account.json');
    writeFileSync(file, JSON.stringify({ client_email: 'reader@example.com', private_key: 'test-key' }), { mode: 0o600 });
    process.env.GOOGLE_SERVICE_ACCOUNT_FILE = file;
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON = 'invalid-json';
    assert.equal(credentials().client_email, 'reader@example.com');
    assert.equal(googleStatus('https://example.com').credentialsConfigured, true);
  } finally {
    if (previousFile === undefined) delete process.env.GOOGLE_SERVICE_ACCOUNT_FILE;
    else process.env.GOOGLE_SERVICE_ACCOUNT_FILE = previousFile;
    if (previousJson === undefined) delete process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    else process.env.GOOGLE_SERVICE_ACCOUNT_JSON = previousJson;
    rmSync(dir, { recursive: true, force: true });
  }
});

test('missing credentials file fails without disclosing its path', () => {
  const previous = process.env.GOOGLE_SERVICE_ACCOUNT_FILE;
  try {
    process.env.GOOGLE_SERVICE_ACCOUNT_FILE = '/nonexistent/secret.json';
    assert.throws(() => credentials(), { message: 'google_credentials_file_unreadable' });
  } finally {
    if (previous === undefined) delete process.env.GOOGLE_SERVICE_ACCOUNT_FILE;
    else process.env.GOOGLE_SERVICE_ACCOUNT_FILE = previous;
  }
});
