# v0.6 final refinement candidate

Complete repository replacement. Adds bounded Lighthouse resource evidence, readable per-diagnostic resource tables, lab measurement context, like-for-like URL/device history, and archive-aware WordPress sampling. Existing audit data remains compatible: new JSON properties are optional in the dashboard.

**Limitations:** WordPress custom post permalinks without recognisable URL patterns may not be selected. Missing resource details mean the PageSpeed API did not provide them, not that no resources were involved. Field CrUX data is distinct from lab data.

Run `pnpm install --frozen-lockfile && pnpm lint && pnpm typecheck && pnpm test && pnpm build` before deployment.
