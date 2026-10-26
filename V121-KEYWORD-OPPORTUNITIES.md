# v1.2.1 — Google Search Console Keyword Opportunities

## What changes

- Adds **Intelligence** to the authenticated main navigation.
- Adds `/intelligence` for per-project, date-range Search Console keyword/page analysis.
- Adds a read-only API endpoint: `GET /api/v1/projects/:projectId/intelligence/keyword-opportunities?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD`.
- Uses the v1.2.0 `@seo-auditor/intelligence` scoring/candidate engine; reports low-CTR and striking-distance keywords.
- Uses existing encrypted Google service account credentials and project integration mapping.
- No new Prisma models, migrations, `db push`, table changes, or automatic remediation.

## Install safely

This archive is a **complete sanitized repository snapshot**, not a partial overlay. It deliberately excludes local `.env*`, credentials, database backups, `.git`, `node_modules`, `.next`, build outputs and caches. **Do not unzip over your existing working tree.** Extract to a new directory and merge the changes with Git after reviewing differences. Preserve your current `.env` files and database.

1. Make a separate Git branch from your working repository, commit/stash existing changes, and compare this snapshot against that branch.
2. Copy only the changed v1.2.1 files (listed below), or merge the full snapshot using Git after review.
3. Run `pnpm install --frozen-lockfile`, `pnpm build`, `pnpm typecheck`, `pnpm --filter @seo-auditor/intelligence test`.
4. Start existing services normally. **No database migration is required for v1.2.1.**
5. Visit `/intelligence`, select a project with an existing Search Console property and Google credentials, then analyse.

## Changed files

- `apps/api/src/google.ts`
- `apps/api/src/index.ts`
- `apps/api/package.json`
- `apps/web/app/components/AppNavigation.tsx`
- `apps/web/app/intelligence/page.tsx` (new)
- `apps/web/app/intelligence/intelligence.css` (new)
- `pnpm-lock.yaml`
- `V121-KEYWORD-OPPORTUNITIES.md` (new)

## Important limitations

- Read-only live report, **not** a historical database sync. v1.2.0 tables remain available for a future controlled ingestion workflow.
- Up to 1,000 GSC rows are fetched; Google may omit anonymised queries. Do not interpret these as complete property totals.
- Candidate rules: at least 100 impressions, average position 3–20, CTR below 2%; prioritisation is heuristic, not predicted traffic uplift.
- The existing internal API architecture must remain private behind the authenticated web frontend; the backend endpoint itself follows existing service conventions and does not implement independent end-user authentication.
- The previously documented missing historical Prisma migration remains unresolved; do not run `prisma migrate reset` or rewrite migration history.
