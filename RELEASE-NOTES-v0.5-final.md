# SEO Auditor v0.5 final hardening candidate

Complete source replacement from the 2026-10-08 10:47 baseline archive. Preserve your existing `.git` and local `.env` separately; extract into a new directory and copy reviewed source into the Git checkout.

Changes:
- Render structured evidence arrays (H1 texts, image URLs, competing URLs) as readable tables instead of JSON blocks.
- Exclude known Cloudflare and legacy email-protection utility endpoints from crawl link discovery and actionable indexable-page checks.
- Exclude non-indexable/non-content HTML from image-alt findings, while preserving the difference between missing `alt` and decorative `alt=""`.
- Fix score calculation when a rule has both actionable and informational findings: informational variants no longer dilute or mask actionable penalties.
- Add tests for utility URLs, image alt and score regression.

Validation: archive integrity and workspace structure verified. Full pnpm checks must run locally or in CI; dependencies were unavailable in the packaging environment.

Commands:
```
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```
