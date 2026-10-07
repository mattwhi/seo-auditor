import type { JsonValue, RemediationDefinition, RuleCategory, Severity } from '@seo-auditor/types';

export interface AuditPageFacts {
  id: string;
  url: string;
  finalUrl: string;
  statusCode: number;
  contentType: string | null;
  title: string | null;
  metaDescription: string | null;
  canonical: string | null;
  robots: string[];
  xRobotsTag: string[];
  crawlDepth: number | null;
  contentHash: string | null;
  outgoingLinks: Array<{ href: string; text: string | null; internal: boolean }>;
  hreflang: Array<{ lang: string; href: string }>;
  jsonLdErrors: number;
}

export interface AuditRuleFinding {
  pageId: string | null;
  ruleId: string;
  severity: Severity;
  category: RuleCategory;
  message: string;
  evidence?: JsonValue;
}

export const advancedRemediation: Readonly<Record<string, RemediationDefinition>> = Object.freeze({
  'metadata.title-duplicate': { supported: true, risk: 'low', mode: 'approval', platforms: ['wordpress','woocommerce','rank-math','yoast','aioseo'], action: 'seo:update_title' },
  'metadata.description-duplicate': { supported: true, risk: 'low', mode: 'approval', platforms: ['wordpress','woocommerce','rank-math','yoast','aioseo'], action: 'seo:update_description' },
  'content.duplicate': { supported: false, risk: 'high', mode: 'manual', platforms: ['generic'] },
  'links.broken-internal': { supported: true, risk: 'medium', mode: 'approval', platforms: ['wordpress','woocommerce'], action: 'seo:update_internal_link' },
  'links.http-internal': { supported: true, risk: 'low', mode: 'auto', platforms: ['wordpress','woocommerce'], action: 'seo:update_internal_link' },
  'links.orphan': { supported: false, risk: 'medium', mode: 'manual', platforms: ['generic'] },
  'links.deep-page': { supported: false, risk: 'medium', mode: 'manual', platforms: ['generic'] },
  'indexability.canonical-cluster': { supported: true, risk: 'medium', mode: 'approval', platforms: ['wordpress','woocommerce','rank-math','yoast','aioseo'], action: 'seo:update_canonical' },
  'hreflang.invalid': { supported: true, risk: 'medium', mode: 'approval', platforms: ['wordpress'], action: 'seo:update_hreflang' },
  'hreflang.missing-reciprocal': { supported: true, risk: 'medium', mode: 'approval', platforms: ['wordpress'], action: 'seo:update_hreflang' },
  'schema.jsonld-invalid': { supported: false, risk: 'high', mode: 'manual', platforms: ['generic'] },
});

const htmlSuccess = (p: AuditPageFacts) => p.statusCode >= 200 && p.statusCode < 300 && (p.contentType ?? '').toLowerCase().includes('text/html');
const normalized = (value: string) => value.trim().replace(/\/$/, '').toLowerCase();
const issue = (pageId: string | null, ruleId: string, severity: Severity, category: RuleCategory, message: string, evidence?: JsonValue): AuditRuleFinding => ({ pageId, ruleId, severity, category, message, evidence });

