# v0.8 — Integrated WordPress remediation management

## What changed

The main dashboard now includes a **Remediation** tab with server-side operator login, proposal drafting, approval/rejection, read-only preflight, snapshot inspection, execution history and separately gated execution/rollback. Rank Math bridge remains a separately installable WordPress plugin in `wordpress-plugin/seo-auditor-bridge`.

**Safety:** Existing backend write gates remain in place. Deployment does not enable writes. Execution requires a separate API execution token, explicit origin allowlist, recent conflict-free preflight, and WordPress bridge opt-in. Test staging before production.

## Web operator session configuration

Create `/opt/seo-auditor/secrets/remediation-ui.env` on the VM (mode 0640, owner root, group matching the Docker Compose operator):

```
REMEDIATION_UI_PASSWORD=<unique-strong-password-at-least-16-chars>
REMEDIATION_UI_SESSION_SECRET=<random-hex-string-at-least-48-chars>
REMEDIATION_OPERATOR_TOKEN=<same-existing-api-operator-token>
# Optional; only for staging execution:
# REMEDIATION_EXECUTION_TOKEN=<same-existing-api-execution-token>
```

Generate values on the VM with `openssl rand -hex 32` (password) and `openssl rand -hex 48` (session secret). Do not commit these values or paste them into chat. **The web container receives the operator token only server-side**, never as a `NEXT_PUBLIC_*` variable. Ensure TLS and private network access. The general API proxy explicitly denies protected remediation routes and strips inbound Authorization/Cookie headers.

Add `-f compose.remediation-ui.yml` to the Compose file list in `/opt/seo-auditor/deploy-ghcr.sh` after `compose.remediation.yml`, and copy this override to `/opt/seo-auditor/` before deployment. The deploy script does not sync files from GitHub. Do not enable execution tokens or WordPress writes until staging tests pass.

The operator session is an HttpOnly, SameSite=Strict, HMAC-signed four-hour cookie scoped to `/api/remediation`. POST actions require matching Origin/Host and a custom CSRF intent header. Login is throttled in-memory per forwarded IP (a shared edge rate limiter is recommended for multi-replica/public deployment). This is an operator-only control, **not a substitute for full multi-user RBAC**; keep the tool private.

## Test

1. Run `pnpm install --frozen-lockfile && pnpm lint && pnpm typecheck && pnpm test && pnpm build`.
2. Deploy without enabling writes; confirm the Remediation tab appears.
3. Confirm the tab shows configuration instructions before setting the web-only secrets.
4. Configure the web-only secrets and restart web; sign in with the UI password.
5. Inspect the existing approved Contact page proposal; run read-only preflight and inspect snapshots.
6. With Rank Math bridge installed on **staging**, test read → preflight → execute → verify → rollback, checking both REST responses and rendered metadata.
7. Confirm no write occurs when any API or WordPress write gate is disabled, and verify token failures, duplicate execution rejection and conflict handling.

## Known limits

The UI displays the first 100 issues from the selected audit and does not provide bulk issue pagination yet. Proposals are limited to the 100 most recent by the API. WooCommerce taxonomy metadata, Yoast, multi-user RBAC and public exposure remain out of scope. No live write test has been performed by this release build.
