# Activity archive and remediation proposal management

- Administrative activity is archived, not deleted, after 30 days by default.
- Configure `activity.retentionDays` and `activity.autoArchive` under Administration → Settings → Activity.
- The worker archives on startup and every 24 hours while running. Multiple workers are safe to run; no archive data is purged.
- Administration → Activity has Recent activity and Archive views (latest 200 records in each).
- Unused remediation proposals in draft, approved or rejected state can be permanently deleted by an administrator after confirmation. Proposals with execution history, executed or needs-review status cannot be deleted. Deletion is logged as an administrative event.

## Required database migration

Before running the updated worker or web application, apply the checked-in migration `20261015120000_activity_archival` to the same PostgreSQL database used by the application:

```
pnpm --filter @seo-auditor/database db:generate
pnpm --filter @seo-auditor/database exec prisma migrate deploy
```

Verify `DATABASE_URL` points to the intended environment. Back up production PostgreSQL first. Do not use `prisma migrate reset`.

## Release validation

```
pnpm test
pnpm build
```

This ZIP intentionally excludes `.env` files, `.git`, `node_modules`, `dist` and Next.js build output. Preserve your existing environment secrets and encryption keys. These changes have not been integration-tested against your running environment; deploy to staging and test before production.
