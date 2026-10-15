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
