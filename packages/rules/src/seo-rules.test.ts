import assert from 'node:assert/strict';
import test from 'node:test';

import type { PageFacts } from '@seo-auditor/types';

import { evaluatePage } from './index.js';

const basePage = (overrides: Partial<PageFacts> = {}): PageFacts => ({
  url: 'https://example.test/old',
  finalUrl: 'https://example.test/page',
  statusCode: 200,
  contentType: 'text/html',
  responseTimeMs: 25,
  title: 'A useful example page title for testing',
  metaDescription:
    'A useful example meta description with enough detail to sit comfortably inside the normal length thresholds.',
  canonical: 'https://example.test/page',
  robots: [],
  h1: ['Example page'],
  h2: [],
  wordCount: 300,
  images: [],
  links: [],
  schemaTypes: [],
  xRobotsTag: [],
  redirectCount: 0,
  redirectHops: [],
  ...overrides,
});

const findingFor = (page: PageFacts, ruleId: string) =>
  evaluatePage(page).find((finding) => finding.ruleId === ruleId);

test('reports 5xx responses with deterministic HTTP evidence', () => {
  assert.deepEqual(findingFor(basePage({ statusCode: 503 }), 'status.server-error')?.evidence, {
    statusCode: 503,
    url: 'https://example.test/page',
  });
});

test('reports 4xx responses with deterministic HTTP evidence', () => {
  assert.deepEqual(findingFor(basePage({ statusCode: 404 }), 'status.client-error')?.evidence, {
    statusCode: 404,
    url: 'https://example.test/page',
  });
});

test('reports redirects and redirect chains independently', () => {
  const redirectHops = [
    {
      url: 'https://example.test/old',
      statusCode: 301,
      location: '/middle',
      targetUrl: 'https://example.test/middle',
    },
    {
      url: 'https://example.test/middle',
      statusCode: 302,
      location: '/page',
      targetUrl: 'https://example.test/page',
    },
  ];
  const findings = evaluatePage(basePage({ redirectCount: 2, redirectHops }));
  assert.ok(findings.some((item) => item.ruleId === 'redirect.present'));
  assert.deepEqual(findings.find((item) => item.ruleId === 'redirect.chain')?.evidence, {
    count: 2,
    requestedUrl: 'https://example.test/old',
    finalUrl: 'https://example.test/page',
    hops: redirectHops,
  });
});

test('does not report a redirect chain for a single redirect', () => {
  const findings = evaluatePage(basePage({ redirectCount: 1 }));
  assert.ok(findings.some((item) => item.ruleId === 'redirect.present'));
  assert.ok(!findings.some((item) => item.ruleId === 'redirect.chain'));
});

test('detects noindex in meta robots directives', () => {
  assert.deepEqual(
    findingFor(basePage({ robots: ['index', 'noindex'] }), 'indexability.noindex')?.evidence,
    { source: 'meta-robots', directives: ['index', 'noindex'] },
  );
});

test('detects noindex in X-Robots-Tag including agent-qualified directives', () => {
  const evidence = findingFor(
    basePage({ xRobotsTag: ['googlebot: noindex', 'nofollow'] }),
    'indexability.x-robots-noindex',
  )?.evidence;
  assert.deepEqual(evidence, {
    source: 'x-robots-tag',
    directives: ['googlebot: noindex', 'nofollow'],
  });
});

test('accepts relative canonicals resolved against the final URL', () => {
  const findings = evaluatePage(basePage({ canonical: '/page' }));
  assert.ok(!findings.some((item) => item.ruleId === 'indexability.canonical-invalid'));
  assert.ok(!findings.some((item) => item.ruleId === 'indexability.canonical-non-self'));
});

test('reports canonicals using unsupported protocols', () => {
  assert.deepEqual(
    findingFor(basePage({ canonical: 'javascript:void(0)' }), 'indexability.canonical-invalid')
      ?.evidence,
    { canonical: 'javascript:void(0)' },
  );
});

test('reports a non-self-referencing canonical as informational evidence', () => {
  assert.deepEqual(
    findingFor(
      basePage({ canonical: 'https://example.test/preferred' }),
      'indexability.canonical-non-self',
    )?.evidence,
    {
      canonical: 'https://example.test/preferred',
      finalUrl: 'https://example.test/page',
    },
  );
});

test('reports title length thresholds only when a title exists', () => {
  assert.ok(findingFor(basePage({ title: 'Short title' }), 'title.too-short'));
  assert.ok(findingFor(basePage({ title: 'x'.repeat(61) }), 'title.too-long'));
  const missing = evaluatePage(basePage({ title: null }));
  assert.ok(missing.some((item) => item.ruleId === 'title.missing'));
  assert.ok(!missing.some((item) => item.ruleId === 'title.too-short'));
});

test('reports meta description length thresholds only when a description exists', () => {
  assert.ok(
    findingFor(basePage({ metaDescription: 'Too short' }), 'description.too-short'),
  );
  assert.ok(
    findingFor(basePage({ metaDescription: 'x'.repeat(161) }), 'description.too-long'),
  );
  const missing = evaluatePage(basePage({ metaDescription: null }));
  assert.ok(missing.some((item) => item.ruleId === 'description.missing'));
  assert.ok(!missing.some((item) => item.ruleId === 'description.too-short'));
});

test('reports empty H1 elements separately from a missing H1', () => {
  const findings = evaluatePage(basePage({ h1: ['', 'Example'] }));
  assert.deepEqual(findings.find((item) => item.ruleId === 'heading.h1-empty')?.evidence, {
    count: 1,
  });
  assert.ok(!findings.some((item) => item.ruleId === 'heading.h1-missing'));
});
