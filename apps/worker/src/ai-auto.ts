import { createHash } from 'node:crypto';
import { db } from '@seo-auditor/database';
import { aiConfigured, analysePage, configuredModel } from '@seo-auditor/ai';

// Only run after a completed audit, never during crawl persistence.
// Automatic analysis is disabled unless explicitly opted in per project.
export async function runAutomaticAi(auditId: string, projectId: string): Promise<void> {
  if (!aiConfigured()) return;
  const policy = await db.projectAiSettings.findUnique({ where: { projectId } });
  if (!policy?.enabled || policy.mode !== 'automatic') return;
  const pages = await db.page.findMany({ where: { auditId }, include: { issues: true },
    orderBy: [{ crawlDepth: 'asc' }, { id: 'asc' }], take: Math.min(10, Math.max(1, policy.maxPagesPerAudit)) });
  for (const page of pages) {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const used = await db.aiAnalysis.count({ where: { projectId, createdAt: { gte: since } } });
    if (used >= policy.maxAnalysesPerDay) break;
    const contentFingerprint = createHash('sha256').update(JSON.stringify([page.contentHash, page.title, page.metaDescription, page.h1, page.h2, page.issues.map(i => [i.ruleId,i.message])])).digest('hex');
    const exists = await db.aiAnalysis.findFirst({ where: { pageId: page.id, contentFingerprint, status: { in: ['running','completed'] } } });
    if (exists) continue;
    const model = configuredModel();
    const record = await db.aiAnalysis.create({ data: { projectId, auditId, pageId: page.id, contentFingerprint, model, trigger: 'automatic' } });
    try {
      const generated = await analysePage({ url: page.finalUrl, title: page.title, metaDescription: page.metaDescription, canonical: page.canonical, h1: page.h1, h2: page.h2, wordCount: page.wordCount, robots: page.robots, statusCode: page.statusCode, images: page.images, outgoingLinks: page.outgoingLinks, issues: page.issues.map(i => ({ ruleId: i.ruleId, severity: i.severity, message: i.message, evidence: i.evidence })) }, model);
      await db.aiAnalysis.update({ where: { id: record.id }, data: { status: 'completed', summary: generated.result.summary, recommendations: generated.result.recommendations, inputTokens: generated.inputTokens, outputTokens: generated.outputTokens, completedAt: new Date() } });
    } catch (error) {
      const code = error instanceof Error ? error.message : 'ai_analysis_failed';
      await db.aiAnalysis.update({ where: { id: record.id }, data: { status: 'failed', errorCode: /^openai_http_\d+$/.test(code) ? code : 'ai_analysis_failed', completedAt: new Date() } });
      console.warn('automatic_ai_analysis_failed', { auditId, pageId: page.id });
      // Stop on errors to avoid repeated chargeable calls.
      break;
    }
  }
}
