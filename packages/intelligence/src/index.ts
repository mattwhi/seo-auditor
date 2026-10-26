import { createHash } from 'node:crypto';

/** Pure, deterministic advisory scoring; no network access or writes. */
export type OpportunityKind =
  'low_ctr' | 'striking_distance' | 'page_two' | 'emerging' | 'content_gap' | 'technical';
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
export function scoreOpportunity(
  input: Pick<OpportunityInputs, 'impact' | 'confidence' | 'effort'>,
): number {
  const impact = boundedInteger(input.impact, 'impact');
  const confidence = boundedInteger(input.confidence, 'confidence');
  const effort = boundedInteger(input.effort, 'effort');
  return Math.round(((impact / 5) * 0.5 + (confidence / 5) * 0.3 + ((6 - effort) / 5) * 0.2) * 100);
}

export function opportunityFingerprint(
  input: Pick<OpportunityInputs, 'kind' | 'pageUrl' | 'keyword'>,
): string {
  const kind = input.kind.trim().toLowerCase();
  const pageUrl = (input.pageUrl ?? '').trim();
  const keyword = (input.keyword ?? '').trim().toLowerCase();
  if (!kind || (!pageUrl && !keyword))
    throw new Error('Opportunity requires a kind and a page URL or keyword');
  return createHash('sha256')
    .update(JSON.stringify([kind, pageUrl, keyword]))
    .digest('hex');
}

export type SearchConsoleObservation = {
  query: string;
  pageUrl: string;
  clicks: number;
  impressions: number;
  ctr: number; // 0..1
  position: number;
};

/** Adaptive, deterministic candidate discovery from first-party GSC observations. */
export type KeywordCandidateKind = 'low_ctr' | 'striking_distance' | 'page_two' | 'emerging';
export type KeywordCandidate = SearchConsoleObservation & {
  kind: KeywordCandidateKind;
  impact: number;
  confidence: number;
  effort: number;
  score: number;
  fingerprint: string;
};

export function keywordCandidates(
  observations: readonly SearchConsoleObservation[],
): KeywordCandidate[] {
  return observations.flatMap((row): KeywordCandidate[] => {
    if (
      !row.query.trim() ||
      !row.pageUrl.trim() ||
      !Number.isInteger(row.clicks) ||
      row.clicks < 0 ||
      !Number.isInteger(row.impressions) ||
      row.impressions < 0 ||
      row.clicks > row.impressions ||
      !Number.isFinite(row.ctr) ||
      row.ctr < 0 ||
      row.ctr > 1 ||
      !Number.isFinite(row.position) ||
      row.position < 1 ||
      row.impressions < 10
    )
      return [];

    const kinds: KeywordCandidateKind[] = [];
    if (row.position >= 3 && row.position <= 10 && row.ctr < 0.03 && row.impressions >= 20)
      kinds.push('low_ctr');
    if (row.position > 10 && row.position <= 20 && row.impressions >= 10) kinds.push('page_two');
    else if (row.position > 4 && row.position <= 10 && row.impressions >= 20)
      kinds.push('striking_distance');
    if (
      row.impressions >= 10 &&
      row.impressions < 100 &&
      row.clicks <= 2 &&
      row.position > 10 &&
      row.position <= 40
    )
      kinds.push('emerging');

    return kinds.map((kind) => {
      const impact =
        row.impressions >= 1000
          ? 5
          : row.impressions >= 300
            ? 4
            : row.impressions >= 100
              ? 3
              : row.impressions >= 30
                ? 2
                : 1;
      const confidence = row.impressions >= 100 ? 4 : row.impressions >= 30 ? 3 : 2;
      const effort = kind === 'low_ctr' ? 2 : kind === 'striking_distance' ? 3 : 4;
      return {
        ...row,
        kind,
        impact,
        confidence,
        effort,
        score: scoreOpportunity({ impact, confidence, effort }),
        fingerprint: opportunityFingerprint({ kind, pageUrl: row.pageUrl, keyword: row.query }),
      };
    });
  });
}
