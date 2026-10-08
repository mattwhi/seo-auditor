# v0.8.3 — Read-only remediation preflight (safe foundation)

This release adds operator-protected preflight, immutable snapshots, and change/conflict detection to approved proposals. **It does not add live WordPress writes, rollback, or an execution endpoint.** Do not call this a complete remediation execution engine.

The existing WordPress Application Password integration can resolve posts/pages/products, but WordPress REST often hides Rank Math private metadata. In that case the preflight fails closed with `seo_metadata_not_exposed` (HTTP 409). This is intentional. Never infer an empty SEO description from absent REST metadata.

## API

All requests require the existing `Authorization: Bearer <operator-token>` header.

- `POST /api/v1/wordpress/proposals/:proposalId/preflight` — revalidate exact mapping; read metadata; snapshot and hash; compare with previous preflight.
- `GET /api/v1/wordpress/proposals/:proposalId/preflights` — list read-only preflight history.

A successful preflight returns `executable: false`. The first verified snapshot returns `ready_for_review`; a changed value on subsequent preflight returns `conflict`. No API route writes WordPress.

## Database and deployment

New Prisma model: `RemediationPreflight`. Review the schema change and run your established additive schema deployment; do not reset the database or use `--accept-data-loss`. The production deploy already runs a migration/db-push stage. Keep existing secrets and Compose overrides on the VM.

## Next gate before write-enabled remediation

A separately installed and reviewed WordPress plugin bridge must expose only explicit allowlisted Rank Math keys to an authenticated API, with write permissions, original-value capture, compare-and-swap semantics, idempotency keys, independent execution authorisation, and tested rollback. Test against staging first. Do not enable production writes from this release.
