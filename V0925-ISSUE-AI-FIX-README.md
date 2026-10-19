# v0.9.2.5 — Issue-specific AI SEO fix generator

1. Open Remediation Centre > Proposals & verification > Create SEO fix.
2. Select a title/description issue; the current value loads from the saved crawl.
3. Generate with AI, optionally Shuffle. Review or edit the proposed value.
4. Confirm AI suggestion and create a draft via existing remediation controls.
5. Approve, preflight and execute separately. Nothing is automatically published.

The AI endpoint requires authentication, project AI enablement, a completed project audit and a supported issue. No Prisma migration is needed. The existing full AI analysis remains available.

Limitations: Current values are crawl snapshots, not live WordPress values. The API-instance-local generation quota is not suitable as a distributed production quota; move it to Redis for multi-instance deployments. This build has not run a full pnpm compilation or test suite.

Validation: pnpm install && pnpm build && pnpm typecheck && pnpm test && pnpm lint
