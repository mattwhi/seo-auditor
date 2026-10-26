# SEO Auditor — Consolidated Project Documentation

This document consolidates historical release notes and implementation guides. Original section content is preserved in order; operational root documents (README, SECURITY, CONTRIBUTING and CODE_OF_CONDUCT) remain separate.

## Contents

- 1. ACTIVITY-ARCHIVE-UPDATE.md

- 2. ALPHA2-README.md

- 3. AUTH-ALPHA-README.md

- 4. BETA1-README.md

- 5. BETA10-INTEGRATIONS-NOTES.md

- 6. BETA2-README.md

- 7. BETA3-README.md

- 8. BETA4-README.md

- 9. BETA5-README.md

- 10. BETA6-1-README.md

- 11. BETA6-2-README.md

- 12. BETA6-README.md

- 13. BETA7-README.md

- 14. BETA8-RELEASE-CHECKLIST.md

- 15. BETA9-RELEASE-NOTES.md

- 16. BETA9-WORDPRESS-ID-AUTOFILL.md

- 17. CHANGELOG.md

- 18. FEATURES-RELEASE-NOTES.md

- 19. MULTI-PROJECT-INTEGRATIONS.md

- 20. PROJECT-INTEGRATIONS-SETUP.md

- 21. RELEASE-NOTES-v0.5-final.md

- 22. REMEDIATION-UI-BRIDGE-UPDATE.md

- 23. REPLACEMENT-README.md

- 24. UI-POLISH-README.md

- 25. UI-REFRESH-README.md

- 26. V05-HARDENING-PATCH.md

- 27. V06-FINAL-REFINEMENT.md

- 28. V06-RELEASE-NOTES.md

- 29. V07-RELEASE-NOTES.md

- 30. V08-RELEASE-NOTES.md

- 31. V081-RELEASE-NOTES.md

- 32. V082-RELEASE-NOTES.md

- 33. V083-RELEASE-NOTES.md

- 34. V090-AI-README.md

- 35. V092-AI-REVIEW-README.md

- 36. V0922-AI-WORKSPACE-README.md

- 37. V0923-AI-PROPOSAL-BRIDGE.md

- 38. V0924-UNIFIED-REMEDIATION-README.md

- 39. V0925-ISSUE-AI-FIX-README.md

- 40. V093-INTELLIGENT-REMEDIATION.md

- 41. V0931-WOOCOMMERCE-TAXONOMY.md

- 42. V120-INTELLIGENCE-FOUNDATION.md

- 43. V121-KEYWORD-OPPORTUNITIES.md

- 44. WORDPRESS-CREDENTIAL-RELEASE.md


---

## 1. ACTIVITY-ARCHIVE-UPDATE.md


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


---

## 2. ALPHA2-README.md


# SEO Auditor v1.1.0-alpha.2 — administration (Mac only)

Adds `/admin/users` to list users, assign ADMIN/USER/READ_ONLY roles, disable/reactivate accounts, revoke pending invitations, and view a bounded administration event history. Server-side authorization requires an active ADMIN session; changes require same-origin requests. Disabling an account or changing its role revokes existing sessions. A serializable database transaction protects the last active administrator. Revoked invitations cannot be accepted.

## Mac validation
1. `corepack pnpm install --frozen-lockfile`
2. Confirm DATABASE_URL is **local** (never production).
3. `corepack pnpm --filter @seo-auditor/database exec prisma migrate deploy`
4. `corepack pnpm --filter @seo-auditor/database exec prisma generate`
5. `corepack pnpm typecheck && corepack pnpm test && corepack pnpm build`
6. Test admin changes with two local accounts, verify disabled sessions are rejected, role changes take effect, revoked invitation cannot register, last active admin cannot be disabled or demoted, and read-only/user cannot access `/api/admin/management`.

## Not yet production-ready
The separate API service still requires an independent ingress/auth boundary. Distributed rate limiting, CSRF/origin hardening, mail delivery, password recovery, broad worker-level RBAC and WordPress write controls are future milestones. Production deployment workflow is unchanged. Do not merge to main or deploy to Ubuntu.


---

## 3. AUTH-ALPHA-README.md


# SEO Auditor v1.1.0-alpha.1 — invitation-only authentication

**Source changes only. No production deployment has been performed.**

## Included
- Prisma migration for users, hashed sessions, single-use 48-hour invitations.
- Login, logout, invitation-only account creation, admin invitation-link generator.
- Three initial roles: ADMIN, USER, READ_ONLY. User and admin can mutate general audit API; read-only cannot. Remediation route requires admin *in addition* to its existing operator credential gate.
- Basic Auth dashboard dependency removed from `apps/web/proxy.ts` and `compose.production.yml`.
- Password hashing with salted scrypt; random session and invitation tokens stored only as SHA-256 digests.

## Mac verification (required before release)
1. `corepack pnpm install --frozen-lockfile`
2. `corepack pnpm --filter @seo-auditor/database db:generate`
3. `corepack pnpm typecheck && corepack pnpm test && corepack pnpm build`
4. Against a disposable local PostgreSQL instance, apply migrations using `corepack pnpm --filter @seo-auditor/database exec prisma migrate deploy`.
5. In a **local disposable database only**, bootstrap first admin with `corepack pnpm --filter @seo-auditor/database exec node scripts/bootstrap-admin.mjs`. This is interactive and refuses when any user exists. Do not commit passwords.
6. Exercise login/logout, invalid password, invitation expiry and reuse, role checks and CSRF rejection; verify WordPress writes remain disabled.

## Limitations / blockers before production
- **Not production-ready**: package installation/build/tests were not runnable in this environment (npm registry unreachable). Run Mac/GitHub CI and end-to-end tests.
- No SMTP email provider wired: admin creates one-time invitation URL at `/admin/invitations` and must share it privately. Email delivery and verification remain future work.
- The in-memory login throttle is per-process only; implement Redis-backed distributed rate limiting before exposing publicly.
- Password reset, email verification, MFA, session management UI and comprehensive audit logs remain future work.
- API service may be reachable separately; secure its ingress or enforce authorization at API level before public deployment. Next.js proxy protects only `/api/backend` traffic.
- Admin UI and authorization require additional hardening; frontend cookie presence is navigation only and not proof of session.
- `REMEDIATION_WRITES_ENABLED=false` must remain in the infrastructure overlay. This alpha does not add admin WordPress write toggles.
- Deploy workflow is **unchanged** and currently automatically deploys on merge to main. Do not merge until the release workflow is decoupled and reviewed.
- The first admin bootstrap procedure needs a controlled production migration/initialization plan through GitHub Actions; do not SSH into Ubuntu to bootstrap.


---

## 4. BETA1-README.md


# v1.1.0-beta.1 — WordPress project write controls (first slice)

Mac-only source changes. Do not merge or deploy to production yet.

- Adds a default-disabled database policy per project and admin controls at `/admin/wordpress`.
- API execution AND rollback now require project policy enabled as well as the existing infrastructure flag, origin allowlist, execution token, approval and preflight gates.
- Admin changes are recorded in `DashboardAdminEvent`.
- **Important:** This is not yet the complete RBAC/remediation approval release. The API execution token remains an independent operator capability and is not tied to the dashboard user's identity. The backend API must remain private.
- Rollback is also blocked when policy is off; emergency rollback procedures need explicit design.
- The dashboard's `infrastructureEnabled` status is read from the web container and is informational only; the API container is authoritative.
- No GitHub workflow or production Compose changes in this slice.

