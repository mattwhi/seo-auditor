import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluatePage } from './index.js';
import type { PageFacts } from '@seo-auditor/types';
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
  const ids = evaluatePage(page).map((x) => x.ruleId);
  assert.ok(ids.includes('title.missing'));
  assert.ok(ids.includes('heading.h1-missing'));
  assert.ok(ids.includes('image.alt-missing'));
});
