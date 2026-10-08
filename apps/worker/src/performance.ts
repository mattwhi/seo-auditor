/** PageSpeed Insights v5 lab and optional CrUX field data. No fabricated metrics. */
export type Metric = { value: number | null; displayValue: string | null };
export type PerformanceMeasurement = {
  strategy: 'mobile' | 'desktop'; status: 'completed' | 'unavailable';
  measuredAt: string; url: string; error: string | null;
  lighthouseScore: number | null; lcp: Metric; cls: Metric; inp: Metric; fcp: Metric; tbt: Metric; speedIndex: Metric;
  fieldLcp: number | null; fieldCls: number | null; fieldInp: number | null;
  diagnostics: PerformanceDiagnostic[]; fieldSource: 'url' | 'origin' | 'none';
  context: { lighthouseVersion: string | null; fetchTime: string | null; requestedUrl: string; finalUrl: string | null };
};
export type PerformanceDiagnostic = { id: string; title: string; description: string | null; displayValue: string | null; score: number | null; savingsMs: number | null; element: string | null; resources: DiagnosticResource[] };
export type DiagnosticResource = { url: string | null; transferSize: number | null; totalBytes: number | null; wastedBytes: number | null; wastedMs: number | null; element: string | null };
const diagnosticIds = ['largest-contentful-paint-element', 'lcp-discovery-insight', 'lcp-breakdown-insight', 'render-blocking-resources', 'render-blocking-insight', 'modern-image-formats', 'uses-optimized-images', 'uses-responsive-images', 'offscreen-images', 'unused-javascript', 'unused-css-rules', 'server-response-time', 'document-latency-insight', 'network-dependency-tree-insight', 'third-party-summary', 'total-byte-weight', 'dom-size', 'layout-shift-elements', 'cls-culprits-insight'];
const empty = (): Metric => ({ value: null, displayValue: null });
const numberOrNull = (value: unknown): number | null => typeof value === 'number' && Number.isFinite(value) ? value : null;
const metric = (audits: Record<string, { numericValue?: unknown; displayValue?: unknown }> | undefined, id: string): Metric => {
  const item = audits?.[id];
  return { value: numberOrNull(item?.numericValue), displayValue: typeof item?.displayValue === 'string' ? item.displayValue : null };
};
type PageSpeedResponse = {
  lighthouseResult?: {
    audits?: Record<string, { numericValue?: unknown; displayValue?: unknown; title?: unknown; description?: unknown; score?: unknown; details?: { items?: Array<Record<string, unknown>> }; numericUnit?: unknown }>;
    lighthouseVersion?: unknown; fetchTime?: unknown; requestedUrl?: unknown; finalDisplayedUrl?: unknown; finalUrl?: unknown;
    categories?: { performance?: { score?: unknown } };
  };
  originLoadingExperience?: { metrics?: Record<string, { percentile?: unknown }> };
  loadingExperience?: { metrics?: Record<string, { percentile?: unknown }> };
};
export function parsePageSpeed(raw: unknown, strategy: 'mobile' | 'desktop', url: string): PerformanceMeasurement {
  const body = (raw ?? {}) as PageSpeedResponse;
  const lighthouse = body.lighthouseResult;
  const audits = lighthouse?.audits;
  const field = body.loadingExperience?.metrics as Record<string, { percentile?: unknown }> | undefined;
  const categoryScore = numberOrNull(lighthouse?.categories?.performance?.score);
  return {
    strategy, status: 'completed', measuredAt: new Date().toISOString(), url, error: null,
    lighthouseScore: categoryScore === null ? null : Math.round(categoryScore * 100),
    lcp: metric(audits, 'largest-contentful-paint'), cls: metric(audits, 'cumulative-layout-shift'),
    inp: empty(), // Lighthouse lab runs do not measure real-user INP.
    fcp: metric(audits, 'first-contentful-paint'), tbt: metric(audits, 'total-blocking-time'),
    speedIndex: metric(audits, 'speed-index'),
    fieldLcp: numberOrNull(field?.LARGEST_CONTENTFUL_PAINT_MS?.percentile),
    fieldCls: numberOrNull(field?.CUMULATIVE_LAYOUT_SHIFT_SCORE?.percentile),
    fieldInp: numberOrNull(field?.INTERACTION_TO_NEXT_PAINT?.percentile),
    fieldSource: field && Object.keys(field).length ? 'url' : 'none',
    context: { lighthouseVersion: typeof lighthouse?.lighthouseVersion === 'string' ? lighthouse.lighthouseVersion : null, fetchTime: typeof lighthouse?.fetchTime === 'string' ? lighthouse.fetchTime : null, requestedUrl: url, finalUrl: typeof lighthouse?.finalDisplayedUrl === 'string' ? lighthouse.finalDisplayedUrl : typeof lighthouse?.finalUrl === 'string' ? lighthouse.finalUrl : null },
    diagnostics: diagnosticIds.flatMap((id) => {
      const audit = audits?.[id];
      if (!audit) return [];
      const first = audit.details?.items?.[0];
      const node = first?.node as { snippet?: unknown; selector?: unknown } | undefined;
      const element = typeof node?.snippet === 'string' ? node.snippet : typeof node?.selector === 'string' ? node.selector : null;
      const resources = (audit.details?.items ?? []).slice(0, 25).flatMap((item) => {
        const candidate = (item.node && typeof item.node === 'object' ? item.node : null) as Record<string, unknown> | null;
        const urlValue = typeof item.url === 'string' ? item.url : typeof item.source === 'string' ? item.source : null;
        const elementValue = typeof candidate?.snippet === 'string' ? candidate.snippet : typeof candidate?.selector === 'string' ? candidate.selector : null;
        const resource = { url: urlValue, transferSize: numberOrNull(item.transferSize), totalBytes: numberOrNull(item.totalBytes), wastedBytes: numberOrNull(item.wastedBytes), wastedMs: numberOrNull(item.wastedMs), element: elementValue };
        return Object.values(resource).some((v) => v !== null) ? [resource] : [];
      });
      return [{ id, title: typeof audit.title === 'string' ? audit.title : id, description: typeof audit.description === 'string' ? audit.description.slice(0, 500) : null, displayValue: typeof audit.displayValue === 'string' ? audit.displayValue : null, score: numberOrNull(audit.score), savingsMs: numberOrNull(audit.numericValue) && audit.numericUnit === 'millisecond' ? numberOrNull(audit.numericValue) : null, element, resources }];
    }),
  };
}
export async function measurePageSpeed(url: string, strategy: 'mobile' | 'desktop', apiKey?: string): Promise<PerformanceMeasurement> {
  const target = new URL(url);
  if (target.protocol !== 'https:' || !target.hostname || target.username || target.password) throw new Error('Performance target must be a public HTTPS URL');
  const endpoint = new URL('https://www.googleapis.com/pagespeedonline/v5/runPagespeed');
  endpoint.searchParams.set('url', target.href);
  endpoint.searchParams.set('strategy', strategy);
  endpoint.searchParams.set('category', 'performance');
  if (apiKey) endpoint.searchParams.set('key', apiKey);
  const response = await fetch(endpoint, { signal: AbortSignal.timeout(90000) });
  if (!response.ok) throw new Error(`PageSpeed API returned HTTP ${response.status}`);
  return parsePageSpeed(await response.json(), strategy, target.href);
}
export function failedMeasurement(url: string, strategy: 'mobile' | 'desktop', error: unknown): PerformanceMeasurement {
  const message = error instanceof Error ? error.message : 'PageSpeed request failed';
  return { strategy, status: 'unavailable', measuredAt: new Date().toISOString(), url, error: message.slice(0, 250),
    lighthouseScore: null, lcp: empty(), cls: empty(), inp: empty(), fcp: empty(), tbt: empty(), speedIndex: empty(),
    fieldLcp: null, fieldCls: null, fieldInp: null, fieldSource: 'none', diagnostics: [], context: { lighthouseVersion: null, fetchTime: null, requestedUrl: url, finalUrl: null } };
}