Local Mac verification: load LOCAL DATABASE_URL; `corepack pnpm --filter @seo-auditor/database exec prisma migrate deploy`; `corepack pnpm --filter @seo-auditor/database exec prisma generate`; `corepack pnpm typecheck && corepack pnpm test && corepack pnpm build`. Test default-deny execute/rollback and role restrictions before any release.


---

## 5. BETA10-INTEGRATIONS-NOTES.md


# Beta 10 — Google project credentials and WordPress write policies

Administration → Project integrations & secrets now accepts **Google service account JSON** per project, encrypts it using the existing credential encryption key and stores it in PostgreSQL. Search Console and GA4 property IDs remain editable per project. Grant the service account Viewer access to the appropriate Search Console property and GA4 property before running connection tests. The service-account JSON must be created in Google Cloud and the relevant APIs enabled. This is service-account integration, not interactive Google OAuth consent.

WordPress remediation has **no operator-entered remediation key** in this branch: the old execution token was intentionally replaced with an authenticated admin session plus project write policy, proposal approval, preflight, and WordPress bridge write opt-in. See Administration → WordPress write controls. Do not add an execution token to the frontend: it would undermine the session-based design.

**Deployment prerequisites remain:** PostgreSQL and Redis connection settings, and a durable server-side encryption key or persistent secret directory. The key must be shared by web and API processes and backed up; do not rotate it without a credential migration. Run `pnpm --filter @seo-auditor/database db:generate` and apply the schema to the database using your established migration workflow before launching. Existing `needs_review` executions must be reconciled before retrying writes.

No Google API calls or live WordPress writes were performed while preparing this archive.


---

## 6. BETA2-README.md


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


---

## 7. BETA3-README.md


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


---

## 8. BETA4-README.md


# SEO Auditor v1.1.0-beta.4 — Remediation RBAC and release safety

## Included
- Removed the separate remediation UI password and cookie: only an authenticated **ADMIN** dashboard session can access remediation. Operator and execution credentials remain **server-side** and are never returned to the browser.
- Admin activity log at `/admin/activity`, including successful remediation approvals, rejections, preflights, executions and rollbacks.
- CI still validates and publishes immutable GHCR `sha-...` images on `main`, but no longer automatically deploys after merge.
- Manual `workflow_dispatch` deploy requires the full image commit SHA and `DEPLOY` confirmation. To roll back, dispatch the workflow with a previous published SHA. GitHub Production environment approvals remain applicable.

## Important: Not a completed production release
- This is a **beta**; no dependency install, TypeScript, integration or Docker deployment test was run in the generation environment. Run all checks on Mac and in CI.
- The GitHub workflow invokes the **existing** `/opt/seo-auditor/deploy-ghcr.sh` host entrypoint; verify that it uses the correct Compose overlay and `.env.production` before dispatch. This package does not edit the Ubuntu host or rotate credentials.
- WordPress writes still require `REMEDIATION_WRITES_ENABLED=true`, an exact origin allowlist, execution token, per-project admin policy, approved proposal, preflight and WordPress bridge permission. The application cannot override infrastructure safeguards.
- The separate API operator token remains a privileged service credential. API ingress must be restricted; the dashboard session is **not** validated by the API service itself.
- Existing remediation decisions in the API do not persist approver identity in the proposal schema; new web-originated decisions are logged in dashboard admin events. End-to-end identity propagation and durable approval attribution are still required.
- SMTP invitation delivery, distributed login rate limiting, password recovery, MFA, secure credential management, Google integration configuration, and production deployment/rollback verification remain outstanding.

## Mac validation
1. Keep `.env` pointing at the local database.
2. `corepack pnpm install --frozen-lockfile`
3. `corepack pnpm --filter @seo-auditor/database exec prisma generate`
4. `corepack pnpm typecheck && corepack pnpm test && corepack pnpm build`
5. Run `corepack pnpm dev`; test admin remediation, user/read-only rejection, CSRF rejection, and `/admin/activity`.
6. Confirm `REMEDIATION_WRITES_ENABLED=false` blocks writes even when a project policy is enabled.
7. Do **not** merge or deploy until a complete security review and the GitHub/Compose deploy contract have been tested.


---

## 9. BETA5-README.md


# SEO Auditor v1.1.0-beta.5 — Remediation boundary hardening

## Included
- Strict type-guarded validation of project/proposal/preflight IDs before use in upstream routes and audit entries; removes the `String(unknown)` workaround.
- Activity records for both successful and unsuccessful upstream approval, rejection, preflight, execution and rollback responses, with HTTP status and success flag.
- Controlled `502 remediation_service_unavailable` on upstream transport failures, without exposing service credentials or internal URLs.
- An activity-log database failure no longer converts a successful upstream operation into a client-visible failure. **This is best-effort logging, not a transactional audit guarantee.**
- Root and web package versions aligned to beta.5.

## Still required before production release
- Durable API-side approver attribution with tamper-resistant identity propagation; web activity log alone is insufficient.
- Reliable transactional/security audit logging for privileged operations; avoid relying on best-effort logs for compliance.
- Integration secret management, distributed login rate limiting, MFA/recovery, and full release/deployment validation.
- Verify the existing manual GitHub deploy script and Compose overlay; no Ubuntu host changes in this archive.

## Mac validation
`corepack pnpm install --frozen-lockfile`
`corepack pnpm typecheck`
`corepack pnpm test`
`corepack pnpm build`

Test malformed IDs, failed upstream requests, ADMIN versus USER/READ_ONLY access, CSRF and audit activity.


---

## 10. BETA6-1-README.md


# v1.1.0-beta.6.1 — Integration UI hotfix

- Fix `invalid_mapping` for nullable/omitted optional integration fields.
- Canonicalize the WordPress discovery URL when enabled and the URL field is blank.
- Retain strict HTTPS same-origin WordPress URL validation.
- Improve save error messages and success state.
- Style integration form inputs to match the dark administration UI.
- Replace misleading red infrastructure restriction messaging with neutral informational copy.

**Note:** This does not grant infrastructure capabilities or test API credentials. The dashboard process cannot determine credentials in the API container.

Test locally: `corepack pnpm typecheck && corepack pnpm test && corepack pnpm build`. No schema migration required.


---

## 11. BETA6-2-README.md


# Beta 6.2 integration consistency fix

- Read-only WordPress discovery now respects the saved per-project PostgreSQL integration mapping without requiring the legacy WORDPRESS_INTEGRATIONS_ENABLED flag. Legacy environment mappings still require their opt-in flag.
- WordPress writes, credentials, origin checks, approvals, and remediation deployment safeguards are unchanged.
- Admin integration UI no longer infers API capabilities from the web container environment.
- Safeguard labels use neutral status styling.
- @prisma/client is declared directly in the web package to resolve Next.js external resolution warnings.

## Local verification

corepack pnpm install --frozen-lockfile
corepack pnpm typecheck
corepack pnpm test
corepack pnpm build

Save WordPress discovery in /admin/integrations and refresh the project's WordPress tab. Public REST discovery should show enabled and a detected REST API if reachable. Authenticated connection requires separately configured WordPress credentials. Google still requires API-side credentials and permission.

No production deployment changes.


---

## 12. BETA6-README.md


# v1.1.0-beta.6 — integration management (test candidate)

Adds `/admin/integrations` with project-specific WordPress discovery, Search Console and GA4 mappings. Maps are saved to PostgreSQL and consumed by the API at request time. Existing environment mappings remain fallback for projects without database mappings. Google credentials and WordPress application passwords remain server-side, never browser-visible.

## Local Mac validation

