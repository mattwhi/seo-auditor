import assert from 'node:assert/strict';
import test from 'node:test';

import type { PageFacts } from '@seo-auditor/types';

import { coreRuleRegistry, evaluatePage } from './index.js';

const page: PageFacts = {
  url: 'https://example.test',
  finalUrl: 'https://example.test',
  statusCode: 200,
  contentType: 'text/html',
  responseTimeMs: 1,
  title: null,
  metaDescription: null,
  canonical: null,
  robots: [],
  h1: [],
  h2: [],
  wordCount: 20,
  images: [{ src: '/a.jpg', alt: null }],
  links: [],
  schemaTypes: [],
};

test('core rules expose stable findings', () => {
  const ids = evaluatePage(page).map((finding) => finding.ruleId);
  assert.ok(ids.includes('title.missing'));
  assert.ok(ids.includes('heading.h1-missing'));
  assert.ok(ids.includes('image.alt-missing'));
});

test('core rule IDs are unique and namespaced', () => {
  const ids = coreRuleRegistry.list().map((rule) => rule.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(ids.every((id) => id.includes('.')));
});

test('core findings carry deterministic evidence', () => {
  const findings = evaluatePage({
    ...page,
    h1: ['One', 'Two'],
    images: [
      { src: '/one.jpg', alt: null },
      { src: '/two.jpg', alt: '' },
      { src: '/three.jpg', alt: 'Three' },
    ],
  });

  assert.deepEqual(findings.find((item) => item.ruleId === 'heading.h1-multiple')?.evidence, {
    count: 2,
    headings: [{ position: 1, text: 'One' }, { position: 2, text: 'Two' }],
  });
  assert.deepEqual(findings.find((item) => item.ruleId === 'image.alt-missing')?.evidence, {
    count: 1,
    images: [{ position: 1, src: '/one.jpg', altState: 'missing-attribute' }],
  });
});
