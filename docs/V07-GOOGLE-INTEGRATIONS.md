# v0.7 — Google integrations (read-only, service-account mode)

This release adds a Google tab with Search Console page clicks, impressions, CTR, average position, and GA4 landing-page sessions, users, and engaged sessions. It does **not** alter audit scoring or write to Google properties.

## Security / access model

**Important:** The current SEO Auditor API has no user authentication or per-project authorisation. Do not expose the API or web dashboard to the public Internet until an authentication and authorisation layer is in place. A Google service account provides application-level access, **not** individual user OAuth consent. This mode is intended for privately operated deployments where the administrator owns or has been granted access to the Google properties.

Never put credentials in the browser, source control, Docker images, or logs. Rotate keys when exposed. Prefer secret management and workload identity where available.

## Configure

1. Create a Google Cloud service account with read-only access to the required Google Search Console property and GA4 property. Enable **Google Search Console API** and **Google Analytics Data API** in the Google Cloud project. In Search Console, add the service-account email as a property user. In GA4, grant it **Viewer** access to the property.
2. **v0.7.1:** Prefer a read-only mounted JSON credentials file via `GOOGLE_SERVICE_ACCOUNT_FILE` on the **API** container. Legacy `GOOGLE_SERVICE_ACCOUNT_JSON` is still supported when the file setting is absent. If both are set, the file takes precedence.
3. Set `GOOGLE_INTEGRATIONS_ENABLED=true` on the API container.
4. Set `GOOGLE_PROJECT_PROPERTIES` to a JSON map of SEO Auditor project base URLs to properties. Example:

```json
{"https://example.com":{"searchConsoleSiteUrl":"sc-domain:example.com","ga4PropertyId":"123456789"}}
```

`searchConsoleSiteUrl` must match the Search Console property identifier exactly (URL-prefix property such as `https://example.com/` or domain property such as `sc-domain:example.com`). `ga4PropertyId` is the **numeric GA4 property ID**, not a measurement ID.

For Docker Compose, add these variables to the **api** service's environment (or use a protected `env_file` passed to that container), then recreate the API container. Do not echo the secret into CI logs. Keep the existing production `IMAGE_TAG` when using deployment Compose overrides.

## API endpoints

- `GET /api/v1/projects/:projectId/google/status`
- `GET /api/v1/projects/:projectId/google/search-console?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD`
- `GET /api/v1/projects/:projectId/google/analytics?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD`

Google calls are on demand; there is no automatic polling or stored historical Google data in this release. The UI uses the last 28 complete days ending three days before today to allow for data freshness. Search Console returns at most 100 page rows; its displayed totals are **not** site-wide totals. GA4 landing-page results include **all channels**, not just organic search. The reports have different attribution and measurement methodologies and should not be added together.

## Known limitations

- Service-account mode only; no multi-user OAuth or account-picker workflow.
- No historical Google snapshot persistence or background sync yet.
- No GSC query-level drill-down or GA4 organic-only filter yet.
- The existing unauthenticated API must remain private.

## v0.7.1 production Docker configuration (file-based credentials)

Place the service account JSON on the Ubuntu host at `/opt/seo-auditor/secrets/google-service-account.json`, owned by root with mode `600`. The default application image runs as root; if you change the container user, grant that UID read access without making the key world-readable.

Set only **non-secret** variables in `/opt/seo-auditor/.env`:

```dotenv
GOOGLE_INTEGRATIONS_ENABLED=true
GOOGLE_PROJECT_PROPERTIES='{"https://jasperstreatshop.com":{"searchConsoleSiteUrl":"sc-domain:jasperstreatshop.com","ga4PropertyId":"REPLACE_WITH_NUMERIC_PROPERTY_ID"}}'
```

Confirm that the Search Console property identifier and exact SEO Auditor project base URL match your records.

Use `compose.google.yml` as an additional **last** override in both manual and automated production Compose invocations, e.g.:

```sh
docker compose -f docker-compose.yml -f compose.vm.yml -f compose.deploy.yml -f compose.google.yml up -d --no-deps --force-recreate api
```

`IMAGE_TAG` must already be set to the currently deployed GHCR image tag. **Update `/opt/seo-auditor/deploy-ghcr.sh` to include `-f compose.google.yml` in its Compose file list before the next automated deployment.** Otherwise a subsequent deployment will remove the file mount. Keep the JSON outside the repository, and do not print `docker inspect` environment values.

The API reports `credentialsConfigured=true` when a file path is configured; that does not guarantee that the file is readable or the Google API permissions are correct. Verify with an actual report request.
