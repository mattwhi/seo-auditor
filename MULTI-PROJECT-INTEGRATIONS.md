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
