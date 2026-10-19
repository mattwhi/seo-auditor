import type { FastifyInstance } from 'fastify';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { db } from '@seo-auditor/database';
import { aiConfigured, analysePage, configuredModel, analysisSchema, suggestIssueFix } from '@seo-auditor/ai';
import { wordpressConfigForProject, wordpressIssueMapping } from './wordpress.js';

const ids = z.object({ projectId: z.string().min(8).max(64) });
const analysisRequest = z.object({ auditId: z.string().min(8), pageId: z.string().min(8) }).strict();
const policyInput = z.object({ enabled: z.boolean(), mode: z.enum(['manual','automatic']), maxPagesPerAudit: z.number().int().min(1).max(10), maxAnalysesPerDay: z.number().int().min(1).max(100) }).strict();
const defaults = { enabled: false, mode: 'manual', maxPagesPerAudit: 3, maxAnalysesPerDay: 20 };
const issueFixUsage = new Map<string,{start:number;count:number}>();
export function registerAiRoutes(app: FastifyInstance, operatorAuthorized: (auth: string | undefined) => Promise<boolean>, reviewerActor: (auth: string | undefined) => Promise<{ id: string; role: string } | null>) {
  app.get('/api/v1/projects/:projectId/ai/settings', async (req, reply) => {
    if (!(await operatorAuthorized(req.headers.authorization))) return reply.code(401).send({ error: 'operator_unauthorized' });
    const parsed = ids.safeParse(req.params);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_project' });
    const project = await db.project.findUnique({ where: { id: parsed.data.projectId }, select: { id: true } });
    if (!project) return reply.code(404).send({ error: 'project_not_found' });
    const policy = await db.projectAiSettings.findUnique({ where: { projectId: project.id } });
    return { ...defaults, ...policy, configured: aiConfigured(), model: configuredModel() };
  });
  app.put('/api/v1/projects/:projectId/ai/settings', async (req, reply) => {
    if (!(await operatorAuthorized(req.headers.authorization))) return reply.code(401).send({ error: 'operator_unauthorized' });
    const params = ids.safeParse(req.params), body = policyInput.safeParse(req.body);
    if (!params.success || !body.success) return reply.code(400).send({ error: 'invalid_ai_settings' });
    if (!(await db.project.findUnique({ where: { id: params.data.projectId } }))) return reply.code(404).send({ error: 'project_not_found' });
    return db.projectAiSettings.upsert({ where: { projectId: params.data.projectId }, create: { projectId: params.data.projectId, ...body.data }, update: body.data });
  });
  app.get('/api/v1/projects/:projectId/ai/analyses', async (req, reply) => {
    if (!(await operatorAuthorized(req.headers.authorization))) return reply.code(401).send({ error: 'operator_unauthorized' });
    const params = ids.safeParse(req.params);
    const query = z.object({ auditId: z.string().min(8).optional() }).safeParse(req.query);
    if (!params.success || !query.success) return reply.code(400).send({ error: 'invalid_request' });
    return db.aiAnalysis.findMany({ where: { projectId: params.data.projectId, ...(query.data.auditId ? { auditId: query.data.auditId } : {}) }, orderBy: { createdAt: 'desc' }, take: 50 });
  });
  // Reviews are separate from WordPress proposals: approval never writes to a website.
  app.get('/api/v1/projects/:projectId/ai/reviews', async (req, reply) => {
    if (!(await operatorAuthorized(req.headers.authorization))) return reply.code(401).send({ error: 'operator_unauthorized' });
    const params = ids.safeParse(req.params);
    const query = z.object({ analysisId: z.string().min(8).max(64) }).safeParse(req.query);
    if (!params.success || !query.success) return reply.code(400).send({ error: 'invalid_request' });
    const analysis = await db.aiAnalysis.findFirst({ where: { id: query.data.analysisId, projectId: params.data.projectId, status: 'completed' } });
    if (!analysis) return reply.code(404).send({ error: 'analysis_not_found' });
    const parsed = analysisSchema.safeParse({ summary: analysis.summary, recommendations: analysis.recommendations });
    if (!parsed.success) return reply.code(409).send({ error: 'invalid_saved_recommendations' });
    // Idempotent materialisation, including for analyses generated before v0.9.2.
    await db.aiRemediationReview.createMany({
      data: parsed.data.recommendations.map((r, suggestionIndex) => ({
        analysisId: analysis.id, projectId: params.data.projectId, suggestionIndex,
        ruleId: r.ruleId, field: r.field, priority: r.priority,
        currentValue: r.currentValue, proposedValue: r.proposedValue,
        explanation: r.explanation, evidence: r.evidence,
      })), skipDuplicates: true,
    });
    return db.aiRemediationReview.findMany({ where: { analysisId: analysis.id, projectId: params.data.projectId }, orderBy: { suggestionIndex: 'asc' } });
  });
  app.patch('/api/v1/projects/:projectId/ai/reviews/:reviewId', async (req, reply) => {
    if (!(await operatorAuthorized(req.headers.authorization))) return reply.code(401).send({ error: 'operator_unauthorized' });
    const params = z.object({ projectId: z.string().min(8).max(64), reviewId: z.string().min(8).max(64) }).safeParse(req.params);
    const body = z.discriminatedUnion('action', [
      z.object({ action: z.literal('edit'), proposedValue: z.string().trim().min(1).max(2000) }).strict(),
      z.object({ action: z.literal('approve') }).strict(),
      z.object({ action: z.literal('reject') }).strict(),
    ]).safeParse(req.body);
    if (!params.success || !body.success) return reply.code(400).send({ error: 'invalid_review_action' });
    const review = await db.aiRemediationReview.findFirst({ where: { id: params.data.reviewId, projectId: params.data.projectId }, include: { analysis: { include: { page: true } } } });
    if (!review) return reply.code(404).send({ error: 'review_not_found' });
    if (review.status !== 'pending') return reply.code(409).send({ error: 'review_already_decided' });
    if (body.data.action === 'approve') {
      // Compare the stored crawl snapshot; never trust the model's "current" value.
      const page = review.analysis.page;
      const actual = review.field === 'title' ? page.title ?? '' :
        review.field === 'metaDescription' ? page.metaDescription ?? '' :
        review.field === 'h1' ? page.h1.join(' | ') : null;
      if (actual === null) return reply.code(409).send({ error: 'field_requires_manual_remediation' });
      if (actual !== review.currentValue) return reply.code(409).send({ error: 'ai_current_value_mismatch', actualValue: actual });
      if (!review.proposedValue.trim() || review.proposedValue === actual) return reply.code(409).send({ error: 'invalid_proposed_value' });
    }
    const actor = await reviewerActor(req.headers.authorization);
    if (!actor || actor.role !== 'ADMIN') return reply.code(401).send({ error: 'operator_unauthorized' });
    const update = body.data.action === 'edit'
      ? { proposedValue: body.data.proposedValue }
      : { status: body.data.action === 'approve' ? 'approved' : 'rejected', reviewedAt: new Date(), reviewerId: actor.id };
    const result = await db.aiRemediationReview.updateMany({ where: { id: review.id, projectId: params.data.projectId, status: 'pending' }, data: update });
    if (result.count !== 1) return reply.code(409).send({ error: 'review_already_decided' });
    return db.aiRemediationReview.findUnique({ where: { id: review.id } });
  });
  // An approved AI review can create a DRAFT proposal only after independently
  // resolving the audit issue and WordPress target. Never execute or publish here.
  app.post('/api/v1/projects/:projectId/ai/reviews/:reviewId/proposal', async (req, reply) => {
    const actor = await reviewerActor(req.headers.authorization);
    if (!actor || actor.role !== 'ADMIN') return reply.code(401).send({ error: 'operator_unauthorized' });
    const params = z.object({ projectId: z.string().min(8).max(64), reviewId: z.string().min(8).max(64) }).safeParse(req.params);
    if (!params.success || (req.body !== undefined && (typeof req.body !== 'object' || req.body === null || Object.keys(req.body).length)))
      return reply.code(400).send({ error: 'invalid_proposal_request' });
    const review = await db.aiRemediationReview.findFirst({
      where: { id: params.data.reviewId, projectId: params.data.projectId },
      include: { analysis: { include: { page: true, audit: true, project: true } } },
    });
    if (!review) return reply.code(404).send({ error: 'review_not_found' });
    if (review.status !== 'approved') return reply.code(409).send({ error: 'review_not_approved' });
    const allowed: Record<string, string[]> = {
      title: ['title.missing', 'title.too-short', 'title.too-long'],
      metaDescription: ['description.missing', 'description.too-short', 'description.too-long'],
    };
    const rules = allowed[review.field];
    if (!rules || !rules.includes(review.ruleId)) return reply.code(409).send({ error: 'unsupported_ai_remediation' });
    const analysis = review.analysis;
    const page = analysis.page;
    if (analysis.audit.status !== 'completed' || page.auditId !== analysis.auditId)
      return reply.code(409).send({ error: 'audit_not_completed' });
    const actual = review.field === 'title' ? page.title ?? '' : page.metaDescription ?? '';
    if (actual !== review.currentValue) return reply.code(409).send({ error: 'crawl_snapshot_mismatch' });
    if (!review.proposedValue.trim() || review.proposedValue.length > 500 || review.proposedValue === actual)
      return reply.code(409).send({ error: 'invalid_proposed_value' });
    const issue = await db.issue.findFirst({ where: { auditId: analysis.auditId, pageId: page.id, ruleId: review.ruleId } });
    if (!issue) return reply.code(409).send({ error: 'matching_audit_issue_not_found' });
    try {
      if (!(await wordpressConfigForProject(analysis.project.baseUrl)))
        return reply.code(409).send({ error: 'wordpress_not_enabled' });
    } catch { return reply.code(409).send({ error: 'wordpress_configuration_invalid' }); }
    let mapping;
    try { mapping = await wordpressIssueMapping(analysis.project.baseUrl, page.finalUrl); }
    catch { return reply.code(502).send({ error: 'wordpress_mapping_failed' }); }
    const targets = mapping.matches.filter(m => ['posts', 'pages', 'product'].includes(m.type));
    if (mapping.status !== 'matched' || targets.length !== 1)
      return reply.code(409).send({ error: 'wordpress_target_requires_manual_selection' });
    const target = targets[0];
    if (!target) return reply.code(409).send({ error: 'wordpress_target_requires_manual_selection' });
    const existing = await db.remediationProposal.findFirst({ where: {
      projectId: params.data.projectId, auditId: analysis.auditId, issueId: issue.id,
      targetType: target.type, targetId: target.id, proposedText: review.proposedValue,
      status: { not: 'rejected' },
    } });
    if (existing) return { ...existing, alreadyExists: true, executable: false };
    const proposal = await db.remediationProposal.create({ data: {
      projectId: params.data.projectId, auditId: analysis.auditId, issueId: issue.id,
      pageUrl: page.finalUrl, ruleId: issue.ruleId, targetType: target.type,
      targetId: target.id, proposedText: review.proposedValue, status: 'draft',
    } });
    return reply.code(201).send({ ...proposal, executable: false });
  });
  app.get('/api/v1/projects/:projectId/ai/issue-context',async(req,reply)=>{
    if(!(await operatorAuthorized(req.headers.authorization)))return reply.code(401).send({error:'operator_unauthorized'});
    const params=ids.safeParse(req.params),query=z.object({auditId:z.string().min(8).max(64),issueId:z.string().min(8).max(64)}).safeParse(req.query);
    if(!params.success||!query.success)return reply.code(400).send({error:'invalid_request'});
    const issue=await db.issue.findFirst({where:{id:query.data.issueId,auditId:query.data.auditId,audit:{projectId:params.data.projectId,status:'completed'}},include:{page:true}});
    if(!issue?.page||!['title.missing','title.too-short','title.too-long','description.missing','description.too-short','description.too-long'].includes(issue.ruleId))return reply.code(404).send({error:'unsupported_issue_or_page'});
    return {ruleId:issue.ruleId,currentValue:issue.ruleId.startsWith('title.')?issue.page.title??'':issue.page.metaDescription??'',url:issue.page.finalUrl,source:'stored_audit'};
  });
  app.post('/api/v1/projects/:projectId/ai/suggest-fix',async(req,reply)=>{
    if(!(await operatorAuthorized(req.headers.authorization)))return reply.code(401).send({error:'operator_unauthorized'});
    const params=ids.safeParse(req.params);
    const body=z.object({auditId:z.string().min(8).max(64),issueId:z.string().min(8).max(64),previousSuggestions:z.array(z.string().max(500)).max(5).default([])}).strict().safeParse(req.body);
    if(!params.success||!body.success)return reply.code(400).send({error:'invalid_request'});
    if(!aiConfigured())return reply.code(409).send({error:'openai_not_configured'});
    const policy=await db.projectAiSettings.findUnique({where:{projectId:params.data.projectId}});
    if(!policy?.enabled)return reply.code(409).send({error:'ai_disabled_for_project'});
    const issue=await db.issue.findFirst({where:{id:body.data.issueId,auditId:body.data.auditId,audit:{projectId:params.data.projectId,status:'completed'}},include:{page:true}});
    if(!issue?.page||!['title.missing','title.too-short','title.too-long','description.missing','description.too-short','description.too-long'].includes(issue.ruleId))return reply.code(404).send({error:'unsupported_issue_or_page'});
    // In-process limit: per API instance; production should use a shared Redis quota.
    const now=Date.now(),bucket=`${params.data.projectId}:issue-fix`;
    const usage=issueFixUsage.get(bucket)??{start:now,count:0};
    if(now-usage.start>=86400000){usage.start=now;usage.count=0;}
    if(usage.count>=policy.maxAnalysesPerDay)return reply.code(429).send({error:'ai_daily_limit_reached'});
    usage.count++;issueFixUsage.set(bucket,usage);
    const page=issue.page,currentValue=issue.ruleId.startsWith('title.')?page.title??'':page.metaDescription??'';
    try{
      const suggestion=await suggestIssueFix({url:page.finalUrl,ruleId:issue.ruleId,currentValue,title:page.title,metaDescription:page.metaDescription,h1:page.h1,h2:page.h2,wordCount:page.wordCount,issueMessage:issue.message,issueEvidence:issue.evidence,previousSuggestions:body.data.previousSuggestions});
      return {...suggestion,currentValue,ruleId:issue.ruleId,source:'stored_audit'};
    }catch(err){const message=err instanceof Error?err.message:'';const code=/^openai_http_\d+$/.test(message)||['openai_incomplete_response','openai_empty_response','ai_duplicate_suggestion'].includes(message)?message:'ai_suggestion_failed';req.log.warn({code},'Issue suggestion failed');return reply.code(502).send({error:code});}
  });
  app.post('/api/v1/projects/:projectId/ai/analyse', async (req, reply) => {
    if (!(await operatorAuthorized(req.headers.authorization))) return reply.code(401).send({ error: 'operator_unauthorized' });
    const params = ids.safeParse(req.params), body = analysisRequest.safeParse(req.body);
    if (!params.success || !body.success) return reply.code(400).send({ error: 'invalid_request' });
    if (!aiConfigured()) return reply.code(409).send({ error: 'openai_not_configured' });
    const projectId = params.data.projectId;
    const policy = await db.projectAiSettings.findUnique({ where: { projectId } });
    if (!policy?.enabled) return reply.code(409).send({ error: 'ai_disabled_for_project' });
    const page = await db.page.findFirst({ where: { id: body.data.pageId, auditId: body.data.auditId, audit: { projectId, status: 'completed' } }, include: { issues: true } });
    if (!page) return reply.code(404).send({ error: 'page_not_found_or_audit_incomplete' });
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const count = await db.aiAnalysis.count({ where: { projectId, createdAt: { gte: since } } });
    if (count >= policy.maxAnalysesPerDay) return reply.code(429).send({ error: 'ai_daily_limit_reached' });
    const fingerprint = createHash('sha256').update(JSON.stringify([page.contentHash, page.title, page.metaDescription, page.h1, page.h2, page.issues.map(i => [i.ruleId, i.message])])).digest('hex');
    const existing = await db.aiAnalysis.findFirst({ where: { pageId: page.id, contentFingerprint: fingerprint, status: 'completed' }, orderBy: { createdAt: 'desc' } });
    if (existing) return { ...existing, cached: true };
    const running = await db.aiAnalysis.findFirst({ where: { pageId: page.id, status: 'running', createdAt: { gte: new Date(Date.now()-60000) } } });
    if (running) return reply.code(409).send({ error: 'analysis_already_running' });
    const model = configuredModel();
    const record = await db.aiAnalysis.create({ data: { projectId, auditId: page.auditId, pageId: page.id, contentFingerprint: fingerprint, model, trigger: 'manual' } });
    try {
      const generated = await analysePage({ url: page.finalUrl, title: page.title, metaDescription: page.metaDescription, canonical: page.canonical, h1: page.h1, h2: page.h2, wordCount: page.wordCount, robots: page.robots, statusCode: page.statusCode, images: page.images, outgoingLinks: page.outgoingLinks, issues: page.issues.map(i => ({ ruleId: i.ruleId, severity: i.severity, message: i.message, evidence: i.evidence })) }, model);
      return await db.aiAnalysis.update({ where: { id: record.id }, data: { status: 'completed', summary: generated.result.summary, recommendations: generated.result.recommendations, inputTokens: generated.inputTokens, outputTokens: generated.outputTokens, completedAt: new Date() } });
    } catch (error) {
      const code = error instanceof Error ? error.message : 'ai_analysis_failed';
      const safeCode = /^openai_http_\d+$/.test(code) || ['openai_incomplete_response','openai_empty_response','openai_not_configured'].includes(code) ? code : 'ai_analysis_failed';
      await db.aiAnalysis.update({ where: { id: record.id }, data: { status: 'failed', errorCode: safeCode, completedAt: new Date() } });
      req.log.warn({ code: safeCode }, 'AI analysis failed');
      return reply.code(502).send({ error: safeCode });
    }
  });
}
