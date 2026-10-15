# Beta 10 — Google project credentials and WordPress write policies

Administration → Project integrations & secrets now accepts **Google service account JSON** per project, encrypts it using the existing credential encryption key and stores it in PostgreSQL. Search Console and GA4 property IDs remain editable per project. Grant the service account Viewer access to the appropriate Search Console property and GA4 property before running connection tests. The service-account JSON must be created in Google Cloud and the relevant APIs enabled. This is service-account integration, not interactive Google OAuth consent.

WordPress remediation has **no operator-entered remediation key** in this branch: the old execution token was intentionally replaced with an authenticated admin session plus project write policy, proposal approval, preflight, and WordPress bridge write opt-in. See Administration → WordPress write controls. Do not add an execution token to the frontend: it would undermine the session-based design.

**Deployment prerequisites remain:** PostgreSQL and Redis connection settings, and a durable server-side encryption key or persistent secret directory. The key must be shared by web and API processes and backed up; do not rotate it without a credential migration. Run `pnpm --filter @seo-auditor/database db:generate` and apply the schema to the database using your established migration workflow before launching. Existing `needs_review` executions must be reconciled before retrying writes.

No Google API calls or live WordPress writes were performed while preparing this archive.