export function evaluateAudit(pages: readonly AuditPageFacts[], startUrl: string): AuditRuleFinding[] {
  const findings: AuditRuleFinding[] = [];
  const byUrl = new Map<string, AuditPageFacts>();
  for (const page of pages) { byUrl.set(normalized(page.url), page); byUrl.set(normalized(page.finalUrl), page); }

  const duplicateGroups = (field: 'title'|'metaDescription'|'contentHash') => {
    const groups = new Map<string, AuditPageFacts[]>();
    for (const p of pages) {
      if (!htmlSuccess(p)) continue;
      const raw = p[field]; if (!raw) continue;
      const key = normalized(raw); const group = groups.get(key) ?? []; group.push(p); groups.set(key, group);
    }
    return [...groups.values()].filter(g => g.length > 1);
  };

  for (const group of duplicateGroups('title')) for (const p of group) findings.push(issue(p.id,'metadata.title-duplicate','medium','metadata','Page title is duplicated across multiple indexable HTML pages.',{title:p.title,count:group.length,urls:group.map(x=>x.finalUrl)}));
  for (const group of duplicateGroups('metaDescription')) for (const p of group) findings.push(issue(p.id,'metadata.description-duplicate','low','metadata','Meta description is duplicated across multiple indexable HTML pages.',{description:p.metaDescription,count:group.length,urls:group.map(x=>x.finalUrl)}));
  for (const group of duplicateGroups('contentHash')) for (const p of group) findings.push(issue(p.id,'content.duplicate','medium','content','Page body content is identical to another crawled HTML page.',{count:group.length,urls:group.map(x=>x.finalUrl)}));

  const incoming = new Map<string, number>();
  for (const p of pages) incoming.set(normalized(p.finalUrl), 0);
  for (const p of pages) {
    for (const link of p.outgoingLinks.filter(l=>l.internal)) {
      const target = byUrl.get(normalized(link.href));
      if (target) incoming.set(normalized(target.finalUrl),(incoming.get(normalized(target.finalUrl)) ?? 0)+1);
      if (link.href.startsWith('http://')) findings.push(issue(p.id,'links.http-internal','low','links','Internal link uses HTTP rather than HTTPS.',{href:link.href,text:link.text}));
      if (target && target.statusCode >= 400) findings.push(issue(p.id,'links.broken-internal','high','links','Internal link points to a crawled error response.',{href:link.href,statusCode:target.statusCode,text:link.text}));
    }
  }
  const start = normalized(startUrl);
  for (const p of pages) {
    if (htmlSuccess(p) && normalized(p.finalUrl) !== start && (incoming.get(normalized(p.finalUrl)) ?? 0) === 0) findings.push(issue(p.id,'links.orphan','medium','links','Crawled page has no incoming internal links from other crawled pages.',{url:p.finalUrl}));
    if (htmlSuccess(p) && (p.crawlDepth ?? 0) > 3) findings.push(issue(p.id,'links.deep-page','low','links','Page is more than three crawl levels from the audit start URL.',{url:p.finalUrl,depth:p.crawlDepth ?? 0}));
    if (p.jsonLdErrors > 0) findings.push(issue(p.id,'schema.jsonld-invalid','medium','schema','One or more JSON-LD blocks could not be parsed as valid JSON.',{errors:p.jsonLdErrors}));
    for (const ref of p.hreflang) {
      let valid = true; try { const u=new URL(ref.href); valid=['http:','https:'].includes(u.protocol) && Boolean(ref.lang); } catch { valid=false; }
      if (!valid) findings.push(issue(p.id,'hreflang.invalid','medium','indexability','Hreflang reference is invalid.',{lang:ref.lang,href:ref.href}));
      const target = byUrl.get(normalized(ref.href));
      if (target && !target.hreflang.some(r=>normalized(r.href)===normalized(p.finalUrl))) findings.push(issue(p.id,'hreflang.missing-reciprocal','medium','indexability','Hreflang target does not link back to this page.',{lang:ref.lang,href:ref.href,target:target.finalUrl}));
    }
  }

  const canonicalGroups = new Map<string, AuditPageFacts[]>();
  for (const p of pages) if (htmlSuccess(p) && p.canonical) { try { const c=new URL(p.canonical,p.finalUrl).href; const g=canonicalGroups.get(normalized(c))??[]; g.push(p); canonicalGroups.set(normalized(c),g); } catch {} }
  for (const [canonical, group] of canonicalGroups) if (group.length > 1) for (const p of group) findings.push(issue(p.id,'indexability.canonical-cluster','info','indexability','Multiple crawled pages declare the same canonical target. Verify that consolidation is intentional.',{canonical,count:group.length,urls:group.map(x=>x.finalUrl)}));

  return findings;
}