1. Ensure `DATABASE_URL` targets the **local Mac development database**.
2. `corepack pnpm install --frozen-lockfile`
3. `corepack pnpm --filter @seo-auditor/database exec prisma migrate deploy`
4. `corepack pnpm --filter @seo-auditor/database exec prisma generate`
5. `corepack pnpm typecheck && corepack pnpm test && corepack pnpm build`
6. Start dev services and test admin access, saving mappings, Google status/report, WordPress discovery and disabled safeguards.

## Security / limitations

- This is a test candidate, not a production release. The build and integration tests were not run in the packaging environment.
- Google reports still require `GOOGLE_INTEGRATIONS_ENABLED=true` and a service account in the API container.
- WordPress discovery still requires `WORDPRESS_INTEGRATIONS_ENABLED=true`. Authenticated WordPress reads/writes require the separately mounted `WORDPRESS_CONNECTIONS_FILE` and existing write guards.
- The WordPress URL must be HTTPS and match the project's origin; staging HTTP remains configured by legacy environment mapping only.
- UI mapping does not enable WordPress writes. Use the existing `/admin/wordpress` write-policy page and deployment controls.
- Changes are audit-logged. No credentials are stored in the new mapping table.
- No Ubuntu actions or GitHub deployment changes in this package.


---

## 13. BETA7-README.md


# v1.1.0-beta.7 — integration verification candidate

## Implemented
- Admin-only live **Test WordPress**, **Test Search Console**, **Test GA4** controls for saved project mappings.
- WordPress test calls existing public read-only discovery; Google tests perform actual read-only report requests using API-held service account credentials.
- Explicit connected/not connected diagnostics; no credentials sent to the browser.
- Google status now shows saved PostgreSQL property mappings even when deployment capability is off, making the blocker distinguishable from missing mappings.
- Version badge and package versions aligned to beta.7.

## Still required before production approval
- Google API service still requires `GOOGLE_INTEGRATIONS_ENABLED=true` and `GOOGLE_SERVICE_ACCOUNT_FILE` or `GOOGLE_SERVICE_ACCOUNT_JSON` in the API container. Service account must be granted access to the GSC and GA4 properties.
- This release does NOT implement credential upload, encryption at rest, Google OAuth, or WordPress application-password onboarding.
- Remediation operator and execution tokens are still required by the existing server-side workflow; do not enable writes without API-side identity attribution and approval validation.
- The deployment workflow and production environment have not been exercised here. Review the Compose secrets, image tags, DB migration and rollback before deployment.
- No database migration is required for these changes.

## Mac verification
`corepack pnpm install --frozen-lockfile && corepack pnpm typecheck && corepack pnpm test && corepack pnpm build`

Visit `/admin/integrations`, save settings, and test all three services. A Google test returning `google_integration_disabled` or `google_credentials_missing` is an actionable deployment configuration failure, not a connected integration.


---

## 14. BETA8-RELEASE-CHECKLIST.md


# v1.1.0-beta.8 — Release verification

## Completed in this candidate
- Fixed the empty web test suite with route-level security regression checks.
- Removed obsolete Google status helper that ignored database mappings.
- Added explicit Google disabled/missing-credential diagnostic in API status.
- Removed automatic production deployment from main branch CI.
- Added manually triggered production deployment for an immutable published commit SHA.
- Updated application version strings to beta.8.

## Must verify before production approval
1. On the Mac: `corepack pnpm install --frozen-lockfile`, `corepack pnpm typecheck`, `corepack pnpm test`, `corepack pnpm build`.
2. Run a full read-only audit and confirm existing project history and migrations remain intact.
3. Test WordPress REST discovery; authentication for protected content is separate.
4. Configure Google API service account securely **on the API service**, grant the account access to the GSC property and GA4 property, set `GOOGLE_INTEGRATIONS_ENABLED=true` for API, then test both from Admin. Saving property IDs alone cannot enable Google.
5. Provision the **same** strong `REMEDIATION_OPERATOR_TOKEN` on web and API services to enable proposal review; a separate `REMEDIATION_EXECUTION_TOKEN` is required on web and API for execution. Keep `REMEDIATION_WRITES_ENABLED=false` until execution/preflight/rollback are validated. Never put tokens in source or browser.
6. Confirm GitHub Production environment approvals, GHCR image publication, deployment SSH secrets, and remote `/opt/seo-auditor/deploy-ghcr.sh` exist. The remote script is NOT included in this source and must be independently reviewed.
7. Confirm compose overlays, localhost port bindings, database backups, Prisma migration strategy, and rollback with a previous image SHA.
8. Confirm authentication hardening (rate limiting, session handling) and API endpoint authorization before exposing publicly.

## Limitations
- No encrypted credential upload UI is implemented; credentials remain infrastructure-managed.
- This release candidate is not certified production-ready without live environment and end-to-end verification.
- The new tests assert key route protections exist; they are not a substitute for integration tests.


---

## 15. BETA9-RELEASE-NOTES.md


# v1.1.0-beta.9 — Remediation session integration

- Removes manually provisioned remediation operator/execution tokens from the browser-to-API remediation flow.
- Next.js verifies the logged-in administrator, then forwards their opaque session to the API over the internal network. The API independently hashes and validates the session against PostgreSQL, including expiration, disabled account and ADMIN role.
- Existing deployment write restrictions, WordPress origin allowlist, project policy, approval/preflight and rollback eligibility checks remain enforced.
- Manual deployment workflow selects a previously published immutable SHA image. CI publishes on main only after validation; does not auto-deploy.

## Outstanding before production

1. Run full pnpm lint/typecheck/test/build and live role/session revocation tests on Mac.
2. Review API network isolation and ensure sessions are never logged, forwarded outside the trusted internal network, or exposed to third parties.
3. Validate Google credentials and access to actual GSC and GA4 properties.
4. Validate WordPress write path on a dedicated staging site with rollback; production writes remain off until separately approved.
5. Verify release deployment, database migrations, health checks and rollback through GitHub Actions.
6. Existing legacy execution-token unit tests cover the old standalone security helper, not the new session flow; replace with database-backed integration tests before declaring production-ready.


---

## 16. BETA9-WORDPRESS-ID-AUTOFILL.md


# v1.1.0-beta.9 — WordPress ID auto-resolution patch

The Remediation workspace now uses the existing read-only `GET /api/v1/audits/:auditId/wordpress/issue-mapping?issueId=...` endpoint whenever an audit finding is selected.

- Exactly one URL-verified WordPress page, post or WooCommerce product is auto-populated, including content type and numeric ID.
- Ambiguous matches are presented for explicit selection. No-match and failed lookups block proposal creation rather than guessing IDs.
- The existing API-side proposal validation remains authoritative. This does not grant WordPress write access or change the approval, preflight, execution or rollback safeguards.
- Category/product-category archives still require separate taxonomy-aware remediation support and are not guessed as page IDs.

## Validate on Mac

`corepack pnpm install --frozen-lockfile && corepack pnpm typecheck && corepack pnpm test && corepack pnpm build`

Test an exact-match page, a post, a product, a non-mappable archive and an unavailable REST API. Confirm selecting a different issue clears the old ID immediately.

This package is a feature patch for the existing beta.9, not a verified production release. The build and tests have not been run in this environment.


---

## 17. CHANGELOG.md


## v0.8.4-dev.0 — WordPress metadata bridge and gated remediation (release candidate)

- Authenticated Rank Math bridge plugin, snapshots, explicitly gated execute and rollback, conflict protection and durable execution records.
- Live writes remain disabled by default. Staging acceptance testing is mandatory.

# Changelog

