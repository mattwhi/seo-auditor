# v1.1.0-beta.7 — integration verification candidate

## Implemented
- Admin-only live **Test WordPress**, **Test Search Console**, **Test GA4** controls for saved project mappings.
- WordPress test calls existing public read-only discovery; Google tests perform actual read-only report requests using API-held service account credentials.
- Explicit connected/not connected diagnostics; no credentials sent to the browser.
- Google status now shows saved PostgreSQL property mappings even when deployment capability is off, making the blocker distinguishable from missing mappings.
- Version badge and package versions aligned to beta.7.

## Still required before production approval
- Google API service still requires `GOOGLE_INTEGRATIONS_ENABLED=true` and `GOOGLE_SERVICE_ACCOUNT_FILE` or `GOOGLE_SERVICE_ACCOUNT_JSON` in the API container. Service account must be granted access to the GSC and GA4 properties.
- This release does NOT implement credential upload, encryption at rest, Google OAuth, or WordPress application-password onboarding.
- Remediation operator and execution tokens are still required by the existing server-side workflow; do not enable writes without API-side identity attribution and approval validation.
- The deployment workflow and production environment have not been exercised here. Review the Compose secrets, image tags, DB migration and rollback before deployment.
- No database migration is required for these changes.

## Mac verification
`corepack pnpm install --frozen-lockfile && corepack pnpm typecheck && corepack pnpm test && corepack pnpm build`

Visit `/admin/integrations`, save settings, and test all three services. A Google test returning `google_integration_disabled` or `google_credentials_missing` is an actionable deployment configuration failure, not a connected integration.
