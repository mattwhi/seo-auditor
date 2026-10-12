import test from 'node:test';
import assert from 'node:assert/strict';

import {
  proposalExecutionError,
  preflightExecutionError,
  rollbackEligibilityError,
  PREFLIGHT_MAX_AGE_MS,
} from '../dist/remediation-validation.js';

test('only approved proposals can execute', () => {
  assert.equal(proposalExecutionError('approved'), null);
  assert.equal(proposalExecutionError('draft'), 'proposal_not_approved');
  assert.equal(proposalExecutionError('rejected'), 'proposal_not_approved');
  assert.equal(proposalExecutionError('executed'), 'proposal_not_approved');
});

test('valid and current preflight is accepted', () => {
  const now = Date.now();
  const preflight = {
    proposalId: 'proposal-1',
    conflict: false,
    createdAt: new Date(now - 60_000),
  };

  assert.equal(
    preflightExecutionError(preflight, 'proposal-1', 'preflight-1', 'preflight-1', now),
    null,
  );
});

test('conflicting or mismatched preflights are rejected', () => {
  const now = Date.now();
  const preflight = {
    proposalId: 'proposal-1',
    conflict: false,
    createdAt: new Date(now),
  };

  assert.equal(
    preflightExecutionError(null, 'proposal-1', 'preflight-1', 'preflight-1', now),
    'invalid_preflight',
  );

  assert.equal(
    preflightExecutionError({ ...preflight, conflict: true }, 'proposal-1', 'preflight-1', 'preflight-1', now),
    'invalid_preflight',
  );

  assert.equal(
    preflightExecutionError(preflight, 'proposal-2', 'preflight-1', 'preflight-1', now),
    'invalid_preflight',
  );
});

test('expired, future and superseded preflights are rejected', () => {
  const now = Date.now();
  const preflight = {
    proposalId: 'proposal-1',
    conflict: false,
    createdAt: new Date(now),
  };

  assert.equal(
    preflightExecutionError(
      { ...preflight, createdAt: new Date(now - PREFLIGHT_MAX_AGE_MS - 1) },
      'proposal-1', 'preflight-1', 'preflight-1', now,
    ),
    'preflight_expired',
  );

  assert.equal(
    preflightExecutionError(
      { ...preflight, createdAt: new Date(now + 1000) },
      'proposal-1', 'preflight-1', 'preflight-1', now,
    ),
    'preflight_expired',
  );

  assert.equal(
    preflightExecutionError(preflight, 'proposal-1', 'preflight-2', 'preflight-1', now),
    'preflight_not_latest',
  );
});

test('only verified executions can roll back', () => {
  assert.equal(rollbackEligibilityError('verified'), null);
  assert.equal(rollbackEligibilityError('pending'), 'execution_not_verified');
  assert.equal(rollbackEligibilityError('needs_review'), 'execution_not_verified');
  assert.equal(rollbackEligibilityError('rolled_back'), 'execution_not_verified');
  assert.equal(rollbackEligibilityError(null), 'execution_not_verified');
});
