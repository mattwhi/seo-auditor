import { Queue } from 'bullmq';
import type { CrawlJob } from '@seo-auditor/types';
export const AUDIT_QUEUE = 'audit-crawls';
export const makeAuditQueue = (redisUrl: string) =>
  new Queue<CrawlJob>(AUDIT_QUEUE, { connection: { url: redisUrl } });
