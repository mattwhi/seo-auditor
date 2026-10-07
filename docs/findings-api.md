# Findings API

v0.3 persists deterministic rule findings alongside each crawled page and exposes them for dashboard consumers.

## Audit findings

`GET /api/v1/audits/:auditId/issues`

Optional query parameters: `severity`, `category`, `ruleId`, `pageId`, `limit` (1-500) and `offset`.

## Finding summary

`GET /api/v1/audits/:auditId/issues/summary`

Returns total findings plus counts grouped by severity, category and rule ID. This endpoint is intended to power audit overview cards and issue navigation without downloading every finding.

## Audit pages

`GET /api/v1/audits/:auditId/pages`

Returns paginated page evidence with an issue count per page.

## Page findings

`GET /api/v1/pages/:pageId/issues`

Returns the page identity and its deterministic findings/evidence for drill-down views.

## Persistence guarantees

A page and all findings produced from its `PageFacts` are committed in one database transaction. Audit-job retries clear prior pages, findings and crawl failures before restarting, preventing retry attempts from accumulating duplicate audit evidence.
