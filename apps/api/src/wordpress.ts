/** v0.8 WordPress/WooCommerce discovery and non-mutating remediation planning.
 * Deliberately no write endpoints: API has no user authentication yet.
 */
import { z } from 'zod';
import { readFileSync } from 'node:fs';

const mappingSchema = z.record(z.string(), z.object({ siteUrl: z.string().url(), enabled: z.boolean().default(false) }));
export function wordpressConfig(baseUrl: string) {
  const entries = mappingSchema.parse(JSON.parse(process.env.WORDPRESS_PROJECT_SITES ?? '{}'));
  const normalize = (s: string) => new URL(s).origin.toLowerCase();
  const config = Object.entries(entries).find(([key]) => normalize(key) === normalize(baseUrl))?.[1];
  if (!config?.enabled || process.env.WORDPRESS_INTEGRATIONS_ENABLED !== 'true') return null;
  const project = new URL(baseUrl);
  const site = new URL(config.siteUrl);
  if (site.protocol !== 'https:' || site.origin !== project.origin || site.username || site.password || site.search || site.hash || site.pathname !== '/') throw new Error('wordpress_site_origin_mismatch');
  return site.origin;
}

export type WordpressDiscovery = {
  enabled: boolean; siteUrl?: string; restApi: boolean; wordpress: boolean;
  wooCommerce: boolean; namespaces: string[]; error?: string;
};

export async function discoverWordpress(baseUrl: string): Promise<WordpressDiscovery> {
  const siteUrl = wordpressConfig(baseUrl);
  if (!siteUrl) return { enabled: false, restApi: false, wordpress: false, wooCommerce: false, namespaces: [] };
  try {
    const response = await fetch(`${siteUrl}/wp-json/`, { headers: { accept: 'application/json' }, redirect: 'error', signal: AbortSignal.timeout(10_000) });
    if (!response.ok) return { enabled: true, siteUrl, restApi: false, wordpress: false, wooCommerce: false, namespaces: [], error: `http_${response.status}` };
    const data: unknown = await response.json();
    if (!data || typeof data !== 'object' || !('namespaces' in data) || !Array.isArray(data.namespaces)) throw new Error('invalid_wordpress_rest_index');
    const namespaces = data.namespaces.filter((n): n is string => typeof n === 'string').slice(0, 100);
    return { enabled: true, siteUrl, restApi: true, wordpress: namespaces.some((n) => n.startsWith('wp/v2')), wooCommerce: namespaces.some((n) => n.startsWith('wc/v')), namespaces };
  } catch (error) {
    return { enabled: true, siteUrl, restApi: false, wordpress: false, wooCommerce: false, namespaces: [], error: error instanceof Error && error.message === 'invalid_wordpress_rest_index' ? error.message : 'wordpress_discovery_failed' };
  }
}

const suggestions: Record<string, { target: string; action: string; caveat: string }> = {
  'title.missing': { target: 'post/page/product SEO title', action: 'Draft a unique descriptive SEO title in your SEO plugin, then inspect the rendered title.', caveat: 'WordPress core post title is not necessarily the SEO title.' },
  'title.too-short': { target: 'post/page/product SEO title', action: 'Review the existing SEO title and propose more useful page-specific context.', caveat: 'Avoid keyword stuffing or automatic length padding.' },
  'title.too-long': { target: 'post/page/product SEO title', action: 'Shorten repetitive wording while retaining primary intent.', caveat: 'Search engines may rewrite titles.' },
  'description.missing': { target: 'SEO plugin meta description', action: 'Draft a unique description based on the page content.', caveat: 'Yoast and Rank Math use plugin-specific metadata; do not overwrite excerpts.' },
  'description.too-short': { target: 'SEO plugin meta description', action: 'Review and expand the snippet with meaningful page-specific context.', caveat: 'Keep editorial approval.' },
  'description.too-long': { target: 'SEO plugin meta description', action: 'Remove redundant wording and keep important information first.', caveat: 'Search snippets are not guaranteed.' },
  'image.alt-missing': { target: 'media attachment alt text', action: 'Review image context and add accurate alt text only to informative images.', caveat: 'Decorative images should use empty alt attributes.' },
  'heading.h1-missing': { target: 'theme/template or content heading', action: 'Inspect the page template and propose a meaningful H1.', caveat: 'Do not blindly change a product or post title.' },
};

