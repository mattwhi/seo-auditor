# v0.9.2 AI Remediation Review

Adds operator-only review of existing AI analyses, with editable before/after suggestions and approve/reject decisions.

## Development

From the repository root, load your own local `.env` (not included in this archive):

```sh
set -a; source .env; set +a
pnpm install
pnpm --filter @seo-auditor/database exec prisma migrate deploy
pnpm --filter @seo-auditor/database db:generate
pnpm build
pnpm typecheck
pnpm test
pnpm dev
```

If your local database is managed exclusively by `prisma db push`, use that workflow instead of mixing migration histories. Back up databases before applying schema changes. Never reset or accept data loss.

Open a completed audit > AI, then click **Review suggestions** on an analysis. Edit and save proposed values before approving or rejecting.

## Safety

- Requires an authenticated ADMIN session for review endpoints.
- Decisions are atomic and can only transition from pending once.
- Approval is only permitted for title, metaDescription and h1 suggestions where the AI-reported current value exactly matches the saved crawl snapshot.
- All other recommendation fields require separate manual remediation; they may be rejected, but not approved by this endpoint.
- Approval does not create a WordPress remediation proposal or publish a change.
- Reviewer user ID and decision timestamp are persisted.
- Original OpenAI recommendations are retained on AiAnalysis.
- The input archive contained private environment files and a WordPress encryption key. These have been excluded from this deliverable. Preserve your originals securely.

## Validation
Full pnpm/Prisma builds and database migration were not executed in this environment. Run the commands above against a development database before deploying.
