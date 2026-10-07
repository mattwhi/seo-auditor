import type { RuleFinding, Severity } from '@seo-auditor/types';
const weight: Record<Severity, number> = { critical: 20, high: 10, medium: 5, low: 2, info: 0 };
export const score = (findings: RuleFinding[]) =>
  Math.max(0, 100 - findings.reduce((n, f) => n + weight[f.severity], 0));