export function remediationPreview(ruleId: string, pageUrl: string, baseUrl: string) {
  const base = new URL(baseUrl);
  const page = new URL(pageUrl);
  if (page.origin !== base.origin) throw new Error('page_outside_project');
  const suggestion = suggestions[ruleId];
  return {
    ruleId, pageUrl, supported: Boolean(suggestion), platform: 'wordpress',
    target: suggestion?.target ?? 'manual review',
    proposedAction: suggestion?.action ?? 'Inspect the finding and select an appropriate platform-specific fix.',
    caveat: suggestion?.caveat ?? 'No safe automated mapping is available for this rule.',
    status: 'draft', executable: false, requiresApproval: true,
    note: 'Preview only. No WordPress credentials are collected and no changes are applied in v0.8 foundation.',
  };
}


/** v0.8.1: private, file-backed WordPress Application Password connection.
 * The API does not have operator authentication: these endpoints are strictly
 * read-only and return no WordPress account details or secret material.
 */
const connectionSchema = z.record(z.string(), z.object({
  username: z.string().min(1), applicationPassword: z.string().min(1),
}));

type WordPressConnection = { username: string; applicationPassword: string };
export function wordpressConnection(baseUrl: string): WordPressConnection | null {
  const siteUrl = wordpressConfig(baseUrl);
  if (!siteUrl) return null;
  const file = process.env.WORDPRESS_CONNECTIONS_FILE;
  if (!file) return null;
  let raw: string;
  try { raw = readFileSync(file, 'utf8'); }
  catch { throw new Error('wordpress_connections_file_unreadable'); }
  let parsed: unknown;
  try { parsed = JSON.parse(raw); }
  catch { throw new Error('wordpress_connections_invalid'); }
  const entries = connectionSchema.safeParse(parsed);
  if (!entries.success) throw new Error('wordpress_connections_invalid');
  const match = Object.entries(entries.data).find(([key]) => {
    try { return new URL(key).origin === siteUrl && new URL(key).pathname === '/'; }
    catch { return false; }
  });
  return match?.[1] ?? null;
}

async function wordpressRead(baseUrl: string, route: string): Promise<Response> {
  const site = wordpressConfig(baseUrl);
  if (!site) throw new Error('wordpress_not_enabled');
  const connection = wordpressConnection(baseUrl);
  if (!connection) throw new Error('wordpress_connection_not_configured');
  // Fixed REST routes only; never accept arbitrary URLs or redirects.
  if (!route.startsWith('/wp-json/wp/v2/')) throw new Error('wordpress_invalid_route');
  const authorization = `Basic ${Buffer.from(`${connection.username}:${connection.applicationPassword}`).toString('base64')}`;
  return fetch(`${site}${route}`, {
    method: 'GET', headers: { authorization, accept: 'application/json' },
    redirect: 'error', signal: AbortSignal.timeout(12_000),
  });
}

export async function wordpressConnectionStatus(baseUrl: string) {
  const site = wordpressConfig(baseUrl);
  if (!site) return { enabled: false, configured: false, authenticated: false, reason: 'wordpress_not_enabled' };
  if (!process.env.WORDPRESS_CONNECTIONS_FILE) return { enabled: true, configured: false, authenticated: false, reason: 'wordpress_connection_not_configured' };
  if (!wordpressConnection(baseUrl)) return { enabled: true, configured: false, authenticated: false, reason: 'wordpress_connection_not_configured' };
  try {
    const response = await wordpressRead(baseUrl, '/wp-json/wp/v2/users/me?context=edit');
    return { enabled: true, configured: true, authenticated: response.ok, reason: response.ok ? null : `wordpress_http_${response.status}` };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'wordpress_connection_failed';
    return { enabled: true, configured: true, authenticated: false, reason: message.startsWith('wordpress_') ? message : 'wordpress_connection_failed' };
  }
}

export function wordpressContentCandidate(pageUrl: string, baseUrl: string) {
  const page = new URL(pageUrl);
  const base = new URL(baseUrl);
  if (page.origin !== base.origin || page.protocol !== 'https:') throw new Error('page_outside_project');
  const segments = page.pathname.split('/').filter(Boolean);
  const slug = segments.at(-1) ?? '';
  if (!slug || !/^[a-z0-9][a-z0-9-]{0,199}$/i.test(slug)) return { supported: false, reason: 'slug_not_mappable' };
  return { supported: true, slug, candidates: ['posts', 'pages', 'product'] };
}

/** Resolve a public-facing audited URL to a WordPress REST object.
 * No content or credentials are returned. Ambiguous matches require manual review.
 */
