# v1.1.0-alpha.2 — Administration UI polish

Changes: refined Users & Roles and Invitations pages; copy invitation link button; logout uses full navigation after session invalidation to prevent stuck Signing out state. No database or deployment changes.

On Mac: keep your existing local .env and database; run `corepack pnpm typecheck && corepack pnpm build`, then `corepack pnpm dev`. Test logout, user role changes, and invitations.

Do not deploy to production yet.
