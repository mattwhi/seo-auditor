# v1.2.3 — Evidence-backed Competitor Intelligence

- Additive `IntelligenceSerpObservation` Prisma table and migration.
- Authenticated, project-scoped SERP evidence import (up to 250 records per request), source/date/position validation, and competitor-domain URL validation.
- Competitor keyword comparisons against existing first-party Search Console observations, with explicit uncertainty labels and heuristic prioritisation.
- No SERP provider is connected: import externally sourced, licensed or manually verified observations. No live scraping, search-volume, or keyword-difficulty claims.
- Dashboard shows up to 100 comparison rows; analysis queries cap at 3,000 competitor and 5,000 own observations and warn when capped.
- Deployment script now verifies a database backup and runs the existing `migrate` maintenance service before updating web/api/worker containers.

## Production precautions

1. Confirm `.env.production` and production `DATABASE_URL` point at the intended DB.
2. Confirm `compose.ghcr.yml` exists on the VM (existing deployment requirement) and the migration service is present in the final Compose configuration.
3. Run a staging deployment and inspect `prisma migrate status` first. This release adds a new migration.
4. Do not use `prisma db push` or `prisma migrate reset`.
5. Import format: `competitor-domain,keyword,position,YYYY-MM-DD,optional-result-url` (no quoted commas). Source is entered separately.

## Limits

- This release does not yet implement automatic provider integration, SERP scheduling, content crawling or full historical charts. The imported dated records are retained for future time-series features.
- Source names are user-supplied provenance labels, not independently verified.
- Own GSC average positions and competitor SERP positions are not equivalent metrics.