## [0.4.0] - 2026-10-07

### Release
- Promoted the validated v0.4.0 RC1 build to v0.4.0 with no functional crawler, rule, scoring, comparison, scheduling or regression changes.
- Validated the integrated Audit Platform release through the full local gate and deployment checks.
- Aligned workspace and UI release metadata for the v0.4.0 pre-alpha release.

### Audit Platform features

#### Added
- Audit-to-audit comparison with stable finding lifecycle detection.
- Project dashboard with recent audit history, score and regression summaries.
- Automated daily, weekly and monthly audit schedules with duplicate-run protection.
- Regression classification for new, resolved and persistent findings.
- Audit cancellation, audit/project deletion APIs and configurable retention cleanup.
- Platform-oriented database indexes and persisted schedule configuration.

#### Changed
- Project navigation now exposes a Platform view for continuous monitoring workflows.

## [Unreleased]

## [0.3.0] - 2026-10-07

- Added the deterministic SEO Rule Engine with stable namespaced rule IDs, validated rule registration and fail-fast finding contracts.
- Added core technical SEO rules covering HTTP status, redirects, metadata, headings, indexability, canonicals and crawl evidence.
- Persisted page facts and SEO findings atomically, with idempotent audit retries and paginated findings/pages APIs.
- Added the browser audit workflow for project creation, audit execution, live status polling and audit history.
- Added the Results Explorer with Overview, Issues, Pages and Crawl Failures views.
- Added aggregated issue prioritisation, affected-URL drill-down, deterministic evidence, search/filtering, pagination and remediation guidance.
- Added prevalence-aware SEO scoring so repeated findings scale by affected-page coverage rather than forcing large crawls to zero.
- Reclassified intent-dependent noindex findings as informational and suppressed cascading metadata/content findings on noindex, non-HTML and non-success responses.
- Validated the release candidate through repeated end-to-end 224-page real-world audits.
- Promoted v0.3.0 RC1 to the v0.3.0 pre-alpha release with no functional crawler, rule, scoring or dashboard changes.

### v0.3 Slice 5B

- Added issue drill-down workspaces with affected URL tables and deterministic evidence inspection.
- Added human-authored issue titles, Why this matters guidance, and remediation guidance while preserving stable rule IDs.
- Added issue severity/category/search filters, affected-URL search and pagination, and page search/pagination.

### v0.3 development — Slice 5A

- Restructured audit results into Overview, Issues, Pages, and Crawl Failures views.
- Aggregated findings by rule so informational findings no longer dominate the main results view.
- Added crawl-failure API exposure and dashboard reporting.
- Added human-readable issue labels and severity-first prioritisation.

### Added

- v0.3 Slice 4 browser workflow for creating projects, launching audits, polling active audits and reviewing crawl results.
- Audit dashboard with score, page/finding counts, severity breakdown, rule summaries, page results and deterministic finding evidence.
- Same-origin Next.js API proxy for browser-safe access to the internal API service.
- Project audit history API used by the dashboard.

### v0.3 SEO Rule Engine

- Added core technical SEO rules for HTTP status, redirects, metadata, headings, indexability and canonical evidence
- Persist page facts and their rule findings atomically so partial page analysis cannot leave orphaned results
- Reset persisted audit results before a BullMQ retry so reruns are idempotent
- Added paginated audit page/finding APIs plus severity, category and rule summaries for the dashboard
- Added per-page finding retrieval for evidence drill-down
- Added a validated rule registry with stable namespaced ID enforcement
- Added a deterministic rule execution engine
- Added fail-fast validation that finding ID, severity and category match rule metadata
- Added dedicated rule-engine contract tests and expanded rule authoring documentation

## v0.3 development — Slice 5C

- Reworked audit scoring so repeated findings scale by affected-page prevalence instead of forcing large crawls to zero.
- Informational findings no longer reduce the SEO score.
- Reclassified noindex directives as informational because intent cannot be inferred from crawl evidence alone.
- Suppressed missing canonical, metadata, heading and thin-content findings on noindex pages.
- Suppressed page-content SEO rules for non-HTML and non-success responses to reduce cascading false positives.

## [0.2.1] - 2026-10-07

- Updated the web milestone page to reflect the completed v0.2 crawler release
- Updated the next milestone to the v0.3 SEO Rule Engine
- Changed API health version reporting to derive from the API package version instead of a hard-coded value
- Aligned workspace package versions at 0.2.1

## [0.2.0] - 2026-10-07

- Added conservative URL normalization and same-origin crawl controls
- Added robots.txt parsing and enforcement with Allow/Disallow precedence
- Added sitemap and sitemap-index discovery
- Added bounded crawl depth, URL budgets and queue controls
- Added page-level concurrency and configurable request-rate limiting
- Added bounded retries, Retry-After handling and persisted crawl failures
- Added manual redirect handling, redirect-chain evidence and loop protection
- Added persisted SEO-relevant HTTP response metadata and crawl evidence
- Expanded crawler coverage to 55 automated tests

## [0.1.0] - 2026-10-07

- Industrialized monorepo foundation
- API, web and worker boundaries
- Stable SEO rule contracts
- PostgreSQL and Redis infrastructure
- Initial rules and tests

## [0.5.0-dev.0] - 2026-10-07

### Added
- Advanced audit-wide technical SEO analysis for duplicate titles, duplicate meta descriptions and exact duplicate body content.
- Internal-link graph evidence with broken internal links, HTTP internal links, incoming-link/orphan candidates and crawl-depth findings.
- Canonical cluster analysis across crawled pages.
- Hreflang extraction, invalid-reference detection and reciprocal-reference checks for crawled targets.
- JSON-LD parse-error evidence and invalid structured-data findings.
- Persisted outgoing-link, image, hreflang, JSON-LD and content-hash evidence for future platform analysis.
- First-class remediation metadata contract covering support, risk, mode, platform and restricted future action identifiers.
- Remediation capability metadata for selected existing and advanced rules in preparation for the v0.7/v0.8 connector/remediation architecture.

### Architecture
- Crawling and analysis remain read-only. Remediation metadata describes future capabilities only; v0.5 does not perform external writes or WordPress changes.


---

## 18. FEATURES-RELEASE-NOTES.md


# SEO Auditor full-source release — project tabs, deletion and PDF export

This is a complete source repository based on the supplied 2026-10-19 upload, with the previously prepared feature patch applied.

## Changes
- Administrator project integrations use tabs instead of a stacked form.
- Administrator project deletion API with typed name confirmation and active audit protection.
- Audit dashboard PDF export route and download control.
- Root `pnpm dev` selects API, web and worker by package name to avoid the prior unmatched workspace filter.

## Local setup
1. Supply local `.env` and secret files from your existing secure configuration. They are deliberately NOT in this archive.
2. Run `corepack enable` (if needed), `pnpm install --frozen-lockfile`, `pnpm dev`.
3. Before deploying: `pnpm typecheck`, `pnpm test`, `pnpm build`.
4. Test deletion against a disposable project on staging, not production.
5. Push to GitHub and deploy the newly built GHCR image with `compose.ghcr.yml`.

## Caution
- The feature patch has not been fully compiled or end-to-end tested in this environment.
- Project deletion is permanent. Back up your database and validate foreign-key cleanup and job cancellation before enabling in production.
- No Prisma migration was added for these changes.
- PDF is a text-first report, not yet the premium graphical client report.


---

## 19. MULTI-PROJECT-INTEGRATIONS.md


# Project-scoped integrations (beta.10 transition)

