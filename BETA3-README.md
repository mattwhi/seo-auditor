# SEO Auditor v1.1.0-beta.3 — Crawler administration controls

This is an incremental release, **not** the completed centralised infrastructure administration programme.

## Implemented
- Admin Settings now provides bounded controls for maximum pages per audit, request timeout and retry count, in addition to existing concurrency, delay, performance and invitation controls.
- API reads max-pages setting when enqueueing each new audit. Worker reads timeout/retries/concurrency/delay settings when starting each audit.
- Values are persisted in the existing ApplicationSetting table and audited by the existing admin settings endpoint. No new Prisma migration.
- Existing infrastructure ceilings remain authoritative (`Math.min` for limits; `Math.max` for polite delay).
- Infrastructure status language clarified; deployment restrictions have **not** been removed.

## Not included yet
- WordPress infrastructure write enablement, origin allowlists, approval workflow, secret storage, Google integration configuration, distributed auth hardening, deployment pipeline changes.
- Admin settings are not a replacement for GitHub-managed secrets or security boundaries.

## Mac validation
1. Ensure DATABASE_URL points to a disposable local database.
2. `corepack pnpm install --frozen-lockfile` (if dependencies are not installed).
3. `corepack pnpm typecheck && corepack pnpm test && corepack pnpm build`.
4. Run app locally and change the three new crawler settings in `/admin/settings`; confirm a new audit honours them and audit history records changes.
5. Keep production Ubuntu and GitHub deployment unchanged. Do not merge to main (auto-deploy workflow remains).
