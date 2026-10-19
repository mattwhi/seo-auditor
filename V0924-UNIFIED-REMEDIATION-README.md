# v0.9.2.4 — Unified AI Remediation Centre

## What changed
- Replaces separate AI and Remediation navigation tabs with one Remediation Centre.
- Page remediation: select a crawled page, run existing OpenAI page analysis, review that page's saved recommendations, edit, approve and create an eligible WordPress draft.
- Full AI analysis: preserves the existing AI workspace across all saved analyses for the current audit.
- Review queue: focuses the existing human approval interface.
- Proposals & verification: retains the existing WordPress remediation proposal approval, read-only preflight, execution and rollback UI.
- No new database schema or automatic publishing.

## Notes
- “Full AI analysis” means all saved page analyses in the audit; it does NOT trigger a site-wide batch analysis.
- The existing backend's eligibility and WordPress mapping restrictions remain authoritative. Unsupported suggestions cannot be converted to drafts.
- All review and proposal operations use the existing authenticated routes.
- Review queue is the existing analysis-based review experience, not a new project-wide aggregation endpoint.
- Keep `.env`, encryption secrets and PostgreSQL data from your current installation. No secrets are included.

## Local checks
pnpm install
pnpm build
pnpm typecheck
pnpm test
pnpm lint

Do not deploy to production until these checks and the UI workflow pass.
