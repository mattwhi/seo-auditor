import type { PageFacts, RuleFinding, SeoRule } from '@seo-auditor/types';

import { RuleEngine, RuleRegistry } from './engine.js';

export { RuleEngine, RuleRegistry } from './engine.js';

const finding = (
  rule: Pick<SeoRule, 'id' | 'severity' | 'category' | 'description'>,
  input: Partial<Pick<RuleFinding, 'message' | 'evidence'>> = {},
): RuleFinding => ({
  ruleId: rule.id,
  severity: rule.severity,
  category: rule.category,
  message: input.message ?? rule.description,
  evidence: input.evidence,
});

const hasDirective = (directives: readonly string[] | undefined, directive: string): boolean =>
  (directives ?? []).some((value) =>
    value
      .toLowerCase()
      .split(/[;,]/)
      .map((part) => part.trim())
      .some((part) => part === directive || part.endsWith(`: ${directive}`)),
  );

const resolveCanonical = (canonical: string, finalUrl: string): string | null => {
  try {
    const resolved = new URL(canonical, finalUrl);
    return ['http:', 'https:'].includes(resolved.protocol) ? resolved.href : null;
  } catch {
    return null;
  }
};

const isHtmlSuccess = (page: PageFacts): boolean =>
  page.statusCode >= 200 &&
  page.statusCode <= 299 &&
  (page.contentType ?? '').toLowerCase().includes('text/html');

const isNoindex = (page: PageFacts): boolean =>
  hasDirective(page.robots, 'noindex') || hasDirective(page.xRobotsTag, 'noindex');

const isNonContentUtilityPage = (url: string): boolean => {
  try { return new URL(url).pathname.replace(/\/$/, '') === '/cdn-cgi/l/email-protection' || new URL(url).pathname.replace(/\/$/, '') === '/email-protection'; }
  catch { return false; }
};

const isIndexableHtmlCandidate = (page: PageFacts): boolean =>
  !isNonContentUtilityPage(page.finalUrl) && isHtmlSuccess(page) && !isNoindex(page) && (() => {
    if (!page.canonical) return true;
    try {
      const canonical = new URL(page.canonical, page.finalUrl);
      const current = new URL(page.finalUrl);
      const normalize = (url: URL) => `${url.origin}${url.pathname.replace(/\/$/, '')}${url.search}`;
      return normalize(canonical) === normalize(current);
    } catch {
      return true; // Invalid canonical is reported by the dedicated canonical rule.
    }
  })();

