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
