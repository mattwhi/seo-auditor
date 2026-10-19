# SEO Auditor full-source release — project tabs, deletion and PDF export

This is a complete source repository based on the supplied 2026-10-19 upload, with the previously prepared feature patch applied.

## Changes
- Administrator project integrations use tabs instead of a stacked form.
- Administrator project deletion API with typed name confirmation and active audit protection.
- Audit dashboard PDF export route and download control.
- Root `pnpm dev` selects API, web and worker by package name to avoid the prior unmatched workspace filter.

## Local setup
1. Supply local `.env` and secret files from your existing secure configuration. They are deliberately NOT in this archive.
2. Run `corepack enable` (if needed), `pnpm install --frozen-lockfile`, `pnpm dev`.
3. Before deploying: `pnpm typecheck`, `pnpm test`, `pnpm build`.
4. Test deletion against a disposable project on staging, not production.
5. Push to GitHub and deploy the newly built GHCR image with `compose.ghcr.yml`.

## Caution
- The feature patch has not been fully compiled or end-to-end tested in this environment.
- Project deletion is permanent. Back up your database and validate foreign-key cleanup and job cancellation before enabling in production.
- No Prisma migration was added for these changes.
- PDF is a text-first report, not yet the premium graphical client report.
