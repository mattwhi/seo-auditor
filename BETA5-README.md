# SEO Auditor v1.1.0-beta.5 — Remediation boundary hardening

## Included
- Strict type-guarded validation of project/proposal/preflight IDs before use in upstream routes and audit entries; removes the `String(unknown)` workaround.
- Activity records for both successful and unsuccessful upstream approval, rejection, preflight, execution and rollback responses, with HTTP status and success flag.
- Controlled `502 remediation_service_unavailable` on upstream transport failures, without exposing service credentials or internal URLs.
- An activity-log database failure no longer converts a successful upstream operation into a client-visible failure. **This is best-effort logging, not a transactional audit guarantee.**
- Root and web package versions aligned to beta.5.

## Still required before production release
- Durable API-side approver attribution with tamper-resistant identity propagation; web activity log alone is insufficient.
- Reliable transactional/security audit logging for privileged operations; avoid relying on best-effort logs for compliance.
- Integration secret management, distributed login rate limiting, MFA/recovery, and full release/deployment validation.
- Verify the existing manual GitHub deploy script and Compose overlay; no Ubuntu host changes in this archive.

## Mac validation
`corepack pnpm install --frozen-lockfile`
`corepack pnpm typecheck`
`corepack pnpm test`
`corepack pnpm build`

Test malformed IDs, failed upstream requests, ADMIN versus USER/READ_ONLY access, CSRF and audit activity.
