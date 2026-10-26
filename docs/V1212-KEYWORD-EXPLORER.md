# v1.2.1.2 — Keyword Explorer improvements

## Changes
- All Search Console query/page observations shown by default, sorted by impressions.
- Pagination (25 records per page) with previous/next navigation.
- Ranking position distribution for 1–10, 11–20, 21–50, and 51+.
- Topic filter and topic column using transparent rule-based keyword grouping.
- Impression-based confidence labels (Low <30, Medium 30–99, High 100+); these are indicative and not statistical confidence intervals.
- Opportunity tab remains available with priority sorting.

## Database and deployment
No Prisma schema modifications or migrations are introduced in this release. Existing v1.2.0 migrations remain in the full repository package. Do not run `prisma db push` or reset the database.

## Validation
Run `pnpm install --frozen-lockfile`, `pnpm build`, `pnpm typecheck`, and `pnpm --filter @seo-auditor/intelligence test` in your environment.

## Limitations
GSC observations are query/page rows, not distinct keywords; data can be incomplete or anonymised. Topic grouping is heuristic, and confidence labels reflect impressions only.
