import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
test('integration probes require administrator authentication and validate project IDs', () => {
  const route = read('../app/api/admin/integrations/test/route.ts');
  assert.match(route, /actor\?\.role !== 'ADMIN'/);
  assert.match(route, /projectId.*test\(projectId\)/);
  assert.match(route, /project_not_found/);
});
test('integration writes enforce same-origin and administrator permissions', () => {
  const route = read('../app/api/admin/integrations/route.ts');
  assert.match(route, /sameOrigin\(req\)/);
  assert.match(route, /actor\?\.role !== 'ADMIN'/);
  assert.match(route, /wordpress_origin_mismatch/);
});
test('remediation requests require administrator authentication', () => {
  const route = read('../app/api/remediation/route.ts');
  assert.match(route, /dashboardUser\.role !== 'ADMIN'/);
  assert.match(route, /SESSION_COOKIE/);
  assert.doesNotMatch(route, /REMEDIATION_OPERATOR_TOKEN/);
});
