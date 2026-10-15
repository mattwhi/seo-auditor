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
