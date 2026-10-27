# v1.2.2 — Competitor Intelligence

## Scope

- Project-scoped competitor watchlist at `/intelligence/competitors`.
- Authenticated GET, POST, DELETE endpoints at `/api/intelligence/competitors`.
- Mutation requires an authenticated ADMIN or USER session and same-origin request; READ_ONLY users can view only.
- Strict domain-only validation; rejects URL paths, credentials, ports, queries, and fragments.
- Up to 20 competitors per project, with unique `(projectId, domain)` enforced by the existing database schema.
- No database migrations or schema changes. Existing `IntelligenceCompetitor` table from v1.2.0 is reused.

## Evidence limitations

Google Search Console provides only verified-property data, not competitor traffic or private keyword rankings. This version intentionally does not fabricate competitor overlap, market share, rankings, or traffic estimates. The watchlist prepares for a future evidence-backed provider integration. No competitor-site scraping is performed.

## Installation

Merge this release into the existing repository after comparing files; do not overwrite `.env` or database files. Run `pnpm install --frozen-lockfile`, `pnpm build`, `pnpm typecheck`, and `pnpm test`. No Prisma migration is required.

## Validation

- Sign in and open `/intelligence/competitors`.
- Add a domain for one project; confirm it does not appear in another project.
- Duplicate entry should return `competitor_exists`.
- A read-only user should be unable to add or delete competitors.
- Remove a competitor and verify it disappears after refreshing.
- Confirm existing Keyword Opportunities screen still works.

## Migration-history note

Existing deployments may still have the historical `20261013113000_reconcile_v1_schema` discrepancy. This release does not modify Prisma migration history.
