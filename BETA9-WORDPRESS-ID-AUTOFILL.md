# v1.1.0-beta.9 — WordPress ID auto-resolution patch

The Remediation workspace now uses the existing read-only `GET /api/v1/audits/:auditId/wordpress/issue-mapping?issueId=...` endpoint whenever an audit finding is selected.

- Exactly one URL-verified WordPress page, post or WooCommerce product is auto-populated, including content type and numeric ID.
- Ambiguous matches are presented for explicit selection. No-match and failed lookups block proposal creation rather than guessing IDs.
- The existing API-side proposal validation remains authoritative. This does not grant WordPress write access or change the approval, preflight, execution or rollback safeguards.
- Category/product-category archives still require separate taxonomy-aware remediation support and are not guessed as page IDs.

## Validate on Mac

`corepack pnpm install --frozen-lockfile && corepack pnpm typecheck && corepack pnpm test && corepack pnpm build`

Test an exact-match page, a post, a product, a non-mappable archive and an unavailable REST API. Confirm selecting a different issue clears the old ID immediately.

This package is a feature patch for the existing beta.9, not a verified production release. The build and tests have not been run in this environment.
