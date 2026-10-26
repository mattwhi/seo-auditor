# SEO Auditor v1.2.1.1 — Keyword Intelligence Improvements

- Dark-theme contrast, consistent panels and readable typography.
- Read-only Search Console keyword explorer with opportunity and all-rows tabs.
- Adaptive candidate discovery: low CTR, striking distance, page two, and emerging low-volume queries.
- Search, minimum impressions, type filters, and sorting.
- Consolidated historical root Markdown into `docs/PROJECT-DOCUMENTATION.md`. GitHub operational documents remain at root.
- **No Prisma schema changes or new migrations**. Existing migrations retained verbatim.

## Safe installation

Extract to a NEW folder, never overwrite the running repository blindly. Review diffs and copy only intended source changes. Do not run `prisma db push`, `prisma migrate reset`, or new migrations for this release.

```bash
pnpm install --frozen-lockfile
pnpm --filter @seo-auditor/intelligence test
pnpm build
pnpm typecheck
```

The Search Console API returns up to 1,000 query/page rows. The opportunity classification is heuristic, not a promise of traffic uplift. Historical migration status may still report the missing `20261013113000_reconcile_v1_schema` file; this release does not alter migration history.
