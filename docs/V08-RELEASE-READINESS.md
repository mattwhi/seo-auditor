# v0.8 release readiness — WordPress / WooCommerce remediation

## Included in this source archive

- WordPress detection, read-only connection, page-to-object mapping and SEO previews.
- Operator-gated proposals, approval/rejection, and read-only preflight snapshots.
- Explicitly gated execution and rollback using independent bearer credentials, an exact-origin write allowlist, and a second WordPress bridge write gate.
- Preflight age, conflict, latest-snapshot, approved-status and verified-rollback safeguards.
- API unit tests plus Fastify `app.inject()` HTTP authentication/request-validation tests.
- Test-safe startup: importing the app under `NODE_ENV=test` does not listen, run maintenance or initialise Redis.

## Before tagging v0.8 as released

Run on a clean checkout with Node 22 and pnpm 10:

```sh
pnpm install --frozen-lockfile
pnpm db:generate
pnpm build
pnpm --filter @seo-auditor/api test
pnpm test
pnpm typecheck
```

The HTTP tests intentionally stop before database access; they are **not** proof of successful writes or rollback. Complete and record staging-only end-to-end tests with a disposable WordPress installation, including:

1. Reject absent/wrong bearer tokens and invalid confirmation bodies.
2. Reject unapproved proposals, stale/conflicting/superseded preflights, changed target mappings and changed metadata.
3. Verify exactly one write is made with a fresh approved preflight; reject duplicate or concurrent submissions.
4. Verify the written Rank Math metadata, then rollback and verify the original metadata is restored.
5. Simulate a bridge timeout/ambiguous write and confirm `needs_review` rather than automatic retry.
6. Test the bridge's separate write gate, scope/allowlist, credentials, and disabled-by-default behavior.
7. Validate Docker Compose overrides and secret mounts on a staging VM without touching production.

Do **not** set `REMEDIATION_WRITES_ENABLED=true` for a production origin until the above tests and security review are complete. This archive does not change any deployment secrets, Compose settings or production WordPress site.

## Known limitation

The API does not currently have database-backed route integration tests using isolated PostgreSQL fixtures or an automated WordPress bridge integration harness. Treat the HTTP tests as authentication and input-validation coverage, not full remediation acceptance tests.
