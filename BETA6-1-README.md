# v1.1.0-beta.6.1 — Integration UI hotfix

- Fix `invalid_mapping` for nullable/omitted optional integration fields.
- Canonicalize the WordPress discovery URL when enabled and the URL field is blank.
- Retain strict HTTPS same-origin WordPress URL validation.
- Improve save error messages and success state.
- Style integration form inputs to match the dark administration UI.
- Replace misleading red infrastructure restriction messaging with neutral informational copy.

**Note:** This does not grant infrastructure capabilities or test API credentials. The dashboard process cannot determine credentials in the API container.

Test locally: `corepack pnpm typecheck && corepack pnpm test && corepack pnpm build`. No schema migration required.