export const coreRules: readonly SeoRule[] = Object.freeze([
  {
    id: 'status.server-error',
    name: 'Server error response',
    description: 'Page returned a 5xx server error response.',
    severity: 'critical',
    category: 'crawlability',
    evaluate(page) {
      return page.statusCode >= 500 && page.statusCode <= 599
        ? [finding(this, { evidence: { statusCode: page.statusCode, url: page.finalUrl } })]
        : [];
    },
  },
  {
    id: 'status.client-error',
    name: 'Client error response',
    description: 'Page returned a 4xx client error response.',
    severity: 'high',
    category: 'crawlability',
    evaluate(page) {
      return page.statusCode >= 400 && page.statusCode <= 499
        ? [finding(this, { evidence: { statusCode: page.statusCode, url: page.finalUrl } })]
        : [];
    },
  },
  {
    id: 'redirect.present',
    name: 'Redirected URL',
    description: 'The requested URL redirected before reaching the final page.',
    severity: 'info',
    category: 'crawlability',
    evaluate(page) {
      const count = page.redirectCount ?? page.redirectHops?.length ?? 0;
      return count > 0
        ? [finding(this, { evidence: { count, requestedUrl: page.url, finalUrl: page.finalUrl } })]
        : [];
    },
  },
  {
    id: 'redirect.chain',
    name: 'Redirect chain',
    description: 'The requested URL passed through more than one redirect.',
    severity: 'medium',
    category: 'crawlability',
    evaluate(page) {
      const count = page.redirectCount ?? page.redirectHops?.length ?? 0;
      return count > 1
        ? [
            finding(this, {
              evidence: {
                count,
                requestedUrl: page.url,
                finalUrl: page.finalUrl,
                hops: (page.redirectHops ?? []).map((hop) => ({
                  url: hop.url,
                  statusCode: hop.statusCode,
                  location: hop.location,
                  targetUrl: hop.targetUrl,
                })),
              },
            }),
          ]
        : [];
    },
  },
  {
    id: 'title.missing',
    name: 'Missing title',
    description: 'Page has no title element.',
    severity: 'high',
    category: 'metadata',
    remediation: { supported: true, risk: 'low', mode: 'approval', platforms: ['wordpress', 'woocommerce', 'rank-math', 'yoast', 'aioseo'], action: 'seo:update_title' },
    evaluate(page) {
      return !isIndexableHtmlCandidate(page) || page.title ? [] : [finding(this)];
    },
  },
  {
    id: 'title.too-short',
    name: 'Short title',
    description: 'Page title contains fewer than 30 characters.',
    severity: 'low',
    category: 'metadata',
    remediation: { supported: true, risk: 'low', mode: 'approval', platforms: ['wordpress', 'woocommerce', 'rank-math', 'yoast', 'aioseo'], action: 'seo:update_title' },
    evaluate(page) {
      if (!isIndexableHtmlCandidate(page) || !page.title || page.title.length >= 30) return [];
      return [finding(this, { evidence: { length: page.title.length, title: page.title } })];
    },
  },
  {
    id: 'title.too-long',
    name: 'Long title',
    description: 'Page title contains more than 60 characters.',
    severity: 'low',
    category: 'metadata',
    remediation: { supported: true, risk: 'low', mode: 'approval', platforms: ['wordpress', 'woocommerce', 'rank-math', 'yoast', 'aioseo'], action: 'seo:update_title' },
    evaluate(page) {
      if (!isIndexableHtmlCandidate(page) || !page.title || page.title.length <= 60) return [];
      return [finding(this, { evidence: { length: page.title.length, title: page.title } })];
    },
  },
  {
    id: 'description.missing',
    name: 'Missing meta description',
    description: 'Page has no meta description.',
    severity: 'medium',
    category: 'metadata',
    remediation: { supported: true, risk: 'low', mode: 'approval', platforms: ['wordpress', 'woocommerce', 'rank-math', 'yoast', 'aioseo'], action: 'seo:update_description' },
    evaluate(page) {
      return !isIndexableHtmlCandidate(page) || page.metaDescription ? [] : [finding(this)];
    },
  },
  {
    id: 'description.too-short',
    name: 'Short meta description',
    description: 'Meta description contains fewer than 70 characters.',
    severity: 'low',
    category: 'metadata',
    remediation: { supported: true, risk: 'low', mode: 'approval', platforms: ['wordpress', 'woocommerce', 'rank-math', 'yoast', 'aioseo'], action: 'seo:update_description' },
    evaluate(page) {
      if (
        !isIndexableHtmlCandidate(page) ||
        !page.metaDescription ||
        page.metaDescription.length >= 70
      )
        return [];
      return [
        finding(this, {
          evidence: { length: page.metaDescription.length, description: page.metaDescription },
        }),
      ];
    },
  },
  {
    id: 'description.too-long',
    name: 'Long meta description',
    description: 'Meta description contains more than 160 characters.',
    severity: 'low',
    category: 'metadata',
    remediation: { supported: true, risk: 'low', mode: 'approval', platforms: ['wordpress', 'woocommerce', 'rank-math', 'yoast', 'aioseo'], action: 'seo:update_description' },
    evaluate(page) {
      if (
        !isIndexableHtmlCandidate(page) ||
        !page.metaDescription ||
        page.metaDescription.length <= 160
      )
        return [];
      return [
        finding(this, {
          evidence: { length: page.metaDescription.length, description: page.metaDescription },
        }),
      ];
    },
  },
  {
    id: 'heading.h1-missing',
    name: 'Missing H1',
    description: 'Page has no H1 heading.',
    severity: 'high',
    category: 'headings',
    evaluate(page) {
      return !isIndexableHtmlCandidate(page) || page.h1.length ? [] : [finding(this)];
    },
  },
  {
    id: 'heading.h1-empty',
    name: 'Empty H1',
    description: 'One or more H1 headings contain no text.',
    severity: 'medium',
    category: 'headings',
    evaluate(page) {
      if (!isIndexableHtmlCandidate(page)) return [];
      const count = page.h1.filter((value) => !value.trim()).length;
      return count ? [finding(this, { evidence: { count } })] : [];
    },
  },
  {
    id: 'heading.h1-multiple',
    name: 'Multiple H1 headings',
    description: 'Page contains multiple H1 headings.',
    severity: 'medium',
    category: 'headings',
    evaluate(page) {
      return isIndexableHtmlCandidate(page) && page.h1.length > 1
        ? [finding(this, { evidence: { count: page.h1.length, headings: page.h1.map((text, index) => ({ position: index + 1, text })) } })]
        : [];
    },
  },
  {
    id: 'indexability.noindex',
    name: 'Noindex directive',
    description: 'Page contains a noindex robots directive. Verify that exclusion is intentional.',
    severity: 'info',
    category: 'indexability',
    evaluate(page) {
      return hasDirective(page.robots, 'noindex')
        ? [finding(this, { evidence: { source: 'meta-robots', directives: page.robots } })]
        : [];
    },
  },
  {
    id: 'indexability.x-robots-noindex',
    name: 'X-Robots-Tag noindex directive',
    description: 'HTTP response contains a noindex X-Robots-Tag directive. Verify that exclusion is intentional.',
    severity: 'info',
    category: 'indexability',
    evaluate(page) {
      return hasDirective(page.xRobotsTag, 'noindex')
        ? [
            finding(this, {
              evidence: { source: 'x-robots-tag', directives: page.xRobotsTag ?? [] },
            }),
          ]
        : [];
    },
  },
  {
    id: 'indexability.canonical-missing',
    name: 'Missing canonical',
    description: 'Page has no canonical link.',
    severity: 'medium',
    category: 'indexability',
    remediation: { supported: true, risk: 'medium', mode: 'approval', platforms: ['wordpress', 'woocommerce', 'rank-math', 'yoast', 'aioseo'], action: 'seo:update_canonical' },
    evaluate(page) {
      return !isIndexableHtmlCandidate(page) || page.canonical ? [] : [finding(this)];
    },
  },
  {
    id: 'indexability.canonical-invalid',
    name: 'Invalid canonical',
    description: 'Page canonical cannot be resolved to a valid HTTP or HTTPS URL.',
    severity: 'high',
    category: 'indexability',
    remediation: { supported: true, risk: 'medium', mode: 'approval', platforms: ['wordpress', 'woocommerce', 'rank-math', 'yoast', 'aioseo'], action: 'seo:update_canonical' },
    evaluate(page) {
      if (!isHtmlSuccess(page) || !page.canonical) return [];
      return resolveCanonical(page.canonical, page.finalUrl)
        ? []
        : [finding(this, { evidence: { canonical: page.canonical } })];
    },
  },
  {
    id: 'indexability.canonical-non-self',
    name: 'Non-self-referencing canonical',
    description: 'Page canonical points to a different URL.',
    severity: 'info',
    category: 'indexability',
    evaluate(page) {
      if (!isHtmlSuccess(page) || !page.canonical) return [];
      const canonical = resolveCanonical(page.canonical, page.finalUrl);
      if (!canonical || canonical === page.finalUrl) return [];
      return [finding(this, { evidence: { canonical, finalUrl: page.finalUrl } })];
    },
  },
  {
    id: 'content.thin',
    name: 'Thin content',
    description: 'Page contains fewer than 200 words.',
    severity: 'low',
    category: 'content',
    evaluate(page) {
      return isIndexableHtmlCandidate(page) && page.wordCount < 200
        ? [finding(this, { evidence: { wordCount: page.wordCount } })]
        : [];
    },
  },
  {
    id: 'image.alt-missing',
    name: 'Missing image alt text',
    description: 'One or more images are missing alt text.',
    severity: 'medium',
    category: 'images',
    remediation: { supported: true, risk: 'low', mode: 'approval', platforms: ['wordpress', 'woocommerce'], action: 'seo:update_alt' },
    evaluate(page) {
      if (!isIndexableHtmlCandidate(page)) return [];
      const missing = page.images.flatMap((image, index) => image.alt === null
        ? [{ position: index + 1, src: image.src, altState: 'missing-attribute' }]
        : []);
      return missing.length ? [finding(this, { evidence: { count: missing.length, images: missing } })] : [];
    },
  },
]);

export const coreRuleRegistry = new RuleRegistry(coreRules);
export const coreRuleEngine = new RuleEngine(coreRuleRegistry);

export function evaluatePage(page: PageFacts, rules: readonly SeoRule[] = coreRules): RuleFinding[] {
  if (rules === coreRules) {
    return coreRuleEngine.evaluatePage(page);
  }

  return new RuleEngine(new RuleRegistry(rules)).evaluatePage(page);
}

export { evaluateAudit, advancedRemediation } from './audit.js';
export type { AuditPageFacts, AuditRuleFinding } from './audit.js';
