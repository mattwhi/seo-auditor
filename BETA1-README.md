# v1.1.0-beta.1 — WordPress project write controls (first slice)

Mac-only source changes. Do not merge or deploy to production yet.

- Adds a default-disabled database policy per project and admin controls at `/admin/wordpress`.
- API execution AND rollback now require project policy enabled as well as the existing infrastructure flag, origin allowlist, execution token, approval and preflight gates.
- Admin changes are recorded in `DashboardAdminEvent`.
- **Important:** This is not yet the complete RBAC/remediation approval release. The API execution token remains an independent operator capability and is not tied to the dashboard user's identity. The backend API must remain private.
- Rollback is also blocked when policy is off; emergency rollback procedures need explicit design.
- The dashboard's `infrastructureEnabled` status is read from the web container and is informational only; the API container is authoritative.
- No GitHub workflow or production Compose changes in this slice.

Local Mac verification: load LOCAL DATABASE_URL; `corepack pnpm --filter @seo-auditor/database exec prisma migrate deploy`; `corepack pnpm --filter @seo-auditor/database exec prisma generate`; `corepack pnpm typecheck && corepack pnpm test && corepack pnpm build`. Test default-deny execute/rollback and role restrictions before any release.
