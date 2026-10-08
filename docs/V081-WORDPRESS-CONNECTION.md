# v0.8.1 — Authenticated WordPress connection and read-only issue mapping

## Scope and safety

This release adds **server-side WordPress Application Password authentication** and **read-only issue-to-content mapping**. It does not add operator authentication, approvals, WordPress write endpoints, or rollback. **Keep SEO Auditor on a private network.** The REST connection status returns only booleans and error codes; credentials and WordPress user data are never returned to the browser.

## WordPress setup

1. On the WordPress site, create a dedicated integration user with the minimum permissions necessary to read the intended content (start with Subscriber for connection testing; additional roles may be required for protected content). Use **Users → Profile → Application Passwords** to create a password for SEO Auditor. This is a WordPress application password, not the account login password.
2. On the Ubuntu host create `/opt/seo-auditor/secrets/wordpress-connections.json` with the following JSON, replacing placeholders **on the VM only**:

```json
{"https://jasperstreatshop.com/":{"username":"WORDPRESS_INTEGRATION_USERNAME","applicationPassword":"WORDPRESS_APPLICATION_PASSWORD"}}
```

3. Set owner `root:root` and mode `600`. Never commit or paste this file. The current API container runs as root; revisit permissions if running rootless.
4. Add `-f compose.wordpress.yml` **after** `-f compose.google.yml` in `/opt/seo-auditor/deploy-ghcr.sh` and ensure the override exists on the VM **before deploying**. The existing deployment script does not synchronise Compose files.
5. Retain `WORDPRESS_INTEGRATIONS_ENABLED=true` and the existing `WORDPRESS_PROJECT_SITES` mapping in `.env`.
6. Recreate only the API container with all five Compose files and the currently deployed `IMAGE_TAG`, or let CI deploy after the override is in place.

The API checks `GET /wp-json/wp/v2/users/me?context=edit` with Basic authentication over HTTPS. Only a verified/unverified status is returned. WordPress REST authentication may be blocked by security plugins, reverse proxies, or disabled Application Passwords.

## API

- `GET /api/v1/projects/:projectId/wordpress/status` — public capability discovery.
- `GET /api/v1/projects/:projectId/wordpress/connection` — configured/authenticated status, no user details.
- `GET /api/v1/audits/:auditId/wordpress/remediation-preview?issueId=...` — existing draft advice.
- `GET /api/v1/audits/:auditId/wordpress/issue-mapping?issueId=...` — tries exact permalink matching against `wp/v2/posts`, `wp/v2/pages`, and `wp/v2/product` by slug. Returns `matched` only for exactly one verified match, otherwise `manual_review`. It never edits content. WooCommerce products might not expose `wp/v2/product` on all installations; those require manual review until a platform-specific adapter is added.

### Limitations

- Only same-origin HTTPS WordPress endpoints are contacted, with redirects rejected.
- This is not an authenticated operator workflow; don't expose the API to the internet.
- Mapping is conservative: custom permalinks, archives, category pages, attachments, duplicate slugs and private content may require manual review.
- The public dashboard only shows connection status. Issue mapping is available via the API for now.
- No database schema changes or secret values in Docker image.
