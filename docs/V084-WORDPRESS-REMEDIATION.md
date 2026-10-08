# v0.8.4 — WordPress / WooCommerce remediation integration (release candidate)

This is a **complete repository replacement**. Preserve existing `.env`, `/opt/seo-auditor/secrets`, database volumes and VM Compose overrides. Do not overwrite live secrets. Existing crawler, dashboards, GSC/GA4, proposals and preflight history remain.

## Safety model

- WordPress metadata bridge plugin: `wordpress-plugin/seo-auditor-bridge/seo-auditor-bridge.php`. Install as a plugin on a **staging** WordPress site first. Requires Rank Math, WordPress Application Password and HTTPS.
- Bridge GET returns the exact stored Rank Math `rank_math_title` or `rank_math_description` value. Missing values are represented as an empty string, not as unverified REST `meta`.
- Bridge POST requires a WordPress user with both `edit_post` and `manage_options`, plus `define('SEO_AUDITOR_BRIDGE_WRITES_ENABLED', true);` in staging `wp-config.php`. Without that constant, bridge writes are rejected.
- Auditor API POST execute/rollback requires a **separate** `REMEDIATION_EXECUTION_TOKEN` of at least 48 characters; this is not the v0.8.2 operator token.
- API writes are **disabled by default**. API-only environment: `REMEDIATION_WRITES_ENABLED=true` and `REMEDIATION_WRITE_ALLOWED_ORIGINS=https://staging.example.com`. Never enable on production until staging acceptance tests are green.
- WordPress target URL is reverified before mutation; snapshots are fresh for only 15 minutes; metadata hashes and compare-and-swap values must match.
- Failed or ambiguous writes are marked `needs_review` and cannot be blindly retried. Rollback is permitted only after verified execution and requires the current value to equal the applied value.
- Do not expose the auditor API to the internet; existing non-remediation endpoints are not fully authenticated. Operator and execution tokens must not enter browser code.

## API endpoints

Authenticated using existing `REMEDIATION_OPERATOR_TOKEN`:

- `POST /api/v1/wordpress/proposals/:proposalId/preflight` (read-only)
- `GET /api/v1/wordpress/proposals/:proposalId/preflights`
- `GET /api/v1/wordpress/proposals/:proposalId/execution` (returns stored execution record)

Authenticated using separate `REMEDIATION_EXECUTION_TOKEN`:

- `POST /api/v1/wordpress/proposals/:proposalId/execute` with JSON `{"preflightId":"<latest-preflight-id>","confirm":"EXECUTE_APPROVED_REMEDIATION"}`
- `POST /api/v1/wordpress/proposals/:proposalId/rollback` with JSON `{"confirm":"ROLLBACK_REMEDIATION"}`

Both POST actions are additionally disabled by default and require explicit allowlisted origin. There is no browser execution UI. Do not run them against production.

## Staging rollout

1. Back up staging WordPress and PostgreSQL. Create a dedicated WordPress Application Password user with only the permissions needed by the bridge (the initial bridge POST currently requires `manage_options`; treat as a privileged account).
2. Install/activate the bridge plugin on staging, configure `WORDPRESS_PROJECT_SITES` and `wordpress-connections.json` for the staging project. Ensure the WordPress connection is verified.
3. Deploy the new API and reviewed Prisma schema change. The existing migration service uses `prisma db push`; review the generated SQL/plan and never accept data loss.
4. Run read-only preflight on a staging approved proposal. Verify it returns `ready_for_review` and `adapter=rank_math_bridge_v1`. Repeat and check history.
5. With the API write flags **off**, verify execute returns `403 execution_disabled` and that WordPress has not changed.
6. Enable the bridge write constant on staging, add a separate execution token in API-only `secrets/remediation.env`, enable API write flags for the exact staging origin, and recreate only the API container with the existing deployed `IMAGE_TAG` exported.
7. Execute one harmless staging proposal; verify Rank Math metadata and rendered SEO output independently. Then rollback and verify the exact original value.
8. Exercise stale preflight, wrong object, unauthorised token, changed metadata, duplicate execute, duplicate rollback, and API/WordPress network failure cases before considering any production rollout.

## Limitations

- Only Rank Math post/page/product **title and description metadata** supported. WooCommerce categories, WordPress taxonomies, Yoast, canonical rules and other SEO fixes remain manual review.
- Rank Math templates and dynamic variables can affect rendered SEO output. This release verifies stored postmeta read-back, **not** the rendered public HTML or Google indexing.
- WordPress metadata updates and PostgreSQL records cannot be in one atomic transaction. Ambiguous failures deliberately enter manual reconciliation rather than retrying automatically.
- Rollback restores the stored string; it cannot guarantee restoration of an absent meta row versus an empty-string meta row.
- No session/RBAC system or public-facing execution UI; do not expose API publicly.

## Local checks

`pnpm install --frozen-lockfile && pnpm lint && pnpm typecheck && pnpm test && pnpm build`

`php -l wordpress-plugin/seo-auditor-bridge/seo-auditor-bridge.php`

Review changes before deployment. **No production write enablement is included.**
