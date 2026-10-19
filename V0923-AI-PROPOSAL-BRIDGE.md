# v0.9.2.3 — AI approval to WordPress draft proposal

## Added
- Admin-only API `POST /api/v1/projects/:projectId/ai/reviews/:reviewId/proposal`.
- Separate "Create WordPress draft" action on approved AI reviews.
- Only approved `title` or `metaDescription` suggestions with one of the supported title/description issue IDs are eligible.
- The API verifies a matching stored audit issue, the AI-reported before value against the saved crawl snapshot, WordPress configuration, and a unique verified WordPress target.
- Reuses existing `RemediationProposal` model and sets `status: draft`. No live write or automatic approval.
- Existing identical non-rejected proposal is returned rather than creating a duplicate (best-effort check).

## Deliberate restrictions
- H1, images, links, schema, content and suggestions without a matching audit issue are not auto-converted.
- Ambiguous WordPress mapping requires manual intervention.
- The current API does not yet perform a fresh live WordPress SEO value preflight during proposal creation. Use the existing remediation preflight before execution.
- Proposal creation and approval are distinct actions. Never auto-publish.

## Validation on developer machine
`pnpm install && pnpm build && pnpm typecheck && pnpm test && pnpm lint`
No Prisma schema migration is needed for this change.
Keep `.env`, `.env.production`, keys and local Git history from your existing checkout. Do not replace them with files from this archive.
