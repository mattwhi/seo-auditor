# UI refresh — alpha.2

Changes: responsive branded login page, global top navigation, admin-only links to Users & Roles and Invitations, session-backed account display, functional logout. Existing backend auth routes unchanged.

On Mac, preserve local .env files and run: corepack pnpm typecheck && corepack pnpm build. Verify logout and ADMIN / USER / READ_ONLY navigation. Do not merge to main: deployment still automatic.
