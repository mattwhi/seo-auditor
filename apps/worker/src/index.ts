import { measurePageSpeed, failedMeasurement } from './performance.js';
import { Worker } from 'bullmq';

import { loadConfig } from '@seo-auditor/config';
import { crawlSite } from '@seo-auditor/crawler';
import { db } from '@seo-auditor/database';
import { AUDIT_QUEUE } from '@seo-auditor/queue';
import { evaluateAudit, evaluatePage } from '@seo-auditor/rules';
import { score } from '@seo-auditor/scoring';
import type { CrawlJob, RuleFinding } from '@seo-auditor/types';

const config = loadConfig();

new Worker<CrawlJob>(
  AUDIT_QUEUE,
  async (job) => {
    await db.audit.update({
      where: {
        id: job.data.auditId,
      },
      data: {
        status: 'running',
        startedAt: new Date(),
      },
    });

    const findings: RuleFinding[] = [];
    let pageCount = 0;

    try {
      // A BullMQ retry must produce the same persisted audit result rather than
      // appending a second copy of pages, findings or crawl failures.
      await db.$transaction([
        db.issue.deleteMany({ where: { auditId: job.data.auditId } }),
        db.page.deleteMany({ where: { auditId: job.data.auditId } }),
        db.crawlFailure.deleteMany({ where: { auditId: job.data.auditId } }),
        db.performanceResult.deleteMany({ where: { auditId: job.data.auditId } }),
      ]);
      await crawlSite(job.data.startUrl, {
        maxUrls: job.data.maxUrls,
        concurrency: config.CRAWLER_PAGE_CONCURRENCY,
        minDelayMs: config.CRAWLER_MIN_DELAY_MS,
        maxRetries: config.CRAWLER_MAX_RETRIES,
        retryBaseDelayMs: config.CRAWLER_RETRY_BASE_DELAY_MS,
        retryMaxDelayMs: config.CRAWLER_RETRY_MAX_DELAY_MS,
        maxRedirects: config.CRAWLER_MAX_REDIRECTS,
        userAgent: config.CRAWLER_USER_AGENT,
        timeoutMs: config.CRAWLER_REQUEST_TIMEOUT_MS,

        onFailure: async (failure) => {
          await db.crawlFailure.create({
            data: {
              auditId: job.data.auditId,
              url: failure.url,
              type: failure.type,
              message: failure.message,
              statusCode: failure.statusCode,
              attempts: failure.attempts,
              redirectChain: failure.redirectHops ?? undefined,
            },
          });
        },

        onPage: async (pageFacts) => {
          const state = await db.audit.findUnique({
            where: { id: job.data.auditId },
            select: { cancelRequested: true },
          });
          if (state?.cancelRequested) throw new Error('AUDIT_CANCELLED');
          const pageFindings = evaluatePage(pageFacts);

          await db.$transaction(async (tx) => {
            const page = await tx.page.create({
              data: {
                auditId: job.data.auditId,
                url: pageFacts.url,
                finalUrl: pageFacts.finalUrl,
                statusCode: pageFacts.statusCode,
                responseTimeMs: pageFacts.responseTimeMs,
                title: pageFacts.title,
                metaDescription: pageFacts.metaDescription,
                canonical: pageFacts.canonical,
                robots: pageFacts.robots,
                h1: pageFacts.h1,
                h2: pageFacts.h2,
                wordCount: pageFacts.wordCount,
                schemaTypes: pageFacts.schemaTypes,
                images: JSON.parse(JSON.stringify(pageFacts.images)),
                outgoingLinks: JSON.parse(JSON.stringify(pageFacts.links)),
                hreflang: JSON.parse(JSON.stringify(pageFacts.hreflang ?? [])),
                jsonLdBlocks: pageFacts.jsonLdBlocks ?? 0,
                jsonLdErrors: pageFacts.jsonLdErrors ?? 0,
                contentHash: pageFacts.contentHash,
                redirectChain: pageFacts.redirectHops ?? undefined,
                contentType: pageFacts.contentType,
                contentLength: pageFacts.contentLength,
                contentEncoding: pageFacts.contentEncoding,
                contentLanguage: pageFacts.contentLanguage,
                cacheControl: pageFacts.cacheControl,
                etag: pageFacts.etag,
                lastModified: pageFacts.lastModified,
                xRobotsTag: pageFacts.xRobotsTag ?? [],
                crawlDepth: pageFacts.crawlDepth,
                redirectCount: pageFacts.redirectCount,
                fetchAttempts: pageFacts.fetchAttempts,
              },
            });

            if (pageFindings.length > 0) {
              await tx.issue.createMany({
                data: pageFindings.map((finding) => ({
                  auditId: job.data.auditId,
                  pageId: page.id,
                  ruleId: finding.ruleId,
                  severity: finding.severity,
                  category: finding.category,
                  message: finding.message,
                  evidence: finding.evidence ?? undefined,
                })),
              });
            }
          });

          findings.push(...pageFindings);
          pageCount += 1;
        },
      });

      const persistedPages = await db.page.findMany({ where: { auditId: job.data.auditId } });
      const advancedFindings = evaluateAudit(
        persistedPages.map((page) => ({
          id: page.id,
          url: page.url,
          finalUrl: page.finalUrl,
          statusCode: page.statusCode,
          contentType: page.contentType,
          title: page.title,
          metaDescription: page.metaDescription,
          canonical: page.canonical,
          robots: page.robots,
          xRobotsTag: page.xRobotsTag,
          crawlDepth: page.crawlDepth,
          contentHash: page.contentHash,
          outgoingLinks: (page.outgoingLinks ?? []) as Array<{
            href: string;
            text: string | null;
            internal: boolean;
          }>,
          hreflang: (page.hreflang ?? []) as Array<{ lang: string; href: string }>,
          jsonLdErrors: page.jsonLdErrors,
        })),
        job.data.startUrl,
      );

      if (advancedFindings.length > 0) {
        await db.issue.createMany({
          data: advancedFindings.map((finding) => ({
            auditId: job.data.auditId,
            pageId: finding.pageId,
            ruleId: finding.ruleId,
            severity: finding.severity,
            category: finding.category,
            message: finding.message,
            evidence: finding.evidence ?? undefined,
          })),
        });
        findings.push(...advancedFindings);
      }

      // Opt-in PageSpeed collection; a quota/network error must never fail the SEO crawl.
      // Lab and field metrics are persisted separately and do not affect technical SEO scoring.
      if (process.env.PERFORMANCE_ENABLED === 'true') {
        for (const strategy of ['mobile', 'desktop'] as const) {
          let result;
          try {
            result = await measurePageSpeed(job.data.startUrl, strategy, process.env.PAGESPEED_API_KEY);
          } catch (error) {
            result = failedMeasurement(job.data.startUrl, strategy, error);
          }
          await db.performanceResult.upsert({
            where: { auditId_strategy: { auditId: job.data.auditId, strategy } },
            create: { auditId: job.data.auditId, strategy, url: result.url, status: result.status,
              measuredAt: new Date(result.measuredAt), lighthouseScore: result.lighthouseScore,
              metrics: JSON.parse(JSON.stringify(result)), error: result.error },
            update: { url: result.url, status: result.status, measuredAt: new Date(result.measuredAt),
              lighthouseScore: result.lighthouseScore, metrics: JSON.parse(JSON.stringify(result)), error: result.error },
          });
        }
      }

      await db.audit.update({
        where: {
          id: job.data.auditId,
        },
        data: {
          status: 'completed',
          completedAt: new Date(),
          score: score(findings, pageCount),
        },
      });
    } catch (error) {
      const cancelled = error instanceof Error && error.message === 'AUDIT_CANCELLED';
      await db.audit.update({
        where: {
          id: job.data.auditId,
        },
        data: {
          status: cancelled ? 'cancelled' : 'failed',
          completedAt: new Date(),
        },
      });

      if (!cancelled) throw error;
    }
  },
  {
    connection: {
      url: config.REDIS_URL,
    },
    concurrency: config.CRAWLER_CONCURRENCY,
  },
);
