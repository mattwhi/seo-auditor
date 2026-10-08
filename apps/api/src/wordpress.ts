/** v0.8 WordPress/WooCommerce discovery and non-mutating remediation planning.
 * Deliberately no write endpoints: API has no user authentication yet.
 */
import { z } from 'zod';

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
