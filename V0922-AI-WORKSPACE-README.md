# SEO Auditor v0.9.2.2 — AI workspace redesign

## Changes
- Responsive AI workspace with clearer hierarchy and consistent dark styling.
- Compact project AI settings, connection indicator and per-audit summary.
- Analysis history with expandable review cards.
- Editable before/after comparison, evidence disclosure, and recorded approval/rejection status.
- Client-side search, status and priority filtering for **loaded** reviews.
- CSV export of **loaded** review records.
- Explicit warnings that approving a suggestion does not publish or create a WordPress remediation proposal.

## Deployment
Copy into the existing source checkout, retaining your local `.env`, secrets, database and `.git` history.
Run `pnpm install`, `pnpm build`, `pnpm typecheck`, `pnpm test`, `pnpm lint`.
No new Prisma migration is required for this UI update; the existing v0.9.2 `AiRemediationReview` table must already exist.

## Boundaries
This release does **not** implement automatic conversion of approved suggestions into WordPress remediation proposals.
Review decisions remain persisted through the existing v0.9.2 API. The next backend increment should add
an explicit, independently validated proposal conversion endpoint with eligibility and mapping checks.
The summary counts and CSV export represent only reviews loaded in this browser session, not the entire project.
