import { isNonContentUtilityUrl } from './utility-links.js';
import { analyzeHtml } from '@seo-auditor/analyzer';
import type { CrawlFailure, PageFacts } from '@seo-auditor/types';
import { extractHttpResponseMetadata } from './http-metadata.js';
import { CrawlQueue } from './queue.js';
import { fetchWithRedirects, RedirectError } from './redirect.js';
import { fetchRobotsPolicy, isAllowedByRobots } from './robots.js';
import { CrawlScheduler } from './scheduler.js';
import { discoverSitemapUrls } from './sitemap.js';
import { isSameOrigin, normalizeUrl } from './url.js';

export interface CrawlOptions {
  maxUrls: number;
  maxDepth?: number;
  maxQueueSize?: number;
  concurrency?: number;
  minDelayMs?: number;
  maxRetries?: number;
  retryBaseDelayMs?: number;
  retryMaxDelayMs?: number;
  maxRedirects?: number;
  userAgent: string;
  timeoutMs: number;
  onPage?: (page: PageFacts) => Promise<void> | void;
  onFailure?: (failure: CrawlFailure) => Promise<void> | void;
}

export async function crawlSite(startUrl: string, options: CrawlOptions): Promise<PageFacts[]> {
  if (!Number.isInteger(options.maxUrls) || options.maxUrls < 1) {
    throw new RangeError('maxUrls must be a positive integer');
  }

  const maxDepth = options.maxDepth ?? Number.MAX_SAFE_INTEGER;
  const maxQueueSize = options.maxQueueSize ?? Math.max(options.maxUrls, 1);
  const concurrency = options.concurrency ?? 1;
  const minDelayMs = options.minDelayMs ?? 0;
  const maxRetries = options.maxRetries ?? 2;
  const retryBaseDelayMs = options.retryBaseDelayMs ?? 500;
  const retryMaxDelayMs = options.retryMaxDelayMs ?? 5000;
  const maxRedirects = options.maxRedirects ?? 10;

  if (!Number.isInteger(maxDepth) || maxDepth < 0) {
    throw new RangeError('maxDepth must be a non-negative integer');
  }

  if (!Number.isInteger(maxQueueSize) || maxQueueSize < 1) {
    throw new RangeError('maxQueueSize must be a positive integer');
  }

  if (!Number.isInteger(concurrency) || concurrency < 1) {
    throw new RangeError('concurrency must be a positive integer');
  }

  if (!Number.isFinite(minDelayMs) || minDelayMs < 0) {
    throw new RangeError('minDelayMs must be a non-negative number');
  }

  if (!Number.isInteger(maxRetries) || maxRetries < 0) {
    throw new RangeError('maxRetries must be a non-negative integer');
  }

  if (!Number.isFinite(retryBaseDelayMs) || retryBaseDelayMs < 0) {
    throw new RangeError('retryBaseDelayMs must be a non-negative number');
  }

  if (!Number.isFinite(retryMaxDelayMs) || retryMaxDelayMs < retryBaseDelayMs) {
    throw new RangeError('retryMaxDelayMs must be greater than or equal to retryBaseDelayMs');
  }

  if (!Number.isInteger(maxRedirects) || maxRedirects < 0) {
    throw new RangeError('maxRedirects must be a non-negative integer');
  }

  const normalizedStartUrl = normalizeUrl(startUrl);
  const origin = new URL(normalizedStartUrl).origin;
  const robotsPolicy = await fetchRobotsPolicy(origin, {
    userAgent: options.userAgent,
    timeoutMs: options.timeoutMs,
  });
  const sitemapUrls = await discoverSitemapUrls(origin, robotsPolicy?.content ?? null, {
    userAgent: options.userAgent,
    timeoutMs: options.timeoutMs,
  });

  const queue = new CrawlQueue({ maxDepth, maxSize: maxQueueSize });
  queue.enqueue(normalizedStartUrl, 0);

  for (const sitemapUrl of sitemapUrls) {
    queue.enqueue(sitemapUrl, 0);
  }

  const pages: PageFacts[] = [];
  const scheduler = new CrawlScheduler({ concurrency, minDelayMs });
  let attemptedUrls = 0;

  while (queue.size > 0 && attemptedUrls < options.maxUrls) {
    const batch: Array<{ url: string; depth: number }> = [];

    while (batch.length < concurrency && queue.size > 0 && attemptedUrls < options.maxUrls) {
      const entry = queue.dequeue();
      if (!entry) break;

      if (robotsPolicy && !isAllowedByRobots(entry.url, robotsPolicy, options.userAgent)) {
        continue;
      }

      attemptedUrls += 1;
      batch.push(entry);
    }

    if (batch.length === 0) {
      continue;
    }

    const results = await Promise.all(
      batch.map(({ url, depth }) =>
        scheduler.run(async () => {
          const startedAt = Date.now();

          try {
            const fetchResult = await fetchWithRedirects(
              url,
              {
                headers: {
                  'user-agent': options.userAgent,
                },
              },
              {
                maxRetries,
                baseDelayMs: retryBaseDelayMs,
                maxDelayMs: retryMaxDelayMs,
                timeoutMs: options.timeoutMs,
              },
              { maxRedirects },
            );
            const response = fetchResult.response;

            if (fetchResult.retriesExhausted) {
              await options.onFailure?.({
                url,
                type: 'http',
                message: `HTTP ${response.status} after ${fetchResult.attempts} attempts`,
                statusCode: response.status,
                attempts: fetchResult.attempts,
              });
            }

            const contentType = response.headers.get('content-type');

            if (!contentType?.includes('text/html')) {
              return null;
            }

            const html = await response.text();
            const analyzedPage = analyzeHtml({
              url,
              finalUrl: fetchResult.finalUrl,
              statusCode: response.status,
              contentType,
              responseTimeMs: Date.now() - startedAt,
              html,
            });
            const httpMetadata = extractHttpResponseMetadata(response.headers);
            const page: PageFacts = {
              ...analyzedPage,
              ...httpMetadata,
              crawlDepth: depth,
              redirectCount: fetchResult.hops.length,
              fetchAttempts: fetchResult.attempts,
              redirectHops: fetchResult.hops,
            };

            return { page, depth };
          } catch (error) {
            if (error instanceof RedirectError) {
              await options.onFailure?.({
                url,
                type: 'redirect',
                message: error.message,
                attempts: error.hops.length + 1,
                redirectHops: error.hops,
              });
              return null;
            }

            const isTimeout =
              error instanceof DOMException &&
              (error.name === 'TimeoutError' || error.name === 'AbortError');
            const message = error instanceof Error ? error.message : 'Unknown crawl failure';

            await options.onFailure?.({
              url,
              type: isTimeout ? 'timeout' : 'network',
              message,
              attempts: maxRetries + 1,
            });
            return null;
          }
        }),
      ),
    );

    for (const result of results) {
      if (!result) continue;

      pages.push(result.page);
      await options.onPage?.(result.page);

      for (const link of result.page.links) {
        if (!link.internal) continue;

        try {
          const normalizedUrl = normalizeUrl(link.href);
          if (isSameOrigin(normalizedUrl, origin) && !isNonContentUtilityUrl(normalizedUrl)) {
            queue.enqueue(normalizedUrl, result.depth + 1);
          }
        } catch {
          // Ignore malformed URLs discovered in page links.
        }
      }
    }
  }

  return pages;
}

export {
  fetchWithRedirects,
  isRedirectStatus,
  RedirectError,
  resolveRedirectLocation,
} from './redirect.js';
export type { RedirectHop, RedirectOptions, RedirectResult } from './redirect.js';
export { CrawlQueue } from './queue.js';
export { extractHttpResponseMetadata } from './http-metadata.js';
export type { HttpResponseMetadata } from './http-metadata.js';
export { CrawlScheduler } from './scheduler.js';
export {
  calculateRetryDelay,
  fetchWithRetry,
  isRetryableStatus,
  parseRetryAfter,
} from './retry.js';
export type { FetchAttemptResult, RetryOptions } from './retry.js';
export type { CrawlSchedulerOptions } from './scheduler.js';
export type { CrawlQueueEntry, CrawlQueueOptions } from './queue.js';
export { fetchRobotsPolicy, isAllowedByRobots, parseRobotsTxt } from './robots.js';
export { discoverSitemapUrls, extractSitemapUrlsFromRobots, parseSitemapXml } from './sitemap.js';
export { isSameOrigin, isSupportedUrl, normalizeUrl } from './url.js';
