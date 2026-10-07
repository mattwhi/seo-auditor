# Validation status

The repository received static structure/JSON validation in the build environment.

Full dependency installation, TypeScript compilation and tests could not be executed in that environment because DNS access to `registry.npmjs.org` returned `EAI_AGAIN` while Corepack attempted to obtain pnpm 10.18.3.

Run the following in a network-enabled development/CI environment before treating v0.1.0 as release-ready:

```bash
corepack enable
pnpm install
pnpm --filter @seo-auditor/database db:generate
pnpm typecheck
pnpm test
pnpm build
```
