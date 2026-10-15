# SEO Auditor v1.1.0-beta.2 — Centralised operational controls

## Implemented
- Admin-only `/admin/settings` for crawler page concurrency, crawl delay, performance enable/max pages, invitation expiry.
- Database-backed validated settings with immutable admin audit events.
- Worker reads current settings for each new audit; invitations read expiry on creation.
- Infrastructure caps and permission gates remain authoritative.

## Important limitations
- This is a first **operational settings** slice, not a complete infrastructure management UI.
- WordPress per-project permissions remain at `/admin/wordpress`. No UI control bypasses `REMEDIATION_WRITES_ENABLED`, execution tokens, or origin allowlists.
- Performance setting only works when `PERFORMANCE_ENABLED=true` in infrastructure.
- Credentials, GitHub Actions, Compose, Docker, encryption keys and database connection are deliberately not editable in the app.
- Existing crawler settings not covered by this slice remain configuration-driven.
- Worker-level BullMQ concurrency is startup-only and is not controlled here.
- GitHub deployment workflows are not modified; do not merge into main until deployment is decoupled.

## Mac checks
Load local DATABASE_URL first, then:
```sh
corepack pnpm --filter @seo-auditor/database exec prisma migrate deploy
corepack pnpm --filter @seo-auditor/database exec prisma generate
corepack pnpm typecheck
corepack pnpm test
corepack pnpm build
```
Test `/admin/settings` as ADMIN and READ_ONLY; verify audit events, new invitation expiry and worker settings.
