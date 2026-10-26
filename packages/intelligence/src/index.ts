import { createHash } from 'node:crypto';

/** Pure, deterministic advisory scoring; no network access or writes. */
export type OpportunityKind = 'low_ctr' | 'striking_distance' | 'content_gap' | 'technical';
export type OpportunityInputs = {
  kind: OpportunityKind;
  pageUrl?: string;
  keyword?: string;
  impact: number;
  confidence: number;
  effort: number;
};

function boundedInteger(value: number, field: string): number {
  if (!Number.isInteger(value) || value < 1 || value > 5) {
    throw new RangeError(`${field} must be an integer from 1 to 5`);
  }
  return value;
}

/** Score 0-100: impact 50%, confidence 30%, ease 20%. */
export function scoreOpportunity(input: Pick<OpportunityInputs, 'impact' | 'confidence' | 'effort'>): number {
  const impact = boundedInteger(input.impact, 'impact');
  const confidence = boundedInteger(input.confidence, 'confidence');
  const effort = boundedInteger(input.effort, 'effort');
  return Math.round(((impact / 5) * 0.5 + (confidence / 5) * 0.3 + ((6 - effort) / 5) * 0.2) * 100);
}

export function opportunityFingerprint(input: Pick<OpportunityInputs, 'kind' | 'pageUrl' | 'keyword'>): string {
  const kind = input.kind.trim().toLowerCase();
  const pageUrl = (input.pageUrl ?? '').trim();
  const keyword = (input.keyword ?? '').trim().toLowerCase();
  if (!kind || (!pageUrl && !keyword)) throw new Error('Opportunity requires a kind and a page URL or keyword');
  return createHash('sha256').update(JSON.stringify([kind, pageUrl, keyword])).digest('hex');
}

export type SearchConsoleObservation = {
  query: string;
  pageUrl: string;
  clicks: number;
  impressions: number;
  ctr: number; // 0..1
  position: number;
};

/** Candidate discovery from first-party Search Console data only; no inferred search volumes. */
export function keywordCandidates(observations: readonly SearchConsoleObservation[]) {
  return observations.flatMap((row) => {
    if (!row.query.trim() || !row.pageUrl.trim() ||
        !Number.isInteger(row.clicks) || row.clicks < 0 ||
        !Number.isInteger(row.impressions) || row.impressions < 0 || row.clicks > row.impressions ||
        !Number.isFinite(row.ctr) || row.ctr < 0 || row.ctr > 1 ||
        !Number.isFinite(row.position) || row.position < 1) return [];
    if (row.impressions >= 100 && row.position >= 3 && row.position <= 20 && row.ctr < 0.02) {
      const kind: OpportunityKind = row.position <= 10 ? 'low_ctr' : 'striking_distance';
      const impact = row.impressions >= 1000 ? 5 : row.impressions >= 500 ? 4 : 3;
      const confidence = 3; // Candidate, not a confirmed uplift prediction.
      const effort = 3;
      return [{ ...row, kind, impact, confidence, effort,
        score: scoreOpportunity({ impact, confidence, effort }),
        fingerprint: opportunityFingerprint({ kind, pageUrl: row.pageUrl, keyword: row.query }) }];
    }
    return [];
  });
}