/** Fixed thresholds use raw Lighthouse units (milliseconds for LCP/FCP/TBT, CLS unitless). */
export type VitalRating = 'good' | 'needs-improvement' | 'poor' | 'unavailable';
export function rateVital(metricName: 'lcp' | 'cls' | 'inp' | 'fcp' | 'tbt', value: number | null): VitalRating {
  if (value === null || !Number.isFinite(value)) return 'unavailable';
  const limits = { lcp: [2500, 4000], cls: [0.1, 0.25], inp: [200, 500], fcp: [1800, 3000], tbt: [200, 600] }[metricName];
  return value <= limits[0] ? 'good' : value <= limits[1] ? 'needs-improvement' : 'poor';
}
export function selectPerformanceTargets(startUrl: string, pages: Array<{ url: string; finalUrl: string; statusCode: number; contentType: string | null; canonical: string | null; robots: string[]; xRobotsTag: string[]; crawlDepth: number | null }>, maxPages = 4): Array<{ url: string; pageType: string }> {
  const origin = new URL(startUrl);
  const selected: Array<{ url: string; pageType: string }> = [{ url: origin.href, pageType: 'homepage' }];
  const candidates = pages.filter((p) => {
    try {
      const url = new URL(p.finalUrl);
      return url.origin === origin.origin && url.protocol === 'https:' && !url.search && !url.hash && p.statusCode === 200 && (p.contentType ?? '').toLowerCase().includes('text/html') && ![...p.robots, ...p.xRobotsTag].some((r) => /noindex/i.test(r)) && (!p.canonical || new URL(p.canonical, url).href === url.href) && !/\/cdn-cgi\/|\/email-protection\/?|\/wp-admin\/|\/wp-json\//i.test(url.pathname);
    } catch { return false; }
  }).sort((a, b) => (a.crawlDepth ?? 999) - (b.crawlDepth ?? 999) || a.finalUrl.localeCompare(b.finalUrl));
  // Archives are not articles. WordPress posts can use arbitrary permalinks, so
  // use the crawl's page metadata when available, then conservative URL fallbacks.
  const isArchive = (path: string) => /^\/(?:category|tag|author|product-category|product-tag|page|shop)(?:\/|$)/i.test(path) || /\/page\/\d+\/?$/i.test(path);
  const isProduct = (path: string) => /^\/product\/[^/]+\/?$/i.test(path);
  const isCategory = (path: string) => /^\/(?:product-category|category)\/[^/]+/i.test(path);
  const isArticle = (path: string) => !isArchive(path) && !isProduct(path) && path !== '/' &&
    (/^\/(?:blog|dog-treat-guides|news|articles)\/[^/]+\/?$/i.test(path) || /^\/\d{4}\/\d{2}\/[^/]+\/?$/i.test(path) || /\/(?:guide|tips|advice|how-to)[-/]/i.test(path));
  const categories: Array<[string, (path: string) => boolean]> = [
    ['category', isCategory], ['product', isProduct], ['article', isArticle],
  ];
  for (const [pageType, matches] of categories) {
    const candidate = candidates.find((p) => matches(new URL(p.finalUrl).pathname) && !selected.some((s) => s.url === p.finalUrl));
    if (candidate && selected.length < maxPages) selected.push({ url: candidate.finalUrl, pageType });
  }
  return selected.slice(0, maxPages);
}
