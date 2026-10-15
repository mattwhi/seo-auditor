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
