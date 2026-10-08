# SEO Auditor v0.6 — Complete replacement candidate

This is a **complete monorepo source replacement** based on the supplied v0.6 repository. The archive excludes `.git`, `.env`, `node_modules`, generated build artifacts and macOS metadata.

Added representative page sampling, PageSpeed diagnostics, performance history, mobile/desktop summary scores, CWV threshold helpers and regression tests. Docker Compose now passes the performance configuration into the worker.

**Validation status:** isolated performance TypeScript compilation and three regression tests passed. Full monorepo pnpm lint/typecheck/test/build and GitHub Actions have not been run in this environment. Do not deploy until those are green.

Read `docs/V06-FULL-PERFORMANCE.md` before deploying. Rotate the Google API key previously shared in chat.
