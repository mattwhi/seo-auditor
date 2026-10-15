# v1.1.0-beta.9 — Remediation session integration

- Removes manually provisioned remediation operator/execution tokens from the browser-to-API remediation flow.
- Next.js verifies the logged-in administrator, then forwards their opaque session to the API over the internal network. The API independently hashes and validates the session against PostgreSQL, including expiration, disabled account and ADMIN role.
- Existing deployment write restrictions, WordPress origin allowlist, project policy, approval/preflight and rollback eligibility checks remain enforced.
- Manual deployment workflow selects a previously published immutable SHA image. CI publishes on main only after validation; does not auto-deploy.

## Outstanding before production

1. Run full pnpm lint/typecheck/test/build and live role/session revocation tests on Mac.
2. Review API network isolation and ensure sessions are never logged, forwarded outside the trusted internal network, or exposed to third parties.
3. Validate Google credentials and access to actual GSC and GA4 properties.
4. Validate WordPress write path on a dedicated staging site with rollback; production writes remain off until separately approved.
5. Verify release deployment, database migrations, health checks and rollback through GitHub Actions.
6. Existing legacy execution-token unit tests cover the old standalone security helper, not the new session flow; replace with database-backed integration tests before declaring production-ready.
