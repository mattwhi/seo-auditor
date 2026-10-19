# SEO Auditor v0.9.0–v0.9.1 — AI advisory analysis

## Included
- `@seo-auditor/ai` typed OpenAI Responses API client with strict structured output and 30s timeout.
- Per-project opt-in AI settings: disabled/manual by default, optional automatic after completed audits.
- `AiAnalysis` database history, status, token counts and page-content fingerprint caching.
- Authenticated API endpoints and a new **ai** tab in the audit dashboard.
- Automatic analysis capped at 1–10 pages per audit and a rolling 24-hour analysis count; failure does not fail an SEO audit.
- AI cannot approve, execute or roll back WordPress remediation.

## Setup
1. Review changes and run `pnpm install` to update the workspace lockfile.
2. Run `pnpm --filter @seo-auditor/database db:generate` and `pnpm build`, `pnpm test`, `pnpm lint`.
3. Apply the committed Prisma migration with `prisma migrate deploy` in your normal staging deployment workflow. Back up the production database before production migration.
4. Set `OPENAI_API_KEY` in the API and worker **server** environments only. Optionally set `OPENAI_MODEL` (default `gpt-4.1-mini`). In Docker production, set these in the protected `.env.production` on the VM; never commit them.
5. Open a completed audit, select **ai**, enable AI for that project, save, then choose a page and click **Analyse page with OpenAI**.
6. Automatic mode is optional and processes only the first N stored pages of a *newly completed* audit. Historical audits are not automatically reprocessed.

## Limits and cautions
- Page records currently store SEO metadata, headings, link/image summaries and issues, **not full HTML body**. Recommendations must not claim to have read the full body.
- Daily limit counts created analysis records (including failed attempts); it is an operation limit, **not a currency budget**. OpenAI token spend and model costs must be monitored externally until a monetary budget implementation exists.
- For large multi-worker deployments, daily limits and duplicate protection need transactional reservations or a dedicated queue. This initial implementation is suitable for a small, single-worker installation.
- The `POST` endpoint is synchronous and may take up to 30 seconds; a later release should use BullMQ jobs for long-running analyses.
- Do not enable automatic mode until API credentials, model costs and access controls have been verified in staging.
