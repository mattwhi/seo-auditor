# Remediation UI and WordPress bridge update

- Consistent styled remediation buttons and clear refresh feedback.
- Refresh reloads proposals and the selected proposal's preflight/execution state.
- Confirmation dialog shows the exact URL, SEO field, previous snapshot, and proposed value before live execution or rollback.
- WordPress bridge v0.8.5: WordPress **Settings → SEO Auditor Bridge** includes an administrator-only write permission checkbox (disabled by default for new installs). The legacy `SEO_AUDITOR_BRIDGE_WRITES_ENABLED` constant remains supported; if set to true, it overrides the checkbox.

## Deployment

1. Preserve the existing database and environment secrets; do not replace them with values from an archive.
2. Update the SEO Auditor application, install dependencies and run the usual typecheck/build/tests.
3. Upload `wordpress-plugin/seo-auditor-bridge` to the WordPress site's plugin directory, replacing the previous bridge, and check **Settings → SEO Auditor Bridge**.
4. Enable writes only when ready. The bridge still requires a WordPress account with `manage_options` and `edit_post` for the target.
5. Reconcile any existing `needs_review` execution against the live WordPress metadata before creating another proposal. Never blindly retry.

## Validation

PHP syntax checked with `php -l`. TypeScript build and browser integration were not run in this environment. No live WordPress writes were performed.