WordPress site URLs and application passwords are configured by administrators through **Admin → Integrations**. Write permissions are configured through **Admin → WordPress write controls** per project. No per-site API environment flags, origin allowlist, or execution token are needed.

## Infrastructure secrets that remain

- `DATABASE_URL` and `REDIS_URL` for backend services.
- `WORDPRESS_CREDENTIAL_ENCRYPTION_KEY` on **both** the API and web servers, to encrypt/decrypt existing per-project credentials. Preserve the original key during migration. Never send it to the browser.
- Authentication/session settings as required by the deployment.

## Write safety

A dashboard ADMIN session is independently validated by the API for every operation. The WordPress project policy must be enabled. Proposals require approval, a current conflict-free preflight and a unique execution record; ambiguous writes are marked `needs_review` and cannot be blindly retried. The WordPress bridge independently requires its own write opt-in and edit capabilities. The existing same-origin HTTPS WordPress mapping validation remains enforced.

## Remaining scope

This transition covers **WordPress/Rank Math integration and project-level remediation**. Google OAuth credential onboarding, Yoast and Shopify adapters, granular project memberships, credential rotation, and formal execution reconciliation UI are **not implemented** in this build. Do not interpret the interface as supporting those integrations yet.

## Validate

Run `pnpm install --frozen-lockfile`, `pnpm db:generate`, `pnpm typecheck`, `pnpm test`, `pnpm build`, and apply the database schema to the existing PostgreSQL instance. Back up PostgreSQL before deployment. Test writes on a staging WordPress site first.


---

## 20. PROJECT-INTEGRATIONS-SETUP.md


# Project-managed integrations (beta.10 candidate)

Navigate to **Administration → Integrations & secrets** to configure a WordPress mapping and enter a per-project username and Application Password. Test the authenticated connection. Go to **Administration → WordPress controls** to enable writes for that project. No WordPress per-project credentials, execution tokens, write origins or write switches are required in `.env`.

## Key management

An AES-256-GCM master key is generated in `.runtime/secrets/wordpress-credential.key` on first use if `WORDPRESS_CREDENTIAL_ENCRYPTION_KEY` is not already provided. Both `apps/web` and `apps/api` use the same location when run from their workspace directories. The file is created with mode 0600 and ignored by Git. **Back it up securely. Losing it makes saved WordPress Application Passwords unrecoverable.**

**Upgrades:** If any credentials were encrypted with an existing `WORDPRESS_CREDENTIAL_ENCRYPTION_KEY`, retain that original key. Before removing the env variable, place its exact 64-hex-character value in `.runtime/secrets/wordpress-credential.key` (chmod 600). Never generate a replacement for existing encrypted credentials.

**Containers:** Web and API MUST mount the same durable secret volume at a shared `SEO_AUDITOR_SECRET_DIR` path. Do not deploy two independent auto-generated key files. The production Compose example in this release mounts a shared named volume. For multi-host production, use a managed secret service instead.

Infrastructure such as PostgreSQL connection details and server auth still requires secure deployment configuration. Google OAuth/API integration remains a separate unfinished capability; its property mapping is editable in the UI, but API credentials are not yet implemented there.

## Safe release verification

1. Back up PostgreSQL and the existing encryption key.
2. Run `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm test`, and `pnpm build`.
3. Connect WordPress using the admin UI and verify the authenticated read.
4. Confirm the bridge has write opt-in and enable the per-project policy.
5. Reconcile any existing `needs_review` execution before testing writes.
6. Test a low-risk page on staging before attempting a live change.


---

## 21. RELEASE-NOTES-v0.5-final.md


# SEO Auditor v0.5 final hardening candidate

Complete source replacement from the 2026-10-08 10:47 baseline archive. Preserve your existing `.git` and local `.env` separately; extract into a new directory and copy reviewed source into the Git checkout.

Changes:
- Render structured evidence arrays (H1 texts, image URLs, competing URLs) as readable tables instead of JSON blocks.
- Exclude known Cloudflare and legacy email-protection utility endpoints from crawl link discovery and actionable indexable-page checks.
- Exclude non-indexable/non-content HTML from image-alt findings, while preserving the difference between missing `alt` and decorative `alt=""`.
- Fix score calculation when a rule has both actionable and informational findings: informational variants no longer dilute or mask actionable penalties.
- Add tests for utility URLs, image alt and score regression.

Validation: archive integrity and workspace structure verified. Full pnpm checks must run locally or in CI; dependencies were unavailable in the packaging environment.

Commands:
```
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```


---

## 22. REMEDIATION-UI-BRIDGE-UPDATE.md


# Remediation UI and WordPress bridge update

- Consistent styled remediation buttons and clear refresh feedback.
- Refresh reloads proposals and the selected proposal's preflight/execution state.
- Confirmation dialog shows the exact URL, SEO field, previous snapshot, and proposed value before live execution or rollback.
- WordPress bridge v0.8.5: WordPress **Settings → SEO Auditor Bridge** includes an administrator-only write permission checkbox (disabled by default for new installs). The legacy `SEO_AUDITOR_BRIDGE_WRITES_ENABLED` constant remains supported; if set to true, it overrides the checkbox.

## Deployment

1. Preserve the existing database and environment secrets; do not replace them with values from an archive.
2. Update the SEO Auditor application, install dependencies and run the usual typecheck/build/tests.
3. Upload `wordpress-plugin/seo-auditor-bridge` to the WordPress site's plugin directory, replacing the previous bridge, and check **Settings → SEO Auditor Bridge**.
4. Enable writes only when ready. The bridge still requires a WordPress account with `manage_options` and `edit_post` for the target.
5. Reconcile any existing `needs_review` execution against the live WordPress metadata before creating another proposal. Never blindly retry.

## Validation

PHP syntax checked with `php -l`. TypeScript build and browser integration were not run in this environment. No live WordPress writes were performed.


---

## 23. REPLACEMENT-README.md


# SEO Auditor v0.5 complete source replacement

This archive is a **complete source tree**, not a partial overlay. All apps and workspace packages are included.

**Safety:** Keep your existing `.git`, `.env`, and other local secrets. Do not delete your repository directory or extract over an existing working tree without a backup. Prefer extracting to a new directory, copying your existing `.env` only if needed, and comparing against your Git checkout.

Changes: issue detail now restricts findings to the selected severity and loads all matching pages; H1 evidence lists texts and positions; missing-alt evidence lists source and position and distinguishes missing attributes from `alt=""`; heading/indexable content checks respect non-self canonicals; Next.js app favicon.

After extracting, run `pnpm install --frozen-lockfile`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` from the repository root. Do not push until CI succeeds. Existing audit evidence is unchanged; rerun an audit for new evidence.


---

## 24. UI-POLISH-README.md


# v1.1.0-alpha.2 — Administration UI polish

Changes: refined Users & Roles and Invitations pages; copy invitation link button; logout uses full navigation after session invalidation to prevent stuck Signing out state. No database or deployment changes.

On Mac: keep your existing local .env and database; run `corepack pnpm typecheck && corepack pnpm build`, then `corepack pnpm dev`. Test logout, user role changes, and invitations.

Do not deploy to production yet.


---

## 25. UI-REFRESH-README.md


# UI refresh — alpha.2

Changes: responsive branded login page, global top navigation, admin-only links to Users & Roles and Invitations, session-backed account display, functional logout. Existing backend auth routes unchanged.

On Mac, preserve local .env files and run: corepack pnpm typecheck && corepack pnpm build. Verify logout and ADMIN / USER / READ_ONLY navigation. Do not merge to main: deployment still automatic.


---

## 26. V05-HARDENING-PATCH.md


# SEO Auditor v0.5 hardening patch + favicon

Apply these files at the repository root, preserving directory structure. No Prisma schema migration is required.

## Changes
- Issue workspace now requests issues by **rule ID and severity**, with API pagination and server-side URL search. This prevents informational canonical/noindex variants appearing as actionable duplicates.
- H1 evidence includes heading texts and positions.
- Image-alt evidence includes source URLs and positions. Missing `alt` attributes are distinct from intentional `alt=""` (decorative images are not automatically treated as errors).
- Page-level content rules now skip non-self canonical variants as well as noindex pages.
- New Next.js App Router favicon at `apps/web/app/icon.svg`.
- Regression tests added for image alt extraction and rule evidence.

## Validation
Run on your Mac before pushing:

```sh
pnpm install --frozen-lockfile
pnpm --filter @seo-auditor/database db:generate
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Then commit and push; your CI/CD workflow will deploy if all checks pass. Run a **new audit** to see newly captured heading/image evidence. Existing stored findings are not backfilled.

