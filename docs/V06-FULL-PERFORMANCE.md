# v0.6 — Performance auditing

## Scope

- Runs Google PageSpeed Insights for up to four deterministic, representative pages per audit: homepage, product category, product, article, when indexable HTML candidates are available.
- Runs mobile and desktop for each sampled URL (up to eight API requests per audit by default).
- Captures Lighthouse lab score, LCP, CLS, FCP, TBT, Speed Index and selected Lighthouse diagnostic audits, including LCP element, render blocking and image optimisation where returned by Google.
- Preserves URL-level CrUX LCP, CLS and INP percentiles when Google supplies them. No origin-level fallback is misrepresented as URL-level data.
- Exposes historical lab averages per audit and separate mobile/desktop performance summaries. These never affect technical SEO scoring.
- PageSpeed API failures are persisted as unavailable runs and do not fail the crawl.

## Production setup

In `/opt/seo-auditor/.env` set:

```dotenv
PERFORMANCE_ENABLED=true
PAGESPEED_API_KEY=replace_with_your_rotated_restricted_key
PERFORMANCE_MAX_PAGES=4
```

The repository's `docker-compose.yml` and `compose.vm.yml` now explicitly forward these settings to the worker. Do not commit the `.env` file. Recreate the worker after changing settings. The production compose override requires the `IMAGE_TAG` set by the deployment script.

## Acceptance criteria

1. `pnpm install --frozen-lockfile && pnpm lint && pnpm typecheck && pnpm test && pnpm build` succeed on a clean install.
2. CI Validate → Publish → Deploy all succeed.
3. New audit stores mobile and desktop measurements for each available representative page type.
4. Performance tab displays separate scores, diagnostic evidence and previous audit history.
5. Missing CrUX field data is shown as unavailable, never as zero.
6. PageSpeed quota/network errors are recorded without failing the SEO audit.
7. Technical SEO score remains independent of PageSpeed results.

## Notes

Lighthouse is lab data and may vary between runs. Historical averages are simple means of available representative sampled lab scores, not traffic-weighted Core Web Vitals. CrUX p75 values are real-user field data only when present. API quota and response times may make audits take longer.
