/** Read-only Google Search Console and GA4 Data API adapter.
 * Credentials never leave the API process. No browser tokens or OAuth redirects.
 */
import { createSign } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { db } from '@seo-auditor/database';
import { decryptWordPressPassword } from './wordpress-crypto.js';

type ServiceAccount = { client_email: string; private_key: string; token_uri?: string };
type GoogleConfig = { searchConsoleSiteUrl?: string; ga4PropertyId?: string };
const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
const enabled = () => true;

export function getGoogleConfig(baseUrl: string): GoogleConfig {
  // JSON map of canonical project base URLs to Google properties, managed server-side.
  const raw = process.env.GOOGLE_PROJECT_PROPERTIES ?? '{}';
  const entries: unknown = JSON.parse(raw);
  if (!entries || typeof entries !== 'object' || Array.isArray(entries)) throw new Error('invalid_google_project_properties');
  const mapping = entries as Record<string, GoogleConfig>;
  const normalized = (url: string) => url.replace(/\/+$/, '').toLowerCase();
  const candidate = Object.entries(mapping).find(([key]) => normalized(key) === normalized(baseUrl))?.[1];
  return candidate && typeof candidate === 'object' && !Array.isArray(candidate) ? candidate : {};
}

// Database mappings override legacy environment mappings. Secrets remain server-side.
async function effectiveGoogleConfig(baseUrl: string): Promise<GoogleConfig> {
  const mapping = await db.projectIntegration.findFirst({ where: { project: { baseUrl } } });
  if (mapping) return { searchConsoleSiteUrl: mapping.searchConsoleSiteUrl ?? undefined, ga4PropertyId: mapping.ga4PropertyId ?? undefined };
  return getGoogleConfig(baseUrl);
}

export async function googleStatusForProject(baseUrl: string) {
  const config = await effectiveGoogleConfig(baseUrl);
  const credential = await db.googleCredential.findFirst({ where: { projectId: (await db.project.findFirst({ where: { baseUrl }, select: { id: true } }))?.id ?? '__none__' }, select: { projectId: true } });
  return { enabled: true, credentialsConfigured: Boolean(credential), searchConsoleConfigured: Boolean(config.searchConsoleSiteUrl), analyticsConfigured: Boolean(config.ga4PropertyId), reason: !credential ? 'google_credentials_missing' : null };
}

function credentialsRaw(): string | undefined {
  // Prefer a read-only mounted secret over environment-injected private key material.
  const file = process.env.GOOGLE_SERVICE_ACCOUNT_FILE;
  if (file) {
    try {
      return readFileSync(file, 'utf8');
    } catch {
      // Do not include the filesystem path or contents in API errors.
      throw new Error('google_credentials_file_unreadable');
    }
  }
  return process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
}

export function credentials(): ServiceAccount {
  const raw = credentialsRaw();
  if (!raw) throw new Error('google_credentials_missing');
  const parsed: unknown = JSON.parse(raw);
  if (!parsed || typeof parsed !== 'object') throw new Error('google_credentials_invalid');
  const value = parsed as Partial<ServiceAccount>;
  if (!value.client_email || !value.private_key) throw new Error('google_credentials_invalid');
  return value as ServiceAccount;
}

const cached = new Map<string, { token: string; expiresAt: number }>();
async function accessToken(baseUrl: string): Promise<string> {
  const existing = cached.get(baseUrl);
  if (existing && existing.expiresAt > Date.now() + 60_000) return existing.token;
  const project = await db.project.findFirst({ where: { baseUrl }, select: { id: true } });
  const credential = project ? await db.googleCredential.findUnique({ where: { projectId: project.id } }) : null;
  if (!credential) throw new Error('google_credentials_missing');
  let account: ServiceAccount;
  try { account = JSON.parse(decryptWordPressPassword(credential.encryptedJson)) as ServiceAccount; }
  catch { throw new Error('google_credentials_unreadable'); }
  if (!account.client_email || !account.private_key) throw new Error('google_credentials_invalid');
  const now = Math.floor(Date.now() / 1000);
  const tokenEndpoint = 'https://oauth2.googleapis.com/token';
  const unsigned = `${encode({ alg: 'RS256', typ: 'JWT' })}.${encode({ iss: account.client_email, scope: 'https://www.googleapis.com/auth/webmasters.readonly https://www.googleapis.com/auth/analytics.readonly', aud: tokenEndpoint, iat: now, exp: now + 3600 })}`;
  const signer = createSign('RSA-SHA256');
  signer.update(unsigned);
  signer.end();
  const assertion = `${unsigned}.${signer.sign(account.private_key).toString('base64url')}`;
  const response = await fetch(tokenEndpoint, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }), signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error(`google_auth_http_${response.status}`);
  const body = await response.json() as { access_token?: string; expires_in?: number };
  if (!body.access_token) throw new Error('google_auth_no_token');
  cached.set(baseUrl, { token: body.access_token, expiresAt: Date.now() + Math.min(body.expires_in ?? 3600, 3600) * 1000 });
  return body.access_token;
}

