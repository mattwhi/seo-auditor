import assert from 'node:assert/strict';
import test from 'node:test';

import { extractSitemapUrlsFromRobots, parseSitemapXml } from './sitemap.js';

test('parses URL set locations', () => {
  const document = parseSitemapXml(`
    <?xml version="1.0" encoding="UTF-8"?>
    <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
      <url><loc>https://example.com/</loc></url>
      <url><loc>https://example.com/products</loc></url>
    </urlset>
  `);

  assert.equal(document.type, 'urlset');
  assert.deepEqual(document.locations, [
    'https://example.com/',
    'https://example.com/products',
  ]);
});

test('parses sitemap index locations', () => {
  const document = parseSitemapXml(`
    <sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
      <sitemap><loc>https://example.com/post-sitemap.xml</loc></sitemap>
      <sitemap><loc>https://example.com/product-sitemap.xml</loc></sitemap>
    </sitemapindex>
  `);

  assert.equal(document.type, 'sitemapindex');
  assert.deepEqual(document.locations, [
    'https://example.com/post-sitemap.xml',
    'https://example.com/product-sitemap.xml',
  ]);
});

test('supports namespaced sitemap elements', () => {
  const document = parseSitemapXml(`
    <sm:urlset xmlns:sm="http://www.sitemaps.org/schemas/sitemap/0.9">
      <sm:url><sm:loc>https://example.com/page</sm:loc></sm:url>
    </sm:urlset>
  `);

  assert.equal(document.type, 'urlset');
  assert.deepEqual(document.locations, ['https://example.com/page']);
});

test('decodes XML entities in locations', () => {
  const document = parseSitemapXml(`
    <urlset>
      <url><loc>https://example.com/search?a=1&amp;b=2</loc></url>
    </urlset>
  `);

  assert.deepEqual(document.locations, ['https://example.com/search?a=1&b=2']);
});

test('returns unknown for non-sitemap XML', () => {
  const document = parseSitemapXml('<rss><channel></channel></rss>');
  assert.equal(document.type, 'unknown');
  assert.deepEqual(document.locations, []);
});

test('extracts sitemap declarations from robots.txt', () => {
  const urls = extractSitemapUrlsFromRobots(
    `
User-agent: *
Disallow: /private/
Sitemap: https://example.com/sitemap.xml
Sitemap: /news-sitemap.xml
`,
    'https://example.com/robots.txt',
  );

  assert.deepEqual(urls, [
    'https://example.com/sitemap.xml',
    'https://example.com/news-sitemap.xml',
  ]);
});

test('sitemap declarations are case insensitive and ignore comments', () => {
  const urls = extractSitemapUrlsFromRobots(
    `
SITEMAP: https://example.com/sitemap.xml # primary sitemap
sitemap: https://example.com/sitemap.xml
`,
    'https://example.com/robots.txt',
  );

  assert.deepEqual(urls, ['https://example.com/sitemap.xml']);
});

test('ignores malformed and unsupported sitemap declarations', () => {
  const urls = extractSitemapUrlsFromRobots(
    `
Sitemap: mailto:test@example.com
Sitemap: javascript:void(0)
`,
    'https://example.com/robots.txt',
  );

  assert.deepEqual(urls, []);
});
