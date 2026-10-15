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
