import { Worker } from 'bullmq';

import { loadConfig } from '@seo-auditor/config';
import { crawlSite } from '@seo-auditor/crawler';
import { db } from '@seo-auditor/database';
import { AUDIT_QUEUE } from '@seo-auditor/queue';
import { evaluatePage } from '@seo-auditor/rules';
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

    try {
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
          const page = await db.page.create({
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

          const pageFindings = evaluatePage(pageFacts);

          findings.push(...pageFindings);

          if (pageFindings.length > 0) {
            await db.issue.createMany({
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
        },
      });

      await db.audit.update({
        where: {
          id: job.data.auditId,
        },
        data: {
          status: 'completed',
          completedAt: new Date(),
          score: score(findings),
        },
      });
    } catch (error) {
      await db.audit.update({
        where: {
          id: job.data.auditId,
        },
        data: {
          status: 'failed',
          completedAt: new Date(),
        },
      });

      throw error;
    }
  },
  {
    connection: {
      url: config.REDIS_URL,
    },
    concurrency: config.CRAWLER_CONCURRENCY,
  },
);
