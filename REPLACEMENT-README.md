# SEO Auditor v0.5 complete source replacement

This archive is a **complete source tree**, not a partial overlay. All apps and workspace packages are included.

**Safety:** Keep your existing `.git`, `.env`, and other local secrets. Do not delete your repository directory or extract over an existing working tree without a backup. Prefer extracting to a new directory, copying your existing `.env` only if needed, and comparing against your Git checkout.

Changes: issue detail now restricts findings to the selected severity and loads all matching pages; H1 evidence lists texts and positions; missing-alt evidence lists source and position and distinguishes missing attributes from `alt=""`; heading/indexable content checks respect non-self canonicals; Next.js app favicon.

After extracting, run `pnpm install --frozen-lockfile`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` from the repository root. Do not push until CI succeeds. Existing audit evidence is unchanged; rerun an audit for new evidence.
