# SEO Auditor v0.5 hardening patch + favicon

Apply these files at the repository root, preserving directory structure. No Prisma schema migration is required.

## Changes
- Issue workspace now requests issues by **rule ID and severity**, with API pagination and server-side URL search. This prevents informational canonical/noindex variants appearing as actionable duplicates.
- H1 evidence includes heading texts and positions.
- Image-alt evidence includes source URLs and positions. Missing `alt` attributes are distinct from intentional `alt=""` (decorative images are not automatically treated as errors).
- Page-level content rules now skip non-self canonical variants as well as noindex pages.
- New Next.js App Router favicon at `apps/web/app/icon.svg`.
- Regression tests added for image alt extraction and rule evidence.

## Validation
Run on your Mac before pushing:

```sh
pnpm install --frozen-lockfile
pnpm --filter @seo-auditor/database db:generate
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Then commit and push; your CI/CD workflow will deploy if all checks pass. Run a **new audit** to see newly captured heading/image evidence. Existing stored findings are not backfilled.

**Note:** This environment cannot install pnpm dependencies from the network, so the full project checks have not been executed here. Do not treat this as a verified release until CI passes.