**Note:** This environment cannot install pnpm dependencies from the network, so the full project checks have not been executed here. Do not treat this as a verified release until CI passes.


---

## 27. V06-FINAL-REFINEMENT.md


# v0.6 final refinement candidate

Complete repository replacement. Adds bounded Lighthouse resource evidence, readable per-diagnostic resource tables, lab measurement context, like-for-like URL/device history, and archive-aware WordPress sampling. Existing audit data remains compatible: new JSON properties are optional in the dashboard.

**Limitations:** WordPress custom post permalinks without recognisable URL patterns may not be selected. Missing resource details mean the PageSpeed API did not provide them, not that no resources were involved. Field CrUX data is distinct from lab data.

Run `pnpm install --frozen-lockfile && pnpm lint && pnpm typecheck && pnpm test && pnpm build` before deployment.


---

## 28. V06-RELEASE-NOTES.md


# SEO Auditor v0.6 — Complete replacement candidate

This is a **complete monorepo source replacement** based on the supplied v0.6 repository. The archive excludes `.git`, `.env`, `node_modules`, generated build artifacts and macOS metadata.

Added representative page sampling, PageSpeed diagnostics, performance history, mobile/desktop summary scores, CWV threshold helpers and regression tests. Docker Compose now passes the performance configuration into the worker.

**Validation status:** isolated performance TypeScript compilation and three regression tests passed. Full monorepo pnpm lint/typecheck/test/build and GitHub Actions have not been run in this environment. Do not deploy until those are green.

Read `docs/V06-FULL-PERFORMANCE.md` before deploying. Rotate the Google API key previously shared in chat.


---

## 29. V07-RELEASE-NOTES.md


# SEO Auditor v0.7.0 — Google integration candidate

This complete repository is based on the 8 October 2026 12:20 source archive. It adds a read-only service-account integration for Google Search Console Search Analytics and Google Analytics 4 Data API, with a Google dashboard tab, per-project property mapping, explicit enablement, limited on-demand reports, and tests for configuration behaviour.

## Deployment prerequisites

- Keep the API and dashboard behind a trusted network until authentication and authorisation are implemented.
- Configure `GOOGLE_INTEGRATIONS_ENABLED`, `GOOGLE_SERVICE_ACCOUNT_JSON`, and `GOOGLE_PROJECT_PROPERTIES` securely in the API container environment. The existing `env_file: .env` on the API service passes these values into the container; no new Docker override is needed.
- Grant the service-account identity access to the relevant Search Console and GA4 properties and enable both Google APIs.
- Do not commit service-account JSON or expose credentials in CI output.

See `docs/V07-GOOGLE-INTEGRATIONS.md` for details.

## Important scope

This is a v0.7 **service-account integration**, not a multi-user OAuth account connection. No automatic scheduled data collection, persistent Google history, query-level drilldowns, or organic-only GA4 report are implemented. The technical SEO scoring model is unchanged. The full pnpm validation suite has not been executed in this environment; run it and CI before production deployment.


---

## 30. V08-RELEASE-NOTES.md


# SEO Auditor v0.8.0 — WordPress platform foundation

- New WordPress tab with read-only REST index discovery and WooCommerce namespace detection.
- Per-project, explicitly enabled site mapping with HTTPS and same-origin restrictions.
- New issue-level remediation preview API for common title, description, image alt and H1 findings.
- No live WordPress writes, credentials collection, approval endpoints, or unverified fix claims.
- No schema migrations. Existing audit, Google and performance flows remain unchanged.
- See `docs/V08-WORDPRESS-FOUNDATION.md` for configuration and limitations.

## Acceptance checks

