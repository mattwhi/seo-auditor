# Changelog

## [Unreleased]

## [0.3.0] - 2026-10-07

- Added the deterministic SEO Rule Engine with stable namespaced rule IDs, validated rule registration and fail-fast finding contracts.
- Added core technical SEO rules covering HTTP status, redirects, metadata, headings, indexability, canonicals and crawl evidence.
- Persisted page facts and SEO findings atomically, with idempotent audit retries and paginated findings/pages APIs.
- Added the browser audit workflow for project creation, audit execution, live status polling and audit history.
- Added the Results Explorer with Overview, Issues, Pages and Crawl Failures views.
- Added aggregated issue prioritisation, affected-URL drill-down, deterministic evidence, search/filtering, pagination and remediation guidance.
- Added prevalence-aware SEO scoring so repeated findings scale by affected-page coverage rather than forcing large crawls to zero.
- Reclassified intent-dependent noindex findings as informational and suppressed cascading metadata/content findings on noindex, non-HTML and non-success responses.
- Validated the release candidate through repeated end-to-end 224-page real-world audits.
- Promoted v0.3.0 RC1 to the v0.3.0 pre-alpha release with no functional crawler, rule, scoring or dashboard changes.

### v0.3 Slice 5B

- Added issue drill-down workspaces with affected URL tables and deterministic evidence inspection.
- Added human-authored issue titles, Why this matters guidance, and remediation guidance while preserving stable rule IDs.
- Added issue severity/category/search filters, affected-URL search and pagination, and page search/pagination.

### v0.3 development — Slice 5A

- Restructured audit results into Overview, Issues, Pages, and Crawl Failures views.
- Aggregated findings by rule so informational findings no longer dominate the main results view.
- Added crawl-failure API exposure and dashboard reporting.
- Added human-readable issue labels and severity-first prioritisation.

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

## v0.3 development — Slice 5C

- Reworked audit scoring so repeated findings scale by affected-page prevalence instead of forcing large crawls to zero.
- Informational findings no longer reduce the SEO score.
- Reclassified noindex directives as informational because intent cannot be inferred from crawl evidence alone.
- Suppressed missing canonical, metadata, heading and thin-content findings on noindex pages.
- Suppressed page-content SEO rules for non-HTML and non-success responses to reduce cascading false positives.

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
