# Local WordPress remediation troubleshooting

## Prisma Studio

From the repository root, run `pnpm db:studio`. The wrapper loads `DATABASE_URL` from `packages/database/.env`, the root `.env`, or `apps/api/.env` if not already exported. It does not print credentials. For a local Docker PostgreSQL published on port 5433, the host-side URL normally uses `localhost:5433`, not the Compose service name `postgres`.

## Independent write controls

Execution and rollback require **all** of:

1. An authenticated dashboard administrator session.
2. `REMEDIATION_EXECUTION_TOKEN` (at least 48 characters) set identically in **both** `apps/api/.env` and `apps/web/.env.local`. It is forwarded server-to-server in a dedicated header and never exposed to the browser.
3. `REMEDIATION_WRITES_ENABLED=true` and `REMEDIATION_WRITE_ALLOWED_ORIGINS=<exact origin>` in the API environment.
4. An enabled project WordPress write policy in the dashboard.
5. The WordPress bridge plugin installed and activated, and `define('SEO_AUDITOR_BRIDGE_WRITES_ENABLED', true);` set in WordPress `wp-config.php` (staging only until explicitly approved for production).
6. A valid approved proposal and latest matching preflight.

Writes remain disabled by default. Do not enable them on a live store without first verifying on staging and taking a backup.

## Failed execution (`needs_review`)

Inspect the proposal's **Execution history**: it now displays the stored `errorCode` and the immediate API error reason. An authenticated bridge `GET` returning 200 only proves read access; `POST` has additional WordPress permissions and write opt-in. Never blindly retry a `needs_review` execution. Compare the live Rank Math value with `originalValue` and `appliedValue` and reconcile the record deliberately.

## Validation

Run `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm test`, `pnpm build` on a machine with Node 22 and pnpm 10.18.3. This source archive excludes all `.env` files and credentials.
