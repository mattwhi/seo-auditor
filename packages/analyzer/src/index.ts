import { createHash } from 'node:crypto';
import * as cheerio from 'cheerio';

import type { PageFacts } from '@seo-auditor/types';

const clean = (value?: string | null): string | null => value?.trim() || null;

function collectSchemaTypes(value: unknown, schemaTypes: string[]): void {
  if (value === null || value === undefined) {
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item) => collectSchemaTypes(item, schemaTypes));
    return;
  }

  if (typeof value !== 'object') {
    return;
  }

  const object = value as Record<string, unknown>;
  const type = object['@type'];

  if (typeof type === 'string') {
    schemaTypes.push(type);
  }

  Object.values(object).forEach((item) => {
    collectSchemaTypes(item, schemaTypes);
  });
}

export function analyzeHtml(input: {
  url: string;
  finalUrl: string;
  statusCode: number;
  contentType: string | null;
  responseTimeMs: number;
  html: string;
}): PageFacts {
  const $ = cheerio.load(input.html);
  const baseUrl = new URL(input.finalUrl);
  const bodyText = $('body').text().replace(/\s+/g, ' ').trim();

  const robots = (clean($('meta[name="robots"]').attr('content')) ?? '')
    .toLowerCase()
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  const links = $('a[href]')
    .map((_, element) => {
      const rawHref = $(element).attr('href');

      if (!rawHref) {
        return null;
      }

      try {
        const href = new URL(rawHref, baseUrl).href;

        return {
          href,
          text: clean($(element).text()),
          internal: new URL(href).origin === baseUrl.origin,
        };
      } catch {
        return null;
      }
    })
    .get()
    .filter(
      (
        link,
      ): link is {
        href: string;
        text: string | null;
        internal: boolean;
      } => link !== null,
    );

  const schemaTypes: string[] = [];
  let jsonLdBlocks = 0;
  let jsonLdErrors = 0;

  $('script[type="application/ld+json"]').each((_, element) => {
    jsonLdBlocks += 1;
    try {
      const json: unknown = JSON.parse($(element).text());
      collectSchemaTypes(json, schemaTypes);
    } catch {
      jsonLdErrors += 1;
      // Invalid JSON-LD should not prevent the rest of the page from being analysed.
    }
  });

  return {
    ...input,
    title: clean($('title').first().text()),
    metaDescription: clean($('meta[name="description"]').attr('content')),
    canonical: clean($('link[rel="canonical"]').attr('href')),
    robots,
    h1: $('h1')
      .map((_, element) => $(element).text().trim())
      .get(),
    h2: $('h2')
      .map((_, element) => $(element).text().trim())
      .get(),
    wordCount: bodyText ? bodyText.split(/\s+/).length : 0,
    images: $('img')
      .map((_, element) => ({
        src: $(element).attr('src') ?? '',
        alt: clean($(element).attr('alt')),
      }))
      .get(),
    links,
    schemaTypes: [...new Set(schemaTypes)],
    hreflang: $('link[rel="alternate"][hreflang][href]').map((_, element) => {
      const lang = clean($(element).attr('hreflang')) ?? '';
      const rawHref = $(element).attr('href') ?? '';
      try { return { lang: lang.toLowerCase(), href: new URL(rawHref, baseUrl).href }; } catch { return { lang: lang.toLowerCase(), href: rawHref }; }
    }).get(),
    jsonLdBlocks,
    jsonLdErrors,
    contentHash: bodyText ? createHash('sha256').update(bodyText.toLowerCase()).digest('hex') : null,
  };
}
