import test from 'node:test';
import assert from 'node:assert/strict';
import { REMEDIATION_SECURITY_MODEL } from '../dist/remediation-security.js';

// Deployment write flags and bearer execution tokens were retired in favour of
// authenticated administrator sessions, per-project policies and preflight checks.
test('remediation uses administrator sessions and project policy', () => {
  assert.equal(REMEDIATION_SECURITY_MODEL, 'project_policy_and_admin_session');
});

test('legacy deployment flags cannot switch remediation security model', () => {
  const previous = process.env.REMEDIATION_WRITES_ENABLED;
  try {
    process.env.REMEDIATION_WRITES_ENABLED = 'true';
    assert.equal(REMEDIATION_SECURITY_MODEL, 'project_policy_and_admin_session');
    process.env.REMEDIATION_WRITES_ENABLED = 'false';
    assert.equal(REMEDIATION_SECURITY_MODEL, 'project_policy_and_admin_session');
  } finally {
    if (previous === undefined) delete process.env.REMEDIATION_WRITES_ENABLED;
    else process.env.REMEDIATION_WRITES_ENABLED = previous;
  }
});
