# Architecture

SEO Auditor is API-first and asynchronous. The web application is not privileged; it consumes the same versioned API intended for future CLI and CI clients.

## Boundary rule

The crawler **collects facts** and must not decide whether those facts are good SEO. The rules package **evaluates facts** and must not perform network crawling. This boundary is a core compatibility contract.

## Audit flow

1. API creates an Audit row.
2. API submits an immutable crawl job to Redis/BullMQ.
3. A worker claims the job and updates audit state.
4. Crawler discovers same-origin URLs and extracts page facts through analyzer.
5. Rule registry evaluates each PageFacts object.
6. Page facts and stable rule findings are persisted.
7. Scoring produces an audit score.
8. Future audits compare rule IDs and URLs for regression/fix reporting.

## Scaling

API and web nodes are stateless. Workers may be horizontally scaled. PostgreSQL is authoritative storage; Redis is transient queue infrastructure.
