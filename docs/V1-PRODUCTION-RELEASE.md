# v1.0.0-rc.1 — production-readiness candidate (NOT approved for public launch)

This release candidate is based on v0.8.5-rc.2. It adds a fail-closed dashboard Basic authentication gate in production and an optional hardened Compose overlay. It is **not** evidence of end-to-end production readiness.

## Security boundaries

- Set `SEO_AUDITOR_DASHBOARD_USER` and a unique `SEO_AUDITOR_DASHBOARD_PASSWORD` (minimum 24 characters) in the **web** service. Without them, the production dashboard returns HTTP 503.
- Always use HTTPS at the reverse proxy. Basic credentials are not encrypted without TLS. Add rate limiting and preferably SSO or identity-aware access at the reverse proxy for internet exposure.
- `compose.production.yml` binds API and web to loopback and removes PostgreSQL/Redis published ports. Ensure no other Compose override added *after* this file reopens ports. `docker compose config` must be reviewed before deployment.
- The backend API has no general-purpose authentication for project/audit endpoints. **Never expose API port 4012 publicly.** Access through the authenticated web app only. Other ingress paths, tunnels and network interfaces must also be checked.
- Remediation API writes remain disabled. Keep `REMEDIATION_WRITES_ENABLED=false`, do not allow a production origin, and retain the WordPress bridge `SEO_AUDITOR_BRIDGE_WRITES_ENABLED=false`.
- Existing remediation UI session authentication remains separate from the dashboard authentication.
- Do not put passwords in Compose YAML, Git or release archives. Use environment injection or secret management.

## Migration safety

- The overlay switches the migrate job from `prisma db push` to `prisma migrate deploy`. The release includes eight migrations: seven existing migrations and `20261013140000_enforce_xrobots_not_null`. Confirm the seven existing migrations are applied on Ubuntu, check that `Page.xRobotsTag` contains no NULL values, and take a verified backup before applying the eighth migration. After deployment, verify migration status and schema consistency.
- Back up PostgreSQL and test restore before deployment. Never use `prisma migrate reset` or `db push` in production.
- Check the fully merged Compose configuration with the exact set/order of files used by the deployment. This overlay must be last.

## Required acceptance tests before promoting to v1.0.0

1. Clean install on a disposable database using `prisma migrate deploy`.
2. Verify dashboard returns 503 with missing credentials, 401 for incorrect credentials, and works over HTTPS with correct credentials.
3. Verify direct external access to API/PostgreSQL/Redis is blocked, including IPv6 and reverse proxy paths.
4. Create project → crawl → audit completion → inspect issues/pages/scores → compare two audits.
5. Verify crawl restrictions, rate limits, timeouts, robots handling and SSRF resistance against private/metadata addresses.
6. Verify concurrent audits, queue restart, worker failure and recovery; confirm no stranded audits.
7. Test PostgreSQL backup and restore, logging, monitoring, alerts and upgrade/rollback.
8. Run all tests, typecheck, build, and an isolated end-to-end acceptance suite.
9. Confirm both remediation write gates disabled; do not test writes against the live WordPress site.

## Deployment warning

This source archive is a **release candidate** for controlled staging evaluation, not a validated production release. Do not replace the existing Ubuntu checkout with this archive or run `git clean` on that server; it contains untracked deployment configuration and secrets.
