import assert from 'node:assert/strict';
import test from 'node:test';
import { parsePageSpeed, rateVital, selectPerformanceTargets } from '../dist/performance.js';

test('threshold boundaries and missing values', () => {
  assert.equal(rateVital('lcp', 2500), 'good');
  assert.equal(rateVital('lcp', 4000), 'needs-improvement');
  assert.equal(rateVital('lcp', 4001), 'poor');
  assert.equal(rateVital('inp', null), 'unavailable');
  assert.equal(rateVital('cls', 0.1), 'good');
});

test('parse diagnostic evidence without inventing field values', () => {
  const result = parsePageSpeed({ lighthouseResult: { categories: { performance: { score: 0.57 } }, audits: { 'largest-contentful-paint': { numericValue: 57700, displayValue: '57.7 s' }, 'largest-contentful-paint-element': { title: 'LCP element', details: { items: [{ node: { snippet: '<img>' } }] } } } } }, 'mobile', 'https://example.com/');
  assert.equal(result.lighthouseScore, 57);
  assert.equal(result.fieldLcp, null);
  assert.equal(result.fieldSource, 'none');
  assert.equal(result.diagnostics[0]?.element, '<img>');
});

test('sample deterministic representative indexable pages', () => {
  const make = (path, robots = []) => ({ url: `https://example.com${path}`, finalUrl: `https://example.com${path}`, statusCode: 200, contentType: 'text/html', canonical: null, robots, xRobotsTag: [], crawlDepth: 2 });
  const pages = [make('/product/item/'), make('/product-category/dogs/'), make('/blog/story/'), make('/product/hidden/', ['noindex']), make('/cdn-cgi/l/email-protection')];
  const selected = selectPerformanceTargets('https://example.com/', pages);
  assert.deepEqual(selected.map((s) => s.pageType), ['homepage', 'category', 'product', 'article']);
  assert.equal(selected.length, 4);
});
