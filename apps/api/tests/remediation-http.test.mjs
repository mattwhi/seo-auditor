import test, { after } from 'node:test';
import assert from 'node:assert/strict';

// This suite exercises Fastify's real router and validation pipeline without
// opening a TCP listener, contacting WordPress, or connecting to PostgreSQL/Redis.
// It intentionally tests only requests rejected before any database access.
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL ??= 'postgresql://test:test@127.0.0.1:5432/seo_auditor_test';
process.env.REDIS_URL ??= 'redis://127.0.0.1:6379';
process.env.REMEDIATION_WRITES_ENABLED = 'false';
const { app } = await import('../dist/index.js');
after(async () => { await app.close(); });

test('health responds without database or Redis', async () => {
  const res = await app.inject({ method: 'GET', url: '/health' });
  assert.equal(res.statusCode, 200);
});

test('all remediation endpoints reject missing or malformed sessions', async () => {
  const endpoints = [
    ['GET', '/api/v1/projects/project-test/wordpress/proposals'],
    ['POST', '/api/v1/projects/project-test/wordpress/proposals'],
    ['POST', '/api/v1/wordpress/proposals/proposal-test/preflight'],
    ['GET', '/api/v1/wordpress/proposals/proposal-test/preflights'],
    ['GET', '/api/v1/wordpress/proposals/proposal-test/execution'],
    ['POST', '/api/v1/wordpress/proposals/proposal-test/approve'],
    ['POST', '/api/v1/wordpress/proposals/proposal-test/reject'],
    ['POST', '/api/v1/wordpress/proposals/proposal-test/execute'],
    ['POST', '/api/v1/wordpress/proposals/proposal-test/rollback'],
  ];
  for (const [method, url] of endpoints) {
    for (const headers of [undefined, { authorization: 'Bearer invalid' },
      { authorization: 'Bearer old-operator-token' }]) {
      const res = await app.inject({ method, url, headers, payload: method === 'POST' ? {} : undefined });
      assert.equal(res.statusCode, 401, `${method} ${url}: ${res.body}`);
    }
  }
});

// The operator session alone must never authorize a write. This suite cannot
// mint a real admin session without a database, so token logic is separately
// covered by remediation-security.test.mjs.
