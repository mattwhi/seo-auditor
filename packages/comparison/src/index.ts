export interface ComparablePage {
  url: string;
  finalUrl: string;
}

export interface ComparableIssue {
  ruleId: string;
  severity: string;
  category: string;
  message: string;
  evidence?: unknown;
  page?: ComparablePage | null;
}

export interface AuditSnapshot {
  id: string;
  score: number | null;
  pages: ComparablePage[];
  issues: ComparableIssue[];
}

export interface ComparedIssue extends ComparableIssue {
  fingerprint: string;
}

export interface AuditComparison {
  currentAuditId: string;
  baselineAuditId: string;
  score: { current: number | null; baseline: number | null; delta: number | null };
  pages: { current: number; baseline: number; delta: number; added: string[]; removed: string[] };
  issues: {
    current: number;
    baseline: number;
    delta: number;
    new: ComparedIssue[];
    resolved: ComparedIssue[];
    persistent: ComparedIssue[];
  };
}

function normalizedUrl(value: string): string {
  try {
    const url = new URL(value);
    url.hash = '';
    return url.href;
  } catch {
    return value.trim();
  }
}

function stableJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? '';
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(',')}}`;
}

export function issueFingerprint(issue: ComparableIssue): string {
  const pageUrl = issue.page ? normalizedUrl(issue.page.finalUrl || issue.page.url) : '';
  const discriminator = pageUrl || stableJson(issue.evidence ?? issue.message);
  return `${issue.ruleId}\u0000${discriminator}`;
}

function withFingerprint(issue: ComparableIssue): ComparedIssue {
  return { ...issue, fingerprint: issueFingerprint(issue) };
}

export function compareAudits(current: AuditSnapshot, baseline: AuditSnapshot): AuditComparison {
  const currentPages = new Set(current.pages.map((page) => normalizedUrl(page.finalUrl || page.url)));
  const baselinePages = new Set(baseline.pages.map((page) => normalizedUrl(page.finalUrl || page.url)));
  const currentIssues = new Map(current.issues.map((issue) => [issueFingerprint(issue), withFingerprint(issue)]));
  const baselineIssues = new Map(baseline.issues.map((issue) => [issueFingerprint(issue), withFingerprint(issue)]));

  const added = [...currentPages].filter((url) => !baselinePages.has(url)).sort();
  const removed = [...baselinePages].filter((url) => !currentPages.has(url)).sort();
  const newIssues = [...currentIssues].filter(([key]) => !baselineIssues.has(key)).map(([, issue]) => issue);
  const resolved = [...baselineIssues].filter(([key]) => !currentIssues.has(key)).map(([, issue]) => issue);
  const persistent = [...currentIssues].filter(([key]) => baselineIssues.has(key)).map(([, issue]) => issue);

  return {
    currentAuditId: current.id,
    baselineAuditId: baseline.id,
    score: {
      current: current.score,
      baseline: baseline.score,
      delta: current.score == null || baseline.score == null ? null : current.score - baseline.score,
    },
    pages: {
      current: currentPages.size,
      baseline: baselinePages.size,
      delta: currentPages.size - baselinePages.size,
      added,
      removed,
    },
    issues: {
      current: currentIssues.size,
      baseline: baselineIssues.size,
      delta: currentIssues.size - baselineIssues.size,
      new: newIssues,
      resolved,
      persistent,
    },
  };
}
