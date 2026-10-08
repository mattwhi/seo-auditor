/** PageSpeed Insights v5 lab and optional CrUX field data. No fabricated metrics. */
export type Metric = { value: number | null; displayValue: string | null };
export type PerformanceMeasurement = {
  strategy: 'mobile' | 'desktop'; status: 'completed' | 'unavailable';
  measuredAt: string; url: string; error: string | null;
  lighthouseScore: number | null; lcp: Metric; cls: Metric; inp: Metric; fcp: Metric; tbt: Metric; speedIndex: Metric;
  fieldLcp: number | null; fieldCls: number | null; fieldInp: number | null;
};
const empty = (): Metric => ({ value: null, displayValue: null });
const numberOrNull = (value: unknown): number | null => typeof value === 'number' && Number.isFinite(value) ? value : null;
const metric = (audits: Record<string, { numericValue?: unknown; displayValue?: unknown }> | undefined, id: string): Metric => {
  const item = audits?.[id];
  return { value: numberOrNull(item?.numericValue), displayValue: typeof item?.displayValue === 'string' ? item.displayValue : null };
};
type PageSpeedResponse = {
  lighthouseResult?: {
    audits?: Record<string, { numericValue?: unknown; displayValue?: unknown }>;
    categories?: { performance?: { score?: unknown } };
  };
  loadingExperience?: { metrics?: Record<string, { percentile?: unknown }> };
};
export function parsePageSpeed(raw: unknown, strategy: 'mobile' | 'desktop', url: string): PerformanceMeasurement {
  const body = (raw ?? {}) as PageSpeedResponse;
  const lighthouse = body.lighthouseResult;
  const audits = lighthouse?.audits as Record<string, { numericValue?: unknown; displayValue?: unknown }> | undefined;
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
    fieldLcp: null, fieldCls: null, fieldInp: null };
}