export async function wordpressIssueMapping(baseUrl: string, pageUrl: string) {
  const candidate = wordpressContentCandidate(pageUrl, baseUrl);
  if (!candidate.supported || !candidate.slug || !candidate.candidates) return { status: 'manual_review', reason: candidate.reason, matches: [] };
  const matches: Array<{ type: string; id: number; link: string }> = [];
  for (const type of candidate.candidates) {
    const response = await wordpressRead(baseUrl, `/wp-json/wp/v2/${type}?slug=${encodeURIComponent(candidate.slug)}&_fields=id,link&per_page=10`);
    if (response.status === 404 || response.status === 403) continue;
    if (!response.ok) throw new Error(`wordpress_mapping_http_${response.status}`);
    const data: unknown = await response.json();
    if (!Array.isArray(data)) throw new Error('wordpress_mapping_invalid_response');
    for (const row of data) {
      if (!row || typeof row !== 'object') continue;
      const item = row as { id?: unknown; link?: unknown };
      if (typeof item.id !== 'number' || typeof item.link !== 'string') continue;
      try {
        const url = new URL(item.link);
        const expected = new URL(pageUrl);
        if (url.origin === expected.origin && url.pathname.replace(/\/+$/, '') === expected.pathname.replace(/\/+$/, '')) matches.push({ type, id: item.id, link: item.link });
      } catch { /* Ignore malformed WordPress links. */ }
    }
  }
  return { status: matches.length === 1 ? 'matched' : 'manual_review', reason: matches.length > 1 ? 'ambiguous_matches' : matches.length === 0 ? 'no_exact_match' : null, matches };
}


/** Authenticated, allowlisted WordPress bridge; never follows redirects. */
async function bridgeRequest(baseUrl: string, targetType: string, targetId: number, field: string, payload?: { expectedValue: string; newValue: string }): Promise<Response> {
  const site = wordpressConfig(baseUrl);
  const connection = wordpressConnection(baseUrl);
  if (!site || !connection) throw new Error('wordpress_connection_not_configured');
  if (!['posts', 'pages', 'product'].includes(targetType) || !Number.isSafeInteger(targetId) || targetId < 1) throw new Error('invalid_wordpress_target');
  if (!['rank_math_title', 'rank_math_description'].includes(field)) throw new Error('unsupported_field');
  const route = `/wp-json/seo-auditor/v1/meta/${targetType}/${targetId}`;
  const authorization = `Basic ${Buffer.from(`${connection.username}:${connection.applicationPassword}`).toString('base64')}`;
  return fetch(`${site}${route}${payload ? '' : `?field=${field}`}`, {
    method: payload ? 'POST' : 'GET',
    headers: { authorization, accept: 'application/json', ...(payload ? { 'content-type': 'application/json' } : {}) },
    body: payload ? JSON.stringify({ field, ...payload }) : undefined,
    redirect: 'error', signal: AbortSignal.timeout(12_000),
  });
}
export function seoFieldForRule(ruleId: string): string | null {
  return ruleId.startsWith('description.') ? 'rank_math_description' : ruleId.startsWith('title.') ? 'rank_math_title' : null;
}
export async function wordpressSeoSnapshot(baseUrl: string, targetType: string, targetId: number, ruleId: string): Promise<
  { verified: true; adapter: string; field: string; value: string } |
  { verified: false; reason: string }
> {
  const field = seoFieldForRule(ruleId);
  if (!field) return { verified: false, reason: 'unsupported_rule' };
  const response = await bridgeRequest(baseUrl, targetType, targetId, field);
  if (!response.ok) return { verified: false, reason: response.status === 404 ? 'seo_bridge_not_installed' : `seo_bridge_http_${response.status}` };
  const data: unknown = await response.json();
  if (!data || typeof data !== 'object') return { verified: false, reason: 'seo_bridge_invalid_response' };
  const result = data as { type?: unknown; id?: unknown; field?: unknown; value?: unknown; adapter?: unknown };
  if (result.type !== targetType || result.id !== targetId || result.field !== field || typeof result.value !== 'string' || result.adapter !== 'rank_math_bridge_v1') {
    return { verified: false, reason: 'seo_bridge_invalid_response' };
  }
  return { verified: true, adapter: 'rank_math_bridge_v1', field, value: result.value };
}
/** Compare-and-swap metadata mutation. Never invoke unless separately authorised. */
export async function wordpressSeoWrite(baseUrl: string, targetType: string, targetId: number, field: string, expectedValue: string, newValue: string) {
  const response = await bridgeRequest(baseUrl, targetType, targetId, field, { expectedValue, newValue });
  if (!response.ok) {
    if (response.status === 409) throw new Error('wordpress_metadata_conflict');
    throw new Error(`wordpress_write_http_${response.status}`);
  }
  const data: unknown = await response.json();
  if (!data || typeof data !== 'object') throw new Error('wordpress_write_invalid_response');
  const result = data as { verified?: unknown; id?: unknown; field?: unknown; value?: unknown };
  if (result.verified !== true || result.id !== targetId || result.field !== field || result.value !== newValue) throw new Error('wordpress_write_verification_failed');
  return true;
}
