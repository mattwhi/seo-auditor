import test, { after } from 'node:test';
import assert from 'node:assert/strict';

// This suite exercises Fastify's real router and validation pipeline without
// opening a TCP listener, contacting WordPress, or connecting to PostgreSQL/Redis.
// It intentionally tests only requests rejected before any database access.
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL ??= 'postgresql://test:test@127.0.0.1:5432/seo_auditor_test';
process.env.REDIS_URL ??= 'redis://127.0.0.1:6379';
process.env.REMEDIATION_WRITES_ENABLED = 'false';
process.env.REMEDIATION_EXECUTION_TOKEN = 'integration-test-execution-token-' + 'x'.repeat(48);
process.env.REMEDIATION_OPERATOR_TOKEN = 'integration-test-operator-token-' + 'y'.repeat(40);

const { app } = await import('../dist/index.js');
after(async () => {
  await app.close();
});

const executeUrl = '/api/v1/wordpress/proposals/proposal-test/execute';
const rollbackUrl = '/api/v1/wordpress/proposals/proposal-test/rollback';
const operatorUrl = '/api/v1/projects/project-test/wordpress/proposals';
const preflightUrl = '/api/v1/wordpress/proposals/proposal-test/preflight';
const operatorToken = process.env.REMEDIATION_OPERATOR_TOKEN;
const executionToken = process.env.REMEDIATION_EXECUTION_TOKEN;

async function expectResponse({ method, url, headers, payload }, status, error) {
  const response = await app.inject({ method, url, headers, payload });
  assert.equal(response.statusCode, status, `${method} ${url}: ${response.body}`);
  assert.equal(response.json().error, error);
}

test('health endpoint responds without a database or Redis connection', async () => {
  const response = await app.inject({ method: 'GET', url: '/health' });
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().status, 'ok');
});

test('execution and rollback require independent execution credentials', async () => {
  for (const url of [executeUrl, rollbackUrl]) {
    for (const headers of [undefined, { authorization: 'Bearer invalid' }, { authorization: `Bearer ${operatorToken}` }]) {
      await expectResponse({ method: 'POST', url, headers, payload: {} }, 401, 'execution_unauthorized');
    }
  }
});

test('operator-only proposal, preflight and execution reads reject missing or execution credentials', async () => {
  for (const [method, url] of [
    ['GET', operatorUrl],
    ['POST', operatorUrl],
    ['POST', preflightUrl],
    ['GET', '/api/v1/wordpress/proposals/proposal-test/preflights'],
    ['GET', '/api/v1/wordpress/proposals/proposal-test/execution'],
    ['POST', '/api/v1/wordpress/proposals/proposal-test/approve'],
    ['POST', '/api/v1/wordpress/proposals/proposal-test/reject'],
  ]) {
    for (const headers of [undefined, { authorization: `Bearer ${executionToken}` }]) {
      await expectResponse({ method, url, headers, payload: method === 'POST' ? {} : undefined }, 401, 'operator_unauthorized');
    }
  }
});

test('valid execution credential does not bypass strict confirmation and request validation', async () => {
  const headers = { authorization: `Bearer ${executionToken}` };
  await expectResponse({ method: 'POST', url: executeUrl, headers, payload: {} }, 400, 'invalid_execution_request');
  await expectResponse({ method: 'POST', url: executeUrl, headers, payload: { preflightId: 'preflight-1', confirm: 'WRONG' } }, 400, 'invalid_execution_request');
  await expectResponse({ method: 'POST', url: executeUrl, headers, payload: { preflightId: 'preflight-1', confirm: 'EXECUTE_APPROVED_REMEDIATION', extra: true } }, 400, 'invalid_execution_request');
  await expectResponse({ method: 'POST', url: rollbackUrl, headers, payload: {} }, 400, 'invalid_rollback_request');
  await expectResponse({ method: 'POST', url: rollbackUrl, headers, payload: { confirm: 'WRONG' } }, 400, 'invalid_rollback_request');
  await expectResponse({ method: 'POST', url: rollbackUrl, headers, payload: { confirm: 'ROLLBACK_REMEDIATION', extra: true } }, 400, 'invalid_rollback_request');
});

test('operator credentials do not bypass proposal request validation', async () => {
  const headers = { authorization: `Bearer ${operatorToken}` };
  await expectResponse({ method: 'POST', url: operatorUrl, headers, payload: {} }, 400, 'invalid_proposal');
});
