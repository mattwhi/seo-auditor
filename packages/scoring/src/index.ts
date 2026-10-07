import type { RuleFinding, Severity } from '@seo-auditor/types';

const maxPenalty: Record<Severity, number> = {
  critical: 30,
  high: 15,
  medium: 7,
  low: 3,
  info: 0,
};

/**
 * Produce a 0-100 audit health score without allowing repeated instances of
 * the same rule to overwhelm the entire audit. Each rule contributes a
 * severity-weighted penalty scaled by the proportion of crawled pages it
 * affects. Informational findings never reduce the score.
 */
export const score = (findings: RuleFinding[], pageCount: number): number => {
  if (pageCount <= 0) return 100;

  const countsByRule = new Map<string, { severity: Severity; count: number }>();

  for (const finding of findings) {
    const current = countsByRule.get(finding.ruleId);
    if (current) current.count += 1;
    else countsByRule.set(finding.ruleId, { severity: finding.severity, count: 1 });
  }

  const penalty = Array.from(countsByRule.values()).reduce((total, item) => {
    const prevalence = Math.min(1, item.count / pageCount);
    return total + maxPenalty[item.severity] * prevalence;
  }, 0);

  return Math.max(0, Math.min(100, Math.round(100 - penalty)));
};
