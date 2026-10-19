import test from 'node:test';
import assert from 'node:assert/strict';
import { analysisSchema, safePageFacts } from '../dist/index.js';

test('structured AI recommendations reject unknown fields and invalid priorities', () => {
  const example = { summary: 'A clear summary of the SEO issues.', recommendations: [{
    ruleId: 'title.missing', field: 'title', priority: 'high', currentValue: '',
    proposedValue: 'Example title', explanation: 'The page has no title, so add a relevant one.',
    evidence: 'Crawler found no title', requiresHumanReview: true
  }] };
  assert.equal(analysisSchema.safeParse(example).success, true);
  assert.equal(analysisSchema.safeParse({ ...example, unexpected: 'x' }).success, false);
  assert.equal(analysisSchema.safeParse({ ...example, recommendations: [{ ...example.recommendations[0], priority: 'urgent' }] }).success, false);
});

test('page facts sent to the model are size limited', () => {
  const input = { url: 'https://example.com', title: 'x'.repeat(2000), metaDescription: null,
    canonical: null, h1: [], h2: [], wordCount: 10, robots: [], statusCode: 200,
    images: [], outgoingLinks: [], issues: [] };
  const output = safePageFacts(input);
  assert.equal(output.title.length, 300);
});