async function googlePost(baseUrl: string, url: string, payload: object): Promise<unknown> {
  const token = await accessToken(baseUrl);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);

    const googleError =
      body && typeof body === 'object' && 'error' in body
        ? (body as { error?: { message?: string; status?: string } }).error
        : undefined;

    console.error('Google API request failed', {
      status: response.status,
      googleStatus: googleError?.status,
      message: googleError?.message ?? 'Unknown Google API error',
    });

    throw new Error(`google_api_http_${response.status}`);
  }

  return response.json();
}

export async function searchConsoleReport(baseUrl: string, startDate: string, endDate: string) {
  if (!enabled()) throw new Error('google_integration_disabled');
  const site = (await effectiveGoogleConfig(baseUrl)).searchConsoleSiteUrl;
  if (!site) throw new Error('search_console_not_configured');
  const data = await googlePost(baseUrl, `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(site)}/searchAnalytics/query`, { startDate, endDate, dimensions: ['page'], rowLimit: 100, dataState: 'final' }) as { rows?: Array<{ keys?: string[]; clicks?: number; impressions?: number; ctr?: number; position?: number }> };
  const pages = (data.rows ?? []).map((row) => ({ page: row.keys?.[0] ?? '', clicks: row.clicks ?? 0, impressions: row.impressions ?? 0, ctr: row.ctr ?? 0, position: row.position ?? 0 }));
  return { startDate, endDate, property: site, pages, totals: { clicks: pages.reduce((s, r) => s + r.clicks, 0), impressions: pages.reduce((s, r) => s + r.impressions, 0) }, note: 'Totals cover returned top 100 pages, not necessarily the entire property.' };
}

export async function analyticsReport(baseUrl: string, startDate: string, endDate: string) {
  if (!enabled()) throw new Error('google_integration_disabled');
  const property = (await effectiveGoogleConfig(baseUrl)).ga4PropertyId;
  if (!property || !/^\d+$/.test(property)) throw new Error('analytics_property_not_configured');
  const data = await googlePost(baseUrl, `https://analyticsdata.googleapis.com/v1beta/properties/${property}:runReport`, { dateRanges: [{ startDate, endDate }], dimensions: [{ name: 'landingPagePlusQueryString' }], metrics: [{ name: 'sessions' }, { name: 'totalUsers' }, { name: 'engagedSessions' }], limit: 100 }) as { rows?: Array<{ dimensionValues?: Array<{ value?: string }>; metricValues?: Array<{ value?: string }> }> };
  return { startDate, endDate, propertyId: property, pages: (data.rows ?? []).map((row) => ({ page: row.dimensionValues?.[0]?.value ?? '', sessions: Number(row.metricValues?.[0]?.value ?? 0), users: Number(row.metricValues?.[1]?.value ?? 0), engagedSessions: Number(row.metricValues?.[2]?.value ?? 0) })), note: 'GA4 sessions include all traffic channels. The returned rows are limited to the top 100 landing pages.' };
}


/** v1.2.1: live, read-only GSC keyword/page observations.
 * No database writes, migrations, or automated remediation.
 */
export async function searchConsoleKeywordOpportunities(baseUrl: string, startDate: string, endDate: string) {
  const site = (await effectiveGoogleConfig(baseUrl)).searchConsoleSiteUrl;
  if (!site) throw new Error('search_console_not_configured');
  const response = await googlePost(
    baseUrl,
    `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(site)}/searchAnalytics/query`,
    { startDate, endDate, dimensions: ['query', 'page'], rowLimit: 1000, dataState: 'final' },
  ) as { rows?: Array<{ keys?: string[]; clicks?: number; impressions?: number; ctr?: number; position?: number }> };
  const observations = (response.rows ?? []).map((row) => ({
    query: row.keys?.[0] ?? '',
    pageUrl: row.keys?.[1] ?? '',
    clicks: row.clicks ?? 0,
    impressions: row.impressions ?? 0,
    ctr: row.ctr ?? 0,
    position: row.position ?? 0,
  }));
  const { keywordCandidates } = await import('@seo-auditor/intelligence');
  const opportunities = keywordCandidates(observations)
    .sort((a, b) => b.score - a.score || b.impressions - a.impressions)
    .slice(0, 500)
    .map(({ fingerprint, ...candidate }) => ({ ...candidate, id: fingerprint }));
  return {
    startDate, endDate, property: site,
    observationCount: observations.length,
    observations,
    opportunities,
    note: 'Read-only analysis of up to 1,000 GSC query/page rows. Low-volume candidates carry lower confidence. Search Console data may be anonymised or incomplete; no uplift is guaranteed.',
  };
}
