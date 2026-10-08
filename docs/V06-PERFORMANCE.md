# v0.6 Performance integration — initial implementation

The worker optionally requests PageSpeed Insights for the audit entry URL, once for **mobile** and once for **desktop**. This is not yet a multi-page performance sampling engine.

Set `PERFORMANCE_ENABLED=true` in the **worker container environment** and supply `PAGESPEED_API_KEY` (recommended; provision in Google Cloud). Recreate/redeploy the worker and start a **new** audit. Each request can take up to 90 seconds; failures are recorded as `unavailable` and never fail the SEO audit. The feature is off by default to avoid unexpected API quota use and long audit durations.

Results are persisted in `PerformanceResult` (one record per audit and device) and exposed at `GET /api/v1/audits/:auditId/performance`. Open the **performance** tab for Lighthouse lab score, LCP, CLS, FCP, TBT and available CrUX p75 LCP/CLS/INP. Field metrics can be absent on low-traffic URLs; never interpret absent data as a pass or zero. No lab INP is fabricated. The v0.5 technical SEO score is unchanged.

**Deployment:** The existing migration container runs `prisma db push` before services start; this adds the performance table. Back up the database before deployment. Set the worker environment variable via the VM's deployment compose configuration or env_file, not in Git.

**Next v0.6 work:** representative URL sampling, per-template measurements, run history/trends, retry/backoff and quotas, CWV threshold assessment, PSI response validation, and independent performance scoring. This initial increment is not a complete v0.6 release.
