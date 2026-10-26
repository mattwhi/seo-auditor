import assert from 'node:assert/strict';
import test from 'node:test';
import { keywordCandidates, opportunityFingerprint, scoreOpportunity } from './index.js';

test('score is bounded and rewards higher impact and lower effort', () => {
  assert.equal(scoreOpportunity({ impact: 5, confidence: 5, effort: 1 }), 100);
  assert.equal(scoreOpportunity({ impact: 1, confidence: 1, effort: 5 }), 20);
  assert.ok(scoreOpportunity({ impact: 5, confidence: 3, effort: 3 }) > scoreOpportunity({ impact: 2, confidence: 3, effort: 3 }));
  assert.throws(() => scoreOpportunity({ impact: 6, confidence: 3, effort: 3 }), RangeError);
});

test('fingerprints are deterministic and keyword case-insensitive', () => {
  const a = opportunityFingerprint({ kind: 'low_ctr', pageUrl: 'https://example.com/', keyword: 'DOG TREATS' });
  const b = opportunityFingerprint({ kind: 'low_ctr', pageUrl: 'https://example.com/', keyword: 'dog treats' });
  assert.equal(a, b);
  assert.notEqual(a, opportunityFingerprint({ kind: 'technical', pageUrl: 'https://example.com/', keyword: 'dog treats' }));
});

test('only eligible first-party observations produce candidates', () => {
  const candidates = keywordCandidates([
    { query: 'natural treats', pageUrl: 'https://example.com/treats', clicks: 4, impressions: 500, ctr: 0.008, position: 7 },
    { query: 'excellent page', pageUrl: 'https://example.com/good', clicks: 60, impressions: 500, ctr: 0.12, position: 2 },
    { query: 'invalid', pageUrl: 'https://example.com/bad', clicks: 120, impressions: 100, ctr: 1.2, position: 5 },
  ]);
  assert.ok(candidates.some(c => c.kind === 'low_ctr' && c.query === 'natural treats'));
  assert.ok(!candidates.some(c => c.query === 'excellent page'));
  assert.ok(!candidates.some(c => c.query === 'invalid'));
});

test('adaptive thresholds surface lower-volume page-two and emerging queries', () => {
  const candidates = keywordCandidates([
    { query: 'new dog treats', pageUrl: 'https://example.com/new', clicks: 0, impressions: 24, ctr: 0, position: 15 },
    { query: 'tiny sample', pageUrl: 'https://example.com/tiny', clicks: 0, impressions: 3, ctr: 0, position: 15 },
  ]);
  assert.ok(candidates.some(c => c.kind === 'page_two'));
  assert.ok(candidates.some(c => c.kind === 'emerging'));
  assert.ok(!candidates.some(c => c.query === 'tiny sample'));
});
