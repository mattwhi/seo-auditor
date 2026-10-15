# SEO Auditor v1.1.0-alpha.2 — administration (Mac only)

Adds `/admin/users` to list users, assign ADMIN/USER/READ_ONLY roles, disable/reactivate accounts, revoke pending invitations, and view a bounded administration event history. Server-side authorization requires an active ADMIN session; changes require same-origin requests. Disabling an account or changing its role revokes existing sessions. A serializable database transaction protects the last active administrator. Revoked invitations cannot be accepted.

## Mac validation
1. `corepack pnpm install --frozen-lockfile`
2. Confirm DATABASE_URL is **local** (never production).
3. `corepack pnpm --filter @seo-auditor/database exec prisma migrate deploy`
4. `corepack pnpm --filter @seo-auditor/database exec prisma generate`
5. `corepack pnpm typecheck && corepack pnpm test && corepack pnpm build`
6. Test admin changes with two local accounts, verify disabled sessions are rejected, role changes take effect, revoked invitation cannot register, last active admin cannot be disabled or demoted, and read-only/user cannot access `/api/admin/management`.

## Not yet production-ready
The separate API service still requires an independent ingress/auth boundary. Distributed rate limiting, CSRF/origin hardening, mail delivery, password recovery, broad worker-level RBAC and WordPress write controls are future milestones. Production deployment workflow is unchanged. Do not merge to main or deploy to Ubuntu.
