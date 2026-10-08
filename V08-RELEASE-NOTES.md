# SEO Auditor v0.8.0 — WordPress platform foundation

- New WordPress tab with read-only REST index discovery and WooCommerce namespace detection.
- Per-project, explicitly enabled site mapping with HTTPS and same-origin restrictions.
- New issue-level remediation preview API for common title, description, image alt and H1 findings.
- No live WordPress writes, credentials collection, approval endpoints, or unverified fix claims.
- No schema migrations. Existing audit, Google and performance flows remain unchanged.
- See `docs/V08-WORDPRESS-FOUNDATION.md` for configuration and limitations.

## Acceptance checks

Run `pnpm install --frozen-lockfile`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` on your Mac before pushing. This ZIP was assembled and syntax-checked in an environment without package registry access; those checks could not be run here.
