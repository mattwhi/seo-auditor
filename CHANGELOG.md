# Changelog

## [Unreleased]

### Added

- v0.3 Slice 4 browser workflow for creating projects, launching audits, polling active audits and reviewing crawl results.
- Audit dashboard with score, page/finding counts, severity breakdown, rule summaries, page results and deterministic finding evidence.
- Same-origin Next.js API proxy for browser-safe access to the internal API service.
- Project audit history API used by the dashboard.

### v0.3 SEO Rule Engine

- Added core technical SEO rules for HTTP status, redirects, metadata, headings, indexability and canonical evidence
- Persist page facts and their rule findings atomically so partial page analysis cannot leave orphaned results
- Reset persisted audit results before a BullMQ retry so reruns are idempotent
- Added paginated audit page/finding APIs plus severity, category and rule summaries for the dashboard
- Added per-page finding retrieval for evidence drill-down
- Added a validated rule registry with stable namespaced ID enforcement
- Added a deterministic rule execution engine
- Added fail-fast validation that finding ID, severity and category match rule metadata
- Added dedicated rule-engine contract tests and expanded rule authoring documentation

## [0.2.1] - 2026-10-07

- Updated the web milestone page to reflect the completed v0.2 crawler release
- Updated the next milestone to the v0.3 SEO Rule Engine
- Changed API health version reporting to derive from the API package version instead of a hard-coded value
- Aligned workspace package versions at 0.2.1

## [0.2.0] - 2026-10-07

- Added conservative URL normalization and same-origin crawl controls
- Added robots.txt parsing and enforcement with Allow/Disallow precedence
- Added sitemap and sitemap-index discovery
- Added bounded crawl depth, URL budgets and queue controls
- Added page-level concurrency and configurable request-rate limiting
- Added bounded retries, Retry-After handling and persisted crawl failures
- Added manual redirect handling, redirect-chain evidence and loop protection
- Added persisted SEO-relevant HTTP response metadata and crawl evidence
- Expanded crawler coverage to 55 automated tests

## [0.1.0] - 2026-10-07

- Industrialized monorepo foundation
- API, web and worker boundaries
- Stable SEO rule contracts
- PostgreSQL and Redis infrastructure
- Initial rules and tests
