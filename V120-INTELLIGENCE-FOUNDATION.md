# v1.2.0 Intelligence Foundation — initial implementation

This change is additive and advisory-only. It adds three Prisma models and a pure `@seo-auditor/intelligence` package with deterministic opportunity scoring, fingerprints, and conservative Search Console candidate selection. No web routes, background jobs, external crawls or WordPress writes are enabled in this release.

## Safety and rollout

1. Take and verify a PostgreSQL backup before changing the database.
2. Review the new SQL in `packages/database/prisma/migrations/20261026150000_intelligence_foundation/migration.sql` and reconcile existing migration history. **Do not run `prisma db push`, `--accept-data-loss`, or `migrate reset`.**
3. Validate Prisma (`pnpm --filter @seo-auditor/database exec prisma validate`) and run tests (`pnpm --filter @seo-auditor/intelligence test`).
4. Only after reviewing the entire migration history, apply pending migrations explicitly in a controlled maintenance window. `prisma migrate deploy` applies *all pending migrations*, not just this one.
5. Keep the Compose migration service disabled by default. New intelligence records must never initiate WordPress remediation.

## Next steps

Add authenticated project-scoped API endpoints, a Search Console observation import job with quotas and date-window provenance, and a read-only dashboard. Validate/normalise competitor domains and require operator selection before competitor crawling.

## Migration history compatibility

An existing installation may contain the historical migration
`20261013113000_reconcile_v1_schema` in `_prisma_migrations`
without a corresponding migration directory in this repository.

The v1.2.0 migration chain was validated against the current Prisma
schema. Both v1.2.0 migrations were successfully applied to a restored
database and the existing working database, preserving project data.

The historical migration discrepancy remains unresolved. Prisma
`migrate status` may report divergent migration histories.

Do not run `prisma migrate reset` or modify historical migration
checksums to suppress this warning. Recover and verify the original
migration before considering the history fully reconciled.
