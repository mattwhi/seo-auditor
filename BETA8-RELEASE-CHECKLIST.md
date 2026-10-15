# v1.1.0-beta.8 — Release verification

## Completed in this candidate
- Fixed the empty web test suite with route-level security regression checks.
- Removed obsolete Google status helper that ignored database mappings.
- Added explicit Google disabled/missing-credential diagnostic in API status.
- Removed automatic production deployment from main branch CI.
- Added manually triggered production deployment for an immutable published commit SHA.
- Updated application version strings to beta.8.

## Must verify before production approval
1. On the Mac: `corepack pnpm install --frozen-lockfile`, `corepack pnpm typecheck`, `corepack pnpm test`, `corepack pnpm build`.
2. Run a full read-only audit and confirm existing project history and migrations remain intact.
3. Test WordPress REST discovery; authentication for protected content is separate.
4. Configure Google API service account securely **on the API service**, grant the account access to the GSC property and GA4 property, set `GOOGLE_INTEGRATIONS_ENABLED=true` for API, then test both from Admin. Saving property IDs alone cannot enable Google.
5. Provision the **same** strong `REMEDIATION_OPERATOR_TOKEN` on web and API services to enable proposal review; a separate `REMEDIATION_EXECUTION_TOKEN` is required on web and API for execution. Keep `REMEDIATION_WRITES_ENABLED=false` until execution/preflight/rollback are validated. Never put tokens in source or browser.
6. Confirm GitHub Production environment approvals, GHCR image publication, deployment SSH secrets, and remote `/opt/seo-auditor/deploy-ghcr.sh` exist. The remote script is NOT included in this source and must be independently reviewed.
7. Confirm compose overlays, localhost port bindings, database backups, Prisma migration strategy, and rollback with a previous image SHA.
8. Confirm authentication hardening (rate limiting, session handling) and API endpoint authorization before exposing publicly.

## Limitations
- No encrypted credential upload UI is implemented; credentials remain infrastructure-managed.
- This release candidate is not certified production-ready without live environment and end-to-end verification.
- The new tests assert key route protections exist; they are not a substitute for integration tests.
