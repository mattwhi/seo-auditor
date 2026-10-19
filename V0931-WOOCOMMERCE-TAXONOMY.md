# v0.9.3.1 — WooCommerce product-category remediation

This release adds exact-URL matching for `/product-category/<slug>/` using the public WordPress REST `wp/v2/product_cat` taxonomy endpoint. It does not guess term IDs. The existing proposal approval, preflight, compare-and-swap write and verification workflow is preserved.

## Required WordPress update

Update the bundled **SEO Auditor Metadata Bridge** plugin on your WordPress site. The API alone cannot write taxonomy metadata. The updated bridge reads and writes Rank Math SEO title/description via **term meta** (`get_term_meta` / `update_metadata('term', ...)`) and checks `edit_term` permission, administrator approval and bridge write enablement. Existing post/page/product handling remains intact.

## Important prerequisites

The WordPress REST taxonomy endpoint `/wp-json/wp/v2/product_cat?slug=lamb&_fields=id,link` must be available and return a `link` exactly matching the audited URL. If WooCommerce does not expose the taxonomy endpoint, mapping fails closed and requires manual review; no guessed ID or fallback is used. Rank Math must be active and store its taxonomy metadata under the standard `rank_math_title` and `rank_math_description` term meta keys. The WordPress account must have taxonomy edit permission.

## Validation

Run `pnpm install`, `pnpm build`, `pnpm typecheck`, `pnpm test`, `pnpm lint` and PHP lint `php -l wordpress-plugin/seo-auditor-bridge/seo-auditor-bridge.php`. Test category mapping and an authenticated read-only preflight before enabling live writes. A successful write does not guarantee that Rank Math renders the new title immediately; recrawl and inspect the page separately.
