import { runAutomaticAi } from './ai-auto.js';
import { measurePageSpeed, failedMeasurement, selectPerformanceTargets } from './performance.js';
import { Worker } from 'bullmq';

import { loadConfig } from '@seo-auditor/config';
import { crawlSite } from '@seo-auditor/crawler';
import { db, getApplicationSettings } from '@seo-auditor/database';
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

    const settings = await getApplicationSettings();
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
        concurrency: Math.min(config.CRAWLER_PAGE_CONCURRENCY, settings['crawler.pageConcurrency']),
        minDelayMs: Math.max(config.CRAWLER_MIN_DELAY_MS, settings['crawler.minDelayMs']),
        maxRetries: Math.min(config.CRAWLER_MAX_RETRIES, settings['crawler.maxRetries']),
        retryBaseDelayMs: config.CRAWLER_RETRY_BASE_DELAY_MS,
        retryMaxDelayMs: config.CRAWLER_RETRY_MAX_DELAY_MS,
        maxRedirects: config.CRAWLER_MAX_REDIRECTS,
        userAgent: config.CRAWLER_USER_AGENT,
        timeoutMs: Math.min(config.CRAWLER_REQUEST_TIMEOUT_MS, settings['crawler.requestTimeoutMs']),

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

      // Representative deterministic sampling: homepage, category, product, article.
      // Failures are persisted per target and never fail the technical SEO audit.
      if (process.env.PERFORMANCE_ENABLED === 'true' && settings['performance.enabled']) {
        const maxPages = Math.min(4, Math.max(1, settings['performance.maxPages']), Math.max(1, Number(process.env.PERFORMANCE_MAX_PAGES || '4') || 4));
        const targets = selectPerformanceTargets(job.data.startUrl, persistedPages, maxPages);
        for (const target of targets) {
          for (const strategy of ['mobile', 'desktop'] as const) {
            let result;
            try {
              result = await measurePageSpeed(target.url, strategy, process.env.PAGESPEED_API_KEY);
            } catch (error) {
              result = failedMeasurement(target.url, strategy, error);
            }
            await db.performanceResult.upsert({
              where: { auditId_strategy_url: { auditId: job.data.auditId, strategy, url: target.url } },
              create: { auditId: job.data.auditId, strategy, pageType: target.pageType, url: target.url, status: result.status,
                measuredAt: new Date(result.measuredAt), lighthouseScore: result.lighthouseScore,
                metrics: JSON.parse(JSON.stringify(result)), error: result.error },
              update: { pageType: target.pageType, status: result.status, measuredAt: new Date(result.measuredAt),
                lighthouseScore: result.lighthouseScore, metrics: JSON.parse(JSON.stringify(result)), error: result.error },
            });
          }
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
      // Advisory AI is best-effort; failures never change a successful audit.
      try { await runAutomaticAi(job.data.auditId, job.data.projectId); }
      catch (error) { console.warn('automatic_ai_unavailable', error instanceof Error ? error.message : 'unknown'); }
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

// Retention policy: archive administrative activity after 30 days, never delete.
// Safe with multiple workers: updateMany only affects rows not already archived.
const archiveOldAdminEvents = async () => {
  try {
    const settings = await getApplicationSettings();
    if (!settings['activity.autoArchive']) return;
    const cutoff = new Date(Date.now() - settings['activity.retentionDays'] * 24 * 60 * 60 * 1000);
    const result = await db.dashboardAdminEvent.updateMany({
      where: { archivedAt: null, createdAt: { lt: cutoff } },
      data: { archivedAt: new Date() },
    });
    if (result.count) console.info('admin_activity_archived', { count: result.count });
  } catch (err) {
    console.error('admin_activity_archive_failed', err instanceof Error ? err.message : 'unknown');
  }
};
void archiveOldAdminEvents();
setInterval(() => void archiveOldAdminEvents(), 24 * 60 * 60 * 1000).unref();
