# v0.8 — WordPress / WooCommerce integration foundation

This initial v0.8 release adds **opt-in, read-only WordPress REST discovery**, WooCommerce namespace detection, and SEO issue-to-remediation previews. It does **not** write to WordPress, collect WordPress passwords, or claim that a fix has been applied.

## Configuration (API only)

```dotenv
WORDPRESS_INTEGRATIONS_ENABLED=true
WORDPRESS_PROJECT_SITES='{"https://jasperstreatshop.com":{"siteUrl":"https://jasperstreatshop.com/","enabled":true}}'
```

The target must be HTTPS and exactly the same origin as the audited project; redirects are refused. The public REST index `/wp-json/` is fetched with a 10-second timeout. A WooCommerce namespace indicates that its REST routes are registered, **not** that the store's authenticated management API is accessible. An unavailable or blocked REST index is reported, not treated as a successful connection.

### Endpoints

- `GET /api/v1/projects/:projectId/wordpress/status` — public REST index and detected namespaces.
- `GET /api/v1/audits/:auditId/wordpress/remediation-preview?issueId=...` — draft guidance for an issue in that audit, never a write operation.

### Security and scope

The API currently lacks per-user authentication. Therefore, **no approve, apply, or rollback endpoints are exposed**. The next stage requires authenticated operators, project-scoped permissions, encrypted credential storage, narrowly scoped WordPress application passwords, allowlisted change types, before-state capture, concurrency checks, audit logging, rollback and post-change verification. Yoast and Rank Math metadata must be handled by tested platform adapters rather than generic WordPress post updates.

Do not expose the existing unauthenticated API to the public internet. This foundation is safe for existing read-only installations and does not require database migrations.

### VM deployment

Add the two non-secret variables to `/opt/seo-auditor/.env`. The API uses `env_file: .env` in `docker-compose.yml`. Keep existing `compose.google.yml` and its read-only Google secret mount. Automated GHCR deploy continues using the existing Compose files and image tag.
