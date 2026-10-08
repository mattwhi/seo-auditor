# SEO Auditor v0.7.0 — Google integration candidate

This complete repository is based on the 8 October 2026 12:20 source archive. It adds a read-only service-account integration for Google Search Console Search Analytics and Google Analytics 4 Data API, with a Google dashboard tab, per-project property mapping, explicit enablement, limited on-demand reports, and tests for configuration behaviour.

## Deployment prerequisites

- Keep the API and dashboard behind a trusted network until authentication and authorisation are implemented.
- Configure `GOOGLE_INTEGRATIONS_ENABLED`, `GOOGLE_SERVICE_ACCOUNT_JSON`, and `GOOGLE_PROJECT_PROPERTIES` securely in the API container environment. The existing `env_file: .env` on the API service passes these values into the container; no new Docker override is needed.
- Grant the service-account identity access to the relevant Search Console and GA4 properties and enable both Google APIs.
- Do not commit service-account JSON or expose credentials in CI output.

See `docs/V07-GOOGLE-INTEGRATIONS.md` for details.

## Important scope

This is a v0.7 **service-account integration**, not a multi-user OAuth account connection. No automatic scheduled data collection, persistent Google history, query-level drilldowns, or organic-only GA4 report are implemented. The technical SEO scoring model is unchanged. The full pnpm validation suite has not been executed in this environment; run it and CI before production deployment.
