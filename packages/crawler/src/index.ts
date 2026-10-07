import { analyzeHtml } from '@seo-auditor/analyzer';
import type { PageFacts } from '@seo-auditor/types';

export interface CrawlOptions {
  maxUrls: number;
  userAgent: string;
  timeoutMs: number;
  onPage?: (page: PageFacts) => Promise<void> | void;
}

const normalize = (rawUrl: string): string => {
  const url = new URL(rawUrl);
  url.hash = '';

  return url.href;
};

export async function crawlSite(startUrl: string, options: CrawlOptions): Promise<PageFacts[]> {
  const origin = new URL(startUrl).origin;
  const queue = [normalize(startUrl)];
  const seen = new Set<string>();
  const pages: PageFacts[] = [];

  while (queue.length > 0 && seen.size < options.maxUrls) {
    const url = queue.shift();

    if (!url || seen.has(url)) {
      continue;
    }

    seen.add(url);

    const startedAt = Date.now();

    try {
      const response = await fetch(url, {
        headers: {
          'user-agent': options.userAgent,
        },
        redirect: 'follow',
        signal: AbortSignal.timeout(options.timeoutMs),
      });

      const contentType = response.headers.get('content-type');

      if (!contentType?.includes('text/html')) {
        continue;
      }

      const html = await response.text();

      const page = analyzeHtml({
        url,
        finalUrl: response.url,
        statusCode: response.status,
        contentType,
        responseTimeMs: Date.now() - startedAt,
        html,
      });

      pages.push(page);
      await options.onPage?.(page);

      for (const link of page.links) {
        if (!link.internal) {
          continue;
        }

        try {
          const normalizedUrl = normalize(link.href);

          if (
            new URL(normalizedUrl).origin === origin &&
            !seen.has(normalizedUrl) &&
            !queue.includes(normalizedUrl)
          ) {
            queue.push(normalizedUrl);
          }
        } catch {
          // Ignore malformed URLs discovered in page links.
        }
      }
    } catch {
      // Crawl failures will be persisted in a later crawler milestone.
    }
  }

  return pages;
}
