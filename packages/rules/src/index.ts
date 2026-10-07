import type { PageFacts, RuleFinding, SeoRule } from '@seo-auditor/types';
const finding = (r: SeoRule, p: Partial<RuleFinding>): RuleFinding => ({
  ruleId: r.id,
  severity: r.severity,
  category: r.category,
  message: p.message ?? r.description,
  evidence: p.evidence,
});
export const coreRules: SeoRule[] = [
  {
    id: 'title.missing',
    name: 'Missing title',
    description: 'Page has no title element.',
    severity: 'high',
    category: 'metadata',
    evaluate(p) {
      return p.title ? [] : [finding(this, {})];
    },
  },
  {
    id: 'description.missing',
    name: 'Missing meta description',
    description: 'Page has no meta description.',
    severity: 'medium',
    category: 'metadata',
    evaluate(p) {
      return p.metaDescription ? [] : [finding(this, {})];
    },
  },
  {
    id: 'heading.h1-missing',
    name: 'Missing H1',
    description: 'Page has no H1 heading.',
    severity: 'high',
    category: 'headings',
    evaluate(p) {
      return p.h1.length ? [] : [finding(this, {})];
    },
  },
  {
    id: 'heading.h1-multiple',
    name: 'Multiple H1 headings',
    description: 'Page contains multiple H1 headings.',
    severity: 'medium',
    category: 'headings',
    evaluate(p) {
      return p.h1.length > 1 ? [finding(this, { evidence: { count: p.h1.length } })] : [];
    },
  },
  {
    id: 'indexability.noindex',
    name: 'Noindex directive',
    description: 'Page contains a noindex robots directive.',
    severity: 'high',
    category: 'indexability',
    evaluate(p) {
      return p.robots.includes('noindex') ? [finding(this, {})] : [];
    },
  },
  {
    id: 'indexability.canonical-missing',
    name: 'Missing canonical',
    description: 'Page has no canonical link.',
    severity: 'medium',
    category: 'indexability',
    evaluate(p) {
      return p.canonical ? [] : [finding(this, {})];
    },
  },
  {
    id: 'content.thin',
    name: 'Thin content',
    description: 'Page contains fewer than 200 words.',
    severity: 'low',
    category: 'content',
    evaluate(p) {
      return p.wordCount < 200 ? [finding(this, { evidence: { wordCount: p.wordCount } })] : [];
    },
  },
  {
    id: 'image.alt-missing',
    name: 'Missing image alt text',
    description: 'One or more images are missing alt text.',
    severity: 'medium',
    category: 'images',
    evaluate(p) {
      const count = p.images.filter((i) => !i.alt).length;
      return count ? [finding(this, { evidence: { count } })] : [];
    },
  },
];
export function evaluatePage(page: PageFacts, rules: SeoRule[] = coreRules) {
  return rules.flatMap((rule) => rule.evaluate(page));
}
