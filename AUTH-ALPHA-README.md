# SEO Auditor v1.1.0-alpha.1 — invitation-only authentication

**Source changes only. No production deployment has been performed.**

## Included
- Prisma migration for users, hashed sessions, single-use 48-hour invitations.
- Login, logout, invitation-only account creation, admin invitation-link generator.
- Three initial roles: ADMIN, USER, READ_ONLY. User and admin can mutate general audit API; read-only cannot. Remediation route requires admin *in addition* to its existing operator credential gate.
- Basic Auth dashboard dependency removed from `apps/web/proxy.ts` and `compose.production.yml`.
- Password hashing with salted scrypt; random session and invitation tokens stored only as SHA-256 digests.

## Mac verification (required before release)
1. `corepack pnpm install --frozen-lockfile`
2. `corepack pnpm --filter @seo-auditor/database db:generate`
3. `corepack pnpm typecheck && corepack pnpm test && corepack pnpm build`
4. Against a disposable local PostgreSQL instance, apply migrations using `corepack pnpm --filter @seo-auditor/database exec prisma migrate deploy`.
5. In a **local disposable database only**, bootstrap first admin with `corepack pnpm --filter @seo-auditor/database exec node scripts/bootstrap-admin.mjs`. This is interactive and refuses when any user exists. Do not commit passwords.
6. Exercise login/logout, invalid password, invitation expiry and reuse, role checks and CSRF rejection; verify WordPress writes remain disabled.

## Limitations / blockers before production
- **Not production-ready**: package installation/build/tests were not runnable in this environment (npm registry unreachable). Run Mac/GitHub CI and end-to-end tests.
- No SMTP email provider wired: admin creates one-time invitation URL at `/admin/invitations` and must share it privately. Email delivery and verification remain future work.
- The in-memory login throttle is per-process only; implement Redis-backed distributed rate limiting before exposing publicly.
- Password reset, email verification, MFA, session management UI and comprehensive audit logs remain future work.
- API service may be reachable separately; secure its ingress or enforce authorization at API level before public deployment. Next.js proxy protects only `/api/backend` traffic.
- Admin UI and authorization require additional hardening; frontend cookie presence is navigation only and not proof of session.
- `REMEDIATION_WRITES_ENABLED=false` must remain in the infrastructure overlay. This alpha does not add admin WordPress write toggles.
- Deploy workflow is **unchanged** and currently automatically deploys on merge to main. Do not merge until the release workflow is decoupled and reviewed.
- The first admin bootstrap procedure needs a controlled production migration/initialization plan through GitHub Actions; do not SSH into Ubuntu to bootstrap.
