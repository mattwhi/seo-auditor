import test from 'node:test';
import assert from 'node:assert/strict';
import { executionAuthorized, writesEnabled } from '../dist/remediation-security.js';

const STAGING = 'http://seo-auditor-wp-test-wordpress-1';
const PRODUCTION = 'https://jasperstreatshop.com';
const TOKEN = 'a'.repeat(64);

function withEnvironment(values, run) {
  const previous = new Map(Object.keys(values).map((key) => [key, process.env[key]]));
  try {
    for (const [key, value] of Object.entries(values)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    run();
  } finally {
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test('writes default to disabled, including for staging', () => {
  withEnvironment({ REMEDIATION_WRITES_ENABLED: undefined, REMEDIATION_WRITE_ALLOWED_ORIGINS: STAGING }, () => {
    assert.equal(writesEnabled(STAGING), false);
  });
  withEnvironment({ REMEDIATION_WRITES_ENABLED: 'false', REMEDIATION_WRITE_ALLOWED_ORIGINS: STAGING }, () => {
    assert.equal(writesEnabled(STAGING), false);
  });
});

test('enabled writes permit staging but reject production, including its subpaths', () => {
  withEnvironment({ REMEDIATION_WRITES_ENABLED: 'true', REMEDIATION_WRITE_ALLOWED_ORIGINS: STAGING }, () => {
    assert.equal(writesEnabled(STAGING + '/test/'), true);
    assert.equal(writesEnabled(PRODUCTION), false);
    assert.equal(writesEnabled(PRODUCTION + '/product/example/'), false);
    assert.equal(writesEnabled('https://www.jasperstreatshop.com'), false);
    assert.equal(writesEnabled('http://seo-auditor-wp-test-wordpress-1.evil.test'), false);
  });
});

test('writes require an exact origin and an explicit allowlist', () => {
  withEnvironment({ REMEDIATION_WRITES_ENABLED: 'true', REMEDIATION_WRITE_ALLOWED_ORIGINS: undefined }, () => {
    assert.equal(writesEnabled(STAGING), false);
  });
  withEnvironment({ REMEDIATION_WRITES_ENABLED: 'true', REMEDIATION_WRITE_ALLOWED_ORIGINS: STAGING }, () => {
    assert.equal(writesEnabled(STAGING.replace('http:', 'https:')), false);
    assert.equal(writesEnabled('http://another-wordpress-container'), false);
  });
});

test('execution requires a configured long token and an exact bearer value', () => {
  withEnvironment({ REMEDIATION_EXECUTION_TOKEN: undefined }, () => {
    assert.equal(executionAuthorized('Bearer ' + TOKEN), false);
  });
  withEnvironment({ REMEDIATION_EXECUTION_TOKEN: 'short' }, () => {
    assert.equal(executionAuthorized('Bearer short'), false);
  });
  withEnvironment({ REMEDIATION_EXECUTION_TOKEN: TOKEN }, () => {
    assert.equal(executionAuthorized('Bearer ' + TOKEN), true);
    assert.equal(executionAuthorized(undefined), false);
    assert.equal(executionAuthorized(TOKEN), false);
    assert.equal(executionAuthorized('Basic ' + TOKEN), false);
    assert.equal(executionAuthorized('Bearer ' + TOKEN + 'x'), false);
    assert.equal(executionAuthorized('Bearer ' + 'b'.repeat(64)), false);
  });
});
