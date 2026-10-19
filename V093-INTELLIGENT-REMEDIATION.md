# SEO Auditor v0.9.3 — Intelligent Remediation (incremental development build)

## Implemented
- New **Bulk analysis & queue** section within the existing Remediation Centre.
- Select up to 10 not-yet-analysed pages and run the existing authenticated AI analysis endpoint sequentially, with progress, per-project AI settings and quota enforcement on the API.
- Stop the batch on the first failure; previously completed analyses are retained. Reuse existing content-fingerprint cache.
- Consolidated review queue across up to the latest 50 completed analyses returned by the existing API; review records are materialised idempotently via the existing `/reviews` endpoint.
- Search/filter by review decision, editable proposed text, approve/reject, and draft creation for the existing supported WordPress title/meta-description rules.
- No schema change, no new WordPress write path, and no automated publishing.
- Existing **Proposals & verification** tab continues to provide live WordPress preflight, conflict detection, explicit execution approval and recorded execution/rollback verification. This release does not add an independent follow-up crawl verification system.

## Limitations and follow-on work
- Batch processing is sequential in the browser, not a durable background queue. Closing the tab stops future requests but completed analyses remain saved.
- The consolidated queue is limited to 50 recent analyses, not full-project pagination; review counts reflect loaded data.
- For high-volume operation, move batches to BullMQ, add durable job state, rate limiting and server-side paginated review queries.
- A separate **post-fix recrawl and comparison** (new audit versus pre-change baseline) is not yet implemented. Existing verification confirms the WordPress write, not a new search-engine crawl.
- Test on a local/staging database and WordPress instance before production rollout.

## Checks
Run `pnpm install`, `pnpm build`, `pnpm typecheck`, `pnpm test`, `pnpm lint` from the monorepo root. No Prisma migration required.
Keep your existing `.env`, `.env.production`, credentials encryption key, database and volumes. Never copy secrets from a source archive.