Run `pnpm install --frozen-lockfile`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` on your Mac before pushing. This ZIP was assembled and syntax-checked in an environment without package registry access; those checks could not be run here.


---

## 31. V081-RELEASE-NOTES.md


# SEO Auditor v0.8.1

- Private, file-backed WordPress Application Password credentials.
- Read-only WordPress authentication probe; no account information returned.
- Conservative audited-issue to WordPress content mapping endpoint.
- WordPress dashboard connection status and updated v0.8.1 version badge.
- Optional production `compose.wordpress.yml` override and setup documentation.
- No mutations, approvals, rollbacks or public operator authentication in this release.


---

## 32. V082-RELEASE-NOTES.md


# v0.8.2 — Controlled remediation proposals

Adds server-side operator token gating and persisted, reviewed proposal decisions. WordPress discovery, authenticated read-only mapping, Google integrations and crawler remain unchanged. **No live WordPress edits.** See `docs/V082-REMEDIATION-APPROVALS.md`.


---

## 33. V083-RELEASE-NOTES.md


# v0.8.3 — Read-only remediation preflight (safe foundation)

This release adds operator-protected preflight, immutable snapshots, and change/conflict detection to approved proposals. **It does not add live WordPress writes, rollback, or an execution endpoint.** Do not call this a complete remediation execution engine.

The existing WordPress Application Password integration can resolve posts/pages/products, but WordPress REST often hides Rank Math private metadata. In that case the preflight fails closed with `seo_metadata_not_exposed` (HTTP 409). This is intentional. Never infer an empty SEO description from absent REST metadata.

## API

All requests require the existing `Authorization: Bearer <operator-token>` header.

- `POST /api/v1/wordpress/proposals/:proposalId/preflight` — revalidate exact mapping; read metadata; snapshot and hash; compare with previous preflight.
- `GET /api/v1/wordpress/proposals/:proposalId/preflights` — list read-only preflight history.

A successful preflight returns `executable: false`. The first verified snapshot returns `ready_for_review`; a changed value on subsequent preflight returns `conflict`. No API route writes WordPress.

## Database and deployment

New Prisma model: `RemediationPreflight`. Review the schema change and run your established additive schema deployment; do not reset the database or use `--accept-data-loss`. The production deploy already runs a migration/db-push stage. Keep existing secrets and Compose overrides on the VM.

## Next gate before write-enabled remediation

A separately installed and reviewed WordPress plugin bridge must expose only explicit allowlisted Rank Math keys to an authenticated API, with write permissions, original-value capture, compare-and-swap semantics, idempotency keys, independent execution authorisation, and tested rollback. Test against staging first. Do not enable production writes from this release.


---

## 34. V090-AI-README.md


# SEO Auditor v0.9.0–v0.9.1 — AI advisory analysis

## Included
- `@seo-auditor/ai` typed OpenAI Responses API client with strict structured output and 30s timeout.
- Per-project opt-in AI settings: disabled/manual by default, optional automatic after completed audits.
- `AiAnalysis` database history, status, token counts and page-content fingerprint caching.
- Authenticated API endpoints and a new **ai** tab in the audit dashboard.
- Automatic analysis capped at 1–10 pages per audit and a rolling 24-hour analysis count; failure does not fail an SEO audit.
- AI cannot approve, execute or roll back WordPress remediation.

## Setup
1. Review changes and run `pnpm install` to update the workspace lockfile.
2. Run `pnpm --filter @seo-auditor/database db:generate` and `pnpm build`, `pnpm test`, `pnpm lint`.
3. Apply the committed Prisma migration with `prisma migrate deploy` in your normal staging deployment workflow. Back up the production database before production migration.
4. Set `OPENAI_API_KEY` in the API and worker **server** environments only. Optionally set `OPENAI_MODEL` (default `gpt-4.1-mini`). In Docker production, set these in the protected `.env.production` on the VM; never commit them.
5. Open a completed audit, select **ai**, enable AI for that project, save, then choose a page and click **Analyse page with OpenAI**.
6. Automatic mode is optional and processes only the first N stored pages of a *newly completed* audit. Historical audits are not automatically reprocessed.

## Limits and cautions
- Page records currently store SEO metadata, headings, link/image summaries and issues, **not full HTML body**. Recommendations must not claim to have read the full body.
- Daily limit counts created analysis records (including failed attempts); it is an operation limit, **not a currency budget**. OpenAI token spend and model costs must be monitored externally until a monetary budget implementation exists.
- For large multi-worker deployments, daily limits and duplicate protection need transactional reservations or a dedicated queue. This initial implementation is suitable for a small, single-worker installation.
- The `POST` endpoint is synchronous and may take up to 30 seconds; a later release should use BullMQ jobs for long-running analyses.
- Do not enable automatic mode until API credentials, model costs and access controls have been verified in staging.


---

## 35. V092-AI-REVIEW-README.md


# v0.9.2 AI Remediation Review

Adds operator-only review of existing AI analyses, with editable before/after suggestions and approve/reject decisions.

## Development

From the repository root, load your own local `.env` (not included in this archive):

```sh
set -a; source .env; set +a
pnpm install
pnpm --filter @seo-auditor/database exec prisma migrate deploy
pnpm --filter @seo-auditor/database db:generate
pnpm build
pnpm typecheck
pnpm test
pnpm dev
```

If your local database is managed exclusively by `prisma db push`, use that workflow instead of mixing migration histories. Back up databases before applying schema changes. Never reset or accept data loss.

Open a completed audit > AI, then click **Review suggestions** on an analysis. Edit and save proposed values before approving or rejecting.

## Safety

- Requires an authenticated ADMIN session for review endpoints.
- Decisions are atomic and can only transition from pending once.
- Approval is only permitted for title, metaDescription and h1 suggestions where the AI-reported current value exactly matches the saved crawl snapshot.
- All other recommendation fields require separate manual remediation; they may be rejected, but not approved by this endpoint.
- Approval does not create a WordPress remediation proposal or publish a change.
- Reviewer user ID and decision timestamp are persisted.
- Original OpenAI recommendations are retained on AiAnalysis.
- The input archive contained private environment files and a WordPress encryption key. These have been excluded from this deliverable. Preserve your originals securely.

## Validation
Full pnpm/Prisma builds and database migration were not executed in this environment. Run the commands above against a development database before deploying.


---

## 36. V0922-AI-WORKSPACE-README.md


# SEO Auditor v0.9.2.2 — AI workspace redesign

## Changes
- Responsive AI workspace with clearer hierarchy and consistent dark styling.
- Compact project AI settings, connection indicator and per-audit summary.
- Analysis history with expandable review cards.
- Editable before/after comparison, evidence disclosure, and recorded approval/rejection status.
- Client-side search, status and priority filtering for **loaded** reviews.
- CSV export of **loaded** review records.
- Explicit warnings that approving a suggestion does not publish or create a WordPress remediation proposal.

## Deployment
Copy into the existing source checkout, retaining your local `.env`, secrets, database and `.git` history.
Run `pnpm install`, `pnpm build`, `pnpm typecheck`, `pnpm test`, `pnpm lint`.
No new Prisma migration is required for this UI update; the existing v0.9.2 `AiRemediationReview` table must already exist.

## Boundaries
This release does **not** implement automatic conversion of approved suggestions into WordPress remediation proposals.
Review decisions remain persisted through the existing v0.9.2 API. The next backend increment should add
an explicit, independently validated proposal conversion endpoint with eligibility and mapping checks.
The summary counts and CSV export represent only reviews loaded in this browser session, not the entire project.


---

## 37. V0923-AI-PROPOSAL-BRIDGE.md


# v0.9.2.3 — AI approval to WordPress draft proposal

## Added
- Admin-only API `POST /api/v1/projects/:projectId/ai/reviews/:reviewId/proposal`.
- Separate "Create WordPress draft" action on approved AI reviews.
- Only approved `title` or `metaDescription` suggestions with one of the supported title/description issue IDs are eligible.
- The API verifies a matching stored audit issue, the AI-reported before value against the saved crawl snapshot, WordPress configuration, and a unique verified WordPress target.
- Reuses existing `RemediationProposal` model and sets `status: draft`. No live write or automatic approval.
- Existing identical non-rejected proposal is returned rather than creating a duplicate (best-effort check).

## Deliberate restrictions
- H1, images, links, schema, content and suggestions without a matching audit issue are not auto-converted.
- Ambiguous WordPress mapping requires manual intervention.
- The current API does not yet perform a fresh live WordPress SEO value preflight during proposal creation. Use the existing remediation preflight before execution.
- Proposal creation and approval are distinct actions. Never auto-publish.

## Validation on developer machine
`pnpm install && pnpm build && pnpm typecheck && pnpm test && pnpm lint`
No Prisma schema migration is needed for this change.
Keep `.env`, `.env.production`, keys and local Git history from your existing checkout. Do not replace them with files from this archive.


---

## 38. V0924-UNIFIED-REMEDIATION-README.md


# v0.9.2.4 — Unified AI Remediation Centre

## What changed
- Replaces separate AI and Remediation navigation tabs with one Remediation Centre.
- Page remediation: select a crawled page, run existing OpenAI page analysis, review that page's saved recommendations, edit, approve and create an eligible WordPress draft.
- Full AI analysis: preserves the existing AI workspace across all saved analyses for the current audit.
- Review queue: focuses the existing human approval interface.
- Proposals & verification: retains the existing WordPress remediation proposal approval, read-only preflight, execution and rollback UI.
- No new database schema or automatic publishing.

## Notes
- “Full AI analysis” means all saved page analyses in the audit; it does NOT trigger a site-wide batch analysis.
- The existing backend's eligibility and WordPress mapping restrictions remain authoritative. Unsupported suggestions cannot be converted to drafts.
- All review and proposal operations use the existing authenticated routes.
- Review queue is the existing analysis-based review experience, not a new project-wide aggregation endpoint.
- Keep `.env`, encryption secrets and PostgreSQL data from your current installation. No secrets are included.

## Local checks
pnpm install
pnpm build
pnpm typecheck
pnpm test
pnpm lint

Do not deploy to production until these checks and the UI workflow pass.


---

## 39. V0925-ISSUE-AI-FIX-README.md


# v0.9.2.5 — Issue-specific AI SEO fix generator

1. Open Remediation Centre > Proposals & verification > Create SEO fix.
2. Select a title/description issue; the current value loads from the saved crawl.
3. Generate with AI, optionally Shuffle. Review or edit the proposed value.
4. Confirm AI suggestion and create a draft via existing remediation controls.
5. Approve, preflight and execute separately. Nothing is automatically published.

The AI endpoint requires authentication, project AI enablement, a completed project audit and a supported issue. No Prisma migration is needed. The existing full AI analysis remains available.

Limitations: Current values are crawl snapshots, not live WordPress values. The API-instance-local generation quota is not suitable as a distributed production quota; move it to Redis for multi-instance deployments. This build has not run a full pnpm compilation or test suite.

Validation: pnpm install && pnpm build && pnpm typecheck && pnpm test && pnpm lint


---

## 40. V093-INTELLIGENT-REMEDIATION.md


# SEO Auditor v0.9.3 — Intelligent Remediation (incremental development build)

## Implemented
- New **Bulk analysis & queue** section within the existing Remediation Centre.
- Select up to 10 not-yet-analysed pages and run the existing authenticated AI analysis endpoint sequentially, with progress, per-project AI settings and quota enforcement on the API.
- Stop the batch on the first failure; previously completed analyses are retained. Reuse existing content-fingerprint cache.
- Consolidated review queue across up to the latest 50 completed analyses returned by the existing API; review records are materialised idempotently via the existing `/reviews` endpoint.
- Search/filter by review decision, editable proposed text, approve/reject, and draft creation for the existing supported WordPress title/meta-description rules.
- No schema change, no new WordPress write path, and no automated publishing.
- Existing **Proposals & verification** tab continues to provide live WordPress preflight, conflict detection, explicit execution approval and recorded execution/rollback verification. This release does not add an independent follow-up crawl verification system.

## Limitations and follow-on work
- Batch processing is sequential in the browser, not a durable background queue. Closing the tab stops future requests but completed analyses remain saved.
- The consolidated queue is limited to 50 recent analyses, not full-project pagination; review counts reflect loaded data.
- For high-volume operation, move batches to BullMQ, add durable job state, rate limiting and server-side paginated review queries.
- A separate **post-fix recrawl and comparison** (new audit versus pre-change baseline) is not yet implemented. Existing verification confirms the WordPress write, not a new search-engine crawl.
- Test on a local/staging database and WordPress instance before production rollout.

## Checks
Run `pnpm install`, `pnpm build`, `pnpm typecheck`, `pnpm test`, `pnpm lint` from the monorepo root. No Prisma migration required.
Keep your existing `.env`, `.env.production`, credentials encryption key, database and volumes. Never copy secrets from a source archive.


---

## 41. V0931-WOOCOMMERCE-TAXONOMY.md


# v0.9.3.1 — WooCommerce product-category remediation

This release adds exact-URL matching for `/product-category/<slug>/` using the public WordPress REST `wp/v2/product_cat` taxonomy endpoint. It does not guess term IDs. The existing proposal approval, preflight, compare-and-swap write and verification workflow is preserved.

## Required WordPress update

Update the bundled **SEO Auditor Metadata Bridge** plugin on your WordPress site. The API alone cannot write taxonomy metadata. The updated bridge reads and writes Rank Math SEO title/description via **term meta** (`get_term_meta` / `update_metadata('term', ...)`) and checks `edit_term` permission, administrator approval and bridge write enablement. Existing post/page/product handling remains intact.

## Important prerequisites

The WordPress REST taxonomy endpoint `/wp-json/wp/v2/product_cat?slug=lamb&_fields=id,link` must be available and return a `link` exactly matching the audited URL. If WooCommerce does not expose the taxonomy endpoint, mapping fails closed and requires manual review; no guessed ID or fallback is used. Rank Math must be active and store its taxonomy metadata under the standard `rank_math_title` and `rank_math_description` term meta keys. The WordPress account must have taxonomy edit permission.

## Validation

Run `pnpm install`, `pnpm build`, `pnpm typecheck`, `pnpm test`, `pnpm lint` and PHP lint `php -l wordpress-plugin/seo-auditor-bridge/seo-auditor-bridge.php`. Test category mapping and an authenticated read-only preflight before enabling live writes. A successful write does not guarantee that Rank Math renders the new title immediately; recrawl and inspect the page separately.


---

## 42. V120-INTELLIGENCE-FOUNDATION.md


# v1.2.0 Intelligence Foundation — initial implementation

This change is additive and advisory-only. It adds three Prisma models and a pure `@seo-auditor/intelligence` package with deterministic opportunity scoring, fingerprints, and conservative Search Console candidate selection. No web routes, background jobs, external crawls or WordPress writes are enabled in this release.

## Safety and rollout

1. Take and verify a PostgreSQL backup before changing the database.
2. Review the new SQL in `packages/database/prisma/migrations/20261026150000_intelligence_foundation/migration.sql` and reconcile existing migration history. **Do not run `prisma db push`, `--accept-data-loss`, or `migrate reset`.**
3. Validate Prisma (`pnpm --filter @seo-auditor/database exec prisma validate`) and run tests (`pnpm --filter @seo-auditor/intelligence test`).
4. Only after reviewing the entire migration history, apply pending migrations explicitly in a controlled maintenance window. `prisma migrate deploy` applies *all pending migrations*, not just this one.
5. Keep the Compose migration service disabled by default. New intelligence records must never initiate WordPress remediation.

## Next steps

Add authenticated project-scoped API endpoints, a Search Console observation import job with quotas and date-window provenance, and a read-only dashboard. Validate/normalise competitor domains and require operator selection before competitor crawling.

## Migration history compatibility

An existing installation may contain the historical migration
`20261013113000_reconcile_v1_schema` in `_prisma_migrations`
without a corresponding migration directory in this repository.

The v1.2.0 migration chain was validated against the current Prisma
schema. Both v1.2.0 migrations were successfully applied to a restored
database and the existing working database, preserving project data.

The historical migration discrepancy remains unresolved. Prisma
`migrate status` may report divergent migration histories.

Do not run `prisma migrate reset` or modify historical migration
checksums to suppress this warning. Recover and verify the original
migration before considering the history fully reconciled.


---

## 43. V121-KEYWORD-OPPORTUNITIES.md


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


---

## 44. WORDPRESS-CREDENTIAL-RELEASE.md


# WordPress connection release gate

1. Apply the additive Prisma migration before starting new API/web images.
2. Generate a 32-byte random key (`openssl rand -hex 32`) and configure `WORDPRESS_CREDENTIAL_ENCRYPTION_KEY` identically for API and web via secret deployment configuration. Preserve this key across deployments; losing it makes saved credentials undecryptable. Never commit it.
3. In Administration > Integrations save the WordPress mapping, then save a WordPress username and Application Password. Test **authenticated WordPress** (not merely public discovery).
4. Install/enable the SEO Auditor Rank Math metadata bridge on a staging WordPress site; authentication alone does not supply the bridge endpoint.
5. Verify staging preflight, approval, execution, post-write verification and rollback. Keep REMEDIATION_WRITES_ENABLED=false in production until separately approved and configured.
6. Validate on Mac: `corepack pnpm install --frozen-lockfile`, `corepack pnpm --filter @seo-auditor/database db:generate`, `corepack pnpm lint`, `corepack pnpm typecheck`, `corepack pnpm test`, `corepack pnpm build`.
7. GitHub main publishes SHA-tagged images only; Production deploy is manual via Deploy approved release workflow.
8. Google APIs still require service-account credentials and authorised property access. Do not mistake saved property IDs for working authentication.

This patch does not claim production-ready WordPress writes until the end-to-end staging checks above pass.
