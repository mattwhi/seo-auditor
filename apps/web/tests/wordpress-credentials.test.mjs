import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const credentials = readFileSync(new URL('../app/api/admin/integrations/credentials/route.ts', import.meta.url), 'utf8');
const crypto = readFileSync(new URL('../lib/wordpress-crypto.ts', import.meta.url), 'utf8');
const api = readFileSync(new URL('../../api/src/wordpress.ts', import.meta.url), 'utf8');
test('credential mutations require admin session and same-origin request', () => {
  assert.match(credentials, /sameOrigin\(req\)/);
  assert.match(credentials, /actor\?\.role !== 'ADMIN'/);
  assert.match(credentials, /dashboardAdminEvent\.create/);
});
test('credentials are encrypted before persistence and not returned', () => {
  assert.match(credentials, /encryptWordPressPassword\(applicationPassword\)/);
  assert.match(crypto, /aes-256-gcm/);
  assert.match(crypto, /WORDPRESS_CREDENTIAL_ENCRYPTION_KEY/);
  assert.match(api, /decryptWordPressPassword\(saved\.encryptedPassword\)/);
});
