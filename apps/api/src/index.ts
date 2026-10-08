import Fastify from 'fastify';
import { z } from 'zod';
import { db } from '@seo-auditor/database';
import { loadConfig } from '@seo-auditor/config';
import { makeAuditQueue } from '@seo-auditor/queue';
import { compareAudits } from '@seo-auditor/comparison';
import { googleStatus, searchConsoleReport, analyticsReport } from './google.js';
import { discoverWordpress, remediationPreview, wordpressConnectionStatus, wordpressIssueMapping } from './wordpress.js';
const app = Fastify({ logger: true });
const config = loadConfig();
const queue = makeAuditQueue(config.REDIS_URL);
app.get('/health', async () => ({
  status: 'ok',
  version: process.env.npm_package_version ?? 'unknown',
}));
app.get('/ready', async (_req, reply) => {
  try {
    await db.$queryRaw`SELECT 1`;
    return { status: 'ready' };
  } catch {
    return reply.code(503).send({ status: 'not-ready' });
  }
});
// Google reports are read-only and explicitly disabled unless configured server-side.
// Do not expose this API publicly without authentication and access controls.
const googleDates = z.object({ startDate: z.iso.date(), endDate: z.iso.date() }).refine((v) => v.startDate <= v.endDate && (Date.parse(v.endDate) - Date.parse(v.startDate)) <= 366 * 24 * 60 * 60 * 1000, { message: 'invalid_date_range' });
async function googleProject(projectId: string) { return db.project.findUnique({ where: { id: projectId }, select: { baseUrl: true } }); }
app.get('/api/v1/projects/:projectId/google/status', async (req, reply) => {
  const { projectId } = z.object({ projectId: z.string() }).parse(req.params);
  const project = await googleProject(projectId);
  if (!project) return reply.code(404).send({ error: 'project_not_found' });
  try { return googleStatus(project.baseUrl); } catch { return reply.code(500).send({ error: 'google_configuration_invalid' }); }
});
for (const [kind, reporter] of [['search-console', searchConsoleReport], ['analytics', analyticsReport]] as const) {
  app.get(`/api/v1/projects/:projectId/google/${kind}`, async (req, reply) => {
    const { projectId } = z.object({ projectId: z.string() }).parse(req.params);
    const dates = googleDates.safeParse(req.query);
    if (!dates.success) return reply.code(400).send({ error: 'invalid_date_range' });
    const project = await googleProject(projectId);
    if (!project) return reply.code(404).send({ error: 'project_not_found' });
    try { return await reporter(project.baseUrl, dates.data.startDate, dates.data.endDate); }
    catch (error) {
      const code = error instanceof Error ? error.message : 'google_request_failed';
      req.log.warn({ code, kind }, 'Google integration request failed');
      return reply.code(code.includes('not_configured') || code.includes('disabled') ? 409 : 502).send({ error: code });
    }
  });
}
// v0.8: opt-in public WordPress discovery and draft-only remediation guidance.
// No write/approval endpoints until operator authentication and scoped permissions exist.
app.get('/api/v1/projects/:projectId/wordpress/status', async (req, reply) => {
  const { projectId } = z.object({ projectId: z.string().min(1) }).parse(req.params);
  const project = await googleProject(projectId);
  if (!project) return reply.code(404).send({ error: 'project_not_found' });
  try { return await discoverWordpress(project.baseUrl); }
  catch { return reply.code(409).send({ error: 'wordpress_configuration_invalid' }); }
});
app.get('/api/v1/projects/:projectId/wordpress/connection', async (req, reply) => {
  const { projectId } = z.object({ projectId: z.string().min(1) }).parse(req.params);
  const project = await googleProject(projectId);
  if (!project) return reply.code(404).send({ error: 'project_not_found' });
  try { return await wordpressConnectionStatus(project.baseUrl); }
  catch { return reply.code(409).send({ error: 'wordpress_connection_configuration_invalid' }); }
});
app.get('/api/v1/audits/:auditId/wordpress/issue-mapping', async (req, reply) => {
  const { auditId } = z.object({ auditId: z.string().min(1) }).parse(req.params);
  const parsed = z.object({ issueId: z.string().min(1) }).safeParse(req.query);
  if (!parsed.success) return reply.code(400).send({ error: 'invalid_issue_id' });
  const issue = await db.issue.findFirst({ where: { id: parsed.data.issueId, auditId }, include: { page: true, audit: { include: { project: true } } } });
  if (!issue) return reply.code(404).send({ error: 'issue_not_found' });
  if (!issue.page) return reply.code(409).send({ error: 'issue_has_no_page' });
  try { return { issueId: issue.id, ruleId: issue.ruleId, ...(await wordpressIssueMapping(issue.audit.project.baseUrl, issue.page.finalUrl)), executable: false }; }
  catch (error) {
    const code = error instanceof Error ? error.message : 'wordpress_mapping_failed';
    req.log.warn({ code }, 'WordPress read-only mapping failed');
    return reply.code(502).send({ error: code.startsWith('wordpress_') ? code : 'wordpress_mapping_failed' });
  }
});
app.get('/api/v1/audits/:auditId/wordpress/remediation-preview', async (req, reply) => {
  const { auditId } = z.object({ auditId: z.string().min(1) }).parse(req.params);
  const { issueId } = z.object({ issueId: z.string().min(1) }).parse(req.query);
  const issue = await db.issue.findFirst({ where: { id: issueId, auditId }, include: { page: true, audit: { include: { project: true } } } });
  if (!issue) return reply.code(404).send({ error: 'issue_not_found' });
  if (!issue.page) return reply.code(409).send({ error: 'issue_has_no_page' });
  try { return remediationPreview(issue.ruleId, issue.page.finalUrl, issue.audit.project.baseUrl); }
  catch { return reply.code(409).send({ error: 'issue_page_outside_project' }); }
});
app.post('/api/v1/projects', async (req, reply) => {
  const x = z.object({ name: z.string().min(1), baseUrl: z.string().url() }).safeParse(req.body);
  if (!x.success) return reply.code(400).send({ error: x.error.flatten() });
  return reply.code(201).send(await db.project.create({ data: x.data }));
});
app.get('/api/v1/projects', async () => db.project.findMany({ orderBy: { createdAt: 'desc' } }));
app.get('/api/v1/projects/:projectId/audits', async (req, reply) => {
  const p = z.object({ projectId: z.string().min(1) }).parse(req.params);
  const project = await db.project.findUnique({ where: { id: p.projectId }, select: { id: true } });
  if (!project) return reply.code(404).send({ error: 'project_not_found' });
  return db.audit.findMany({
    where: { projectId: p.projectId },
    include: { _count: { select: { pages: true, issues: true, crawlFailures: true } } },
    orderBy: { createdAt: 'desc' },
    take: 25,
  });
});
// Performance history is intentionally independent from the SEO score.
app.get('/api/v1/projects/:projectId/performance-history', async (req, reply) => {
  const { projectId } = z.object({ projectId: z.string().min(1) }).parse(req.params);
  const project = await db.project.findUnique({ where: { id: projectId }, select: { id: true } });
  if (!project) return reply.code(404).send({ error: 'project_not_found' });
  const audits = await db.audit.findMany({ where: { projectId, status: 'completed' }, orderBy: { createdAt: 'desc' }, take: 25, select: { id: true, createdAt: true, performanceResults: { select: { url: true, pageType: true, strategy: true, lighthouseScore: true, status: true } } } });
  return audits.map((audit) => ({ auditId: audit.id, createdAt: audit.createdAt, results: audit.performanceResults }));
});
app.post('/api/v1/projects/:projectId/audits', async (req, reply) => {
  const p = z.object({ projectId: z.string() }).parse(req.params);
  const project = await db.project.findUnique({ where: { id: p.projectId } });
  if (!project) return reply.code(404).send({ error: 'project_not_found' });
  const audit = await enqueueAudit(project.id, 'manual');
  return reply.code(202).send(audit);
});
const auditIdParams = z.object({ auditId: z.string().min(1) });
const pageIdParams = z.object({ pageId: z.string().min(1) });
const issueQuery = z.object({
  severity: z.enum(['critical', 'high', 'medium', 'low', 'info']).optional(),
  category: z
    .enum([
      'crawlability',
      'indexability',
      'metadata',
      'headings',
      'content',
      'images',
      'links',
      'schema',
      'performance',
    ])
    .optional(),
  ruleId: z.string().min(1).optional(),
  pageId: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});

app.get('/api/v1/audits/:auditId', async (req, reply) => {
  const p = auditIdParams.parse(req.params);
  const a = await db.audit.findUnique({
    where: { id: p.auditId },
    include: { _count: { select: { pages: true, issues: true, crawlFailures: true } } },
  });
  return a ?? reply.code(404).send({ error: 'audit_not_found' });
});

// v0.6 performance results: measured independently from the technical SEO score.
app.get('/api/v1/audits/:auditId/performance', async (req, reply) => {
  const { auditId } = auditIdParams.parse(req.params);
  const audit = await db.audit.findUnique({ where: { id: auditId }, select: { id: true } });
  if (!audit) return reply.code(404).send({ error: 'audit_not_found' });
  return db.performanceResult.findMany({ where: { auditId }, orderBy: [{ pageType: 'asc' }, { strategy: 'asc' }] });
});

app.get('/api/v1/audits/:auditId/compare/:baselineAuditId', async (req, reply) => {
  const params = z
    .object({ auditId: z.string().min(1), baselineAuditId: z.string().min(1) })
    .parse(req.params);

  if (params.auditId === params.baselineAuditId) {
    return reply.code(400).send({ error: 'audits_must_be_different' });
  }

  const audits = await db.audit.findMany({
    where: { id: { in: [params.auditId, params.baselineAuditId] } },
    select: {
      id: true,
      projectId: true,
      status: true,
      score: true,
      pages: { select: { url: true, finalUrl: true } },
      issues: {
        select: {
          ruleId: true,
          severity: true,
          category: true,
          message: true,
          evidence: true,
          page: { select: { url: true, finalUrl: true } },
        },
      },
    },
  });

  const current = audits.find((item) => item.id === params.auditId);
  const baseline = audits.find((item) => item.id === params.baselineAuditId);
  if (!current || !baseline) return reply.code(404).send({ error: 'audit_not_found' });
  if (current.projectId !== baseline.projectId) {
    return reply.code(400).send({ error: 'audits_must_belong_to_same_project' });
  }
  if (current.status !== 'completed' || baseline.status !== 'completed') {
    return reply.code(409).send({ error: 'audits_must_be_completed' });
  }

  return compareAudits(current, baseline);
});

app.get('/api/v1/audits/:auditId/issues', async (req, reply) => {
  const params = auditIdParams.parse(req.params);
  const query = issueQuery.parse(req.query);
  const audit = await db.audit.findUnique({ where: { id: params.auditId }, select: { id: true } });
  if (!audit) return reply.code(404).send({ error: 'audit_not_found' });

  const where = {
    auditId: params.auditId,
    ...(query.severity ? { severity: query.severity } : {}),
    ...(query.category ? { category: query.category } : {}),
    ...(query.ruleId ? { ruleId: query.ruleId } : {}),
    ...(query.pageId ? { pageId: query.pageId } : {}),
  };

  const [items, total] = await db.$transaction([
    db.issue.findMany({
      where,
      include: { page: { select: { url: true, finalUrl: true, statusCode: true } } },
      orderBy: [{ severity: 'asc' }, { ruleId: 'asc' }, { id: 'asc' }],
      take: query.limit,
      skip: query.offset,
    }),
    db.issue.count({ where }),
  ]);

  return { items, total, limit: query.limit, offset: query.offset };
});

app.get('/api/v1/audits/:auditId/issues/summary', async (req, reply) => {
  const params = auditIdParams.parse(req.params);

  const audit = await db.audit.findUnique({
    where: { id: params.auditId },
    select: { id: true },
  });

  if (!audit) {
    return reply.code(404).send({ error: 'audit_not_found' });
  }

  const issues = await db.issue.findMany({
    where: { auditId: params.auditId },
    select: {
      ruleId: true,
      severity: true,
      category: true,
    },
  });

  const bySeverity: Record<string, number> = {};
  const byCategory: Record<string, number> = {};

  const byRule = new Map<
    string,
    {
      ruleId: string;
      severity: string;
      category: string;
      count: number;
    }
  >();

  for (const issue of issues) {
    bySeverity[issue.severity] = (bySeverity[issue.severity] ?? 0) + 1;
    byCategory[issue.category] = (byCategory[issue.category] ?? 0) + 1;

    const key = `${issue.ruleId}:${issue.severity}:${issue.category}`;
    const existing = byRule.get(key);

    if (existing) {
      existing.count += 1;
    } else {
      byRule.set(key, {
        ruleId: issue.ruleId,
        severity: issue.severity,
        category: issue.category,
        count: 1,
      });
    }
  }

  return {
    total: issues.length,
    bySeverity,
    byCategory,
    byRule: Array.from(byRule.values()).sort((a, b) => {
      const ruleComparison = a.ruleId.localeCompare(b.ruleId);

      if (ruleComparison !== 0) {
        return ruleComparison;
      }

      const severityComparison = a.severity.localeCompare(b.severity);

      if (severityComparison !== 0) {
        return severityComparison;
      }

      return a.category.localeCompare(b.category);
    }),
  };
});

app.get('/api/v1/audits/:auditId/pages', async (req, reply) => {
  const params = auditIdParams.parse(req.params);
  const query = z
    .object({
      limit: z.coerce.number().int().min(1).max(500).default(100),
      offset: z.coerce.number().int().min(0).default(0),
    })
    .parse(req.query);
  const audit = await db.audit.findUnique({ where: { id: params.auditId }, select: { id: true } });
  if (!audit) return reply.code(404).send({ error: 'audit_not_found' });

  const where = { auditId: params.auditId };
  const [items, total] = await db.$transaction([
    db.page.findMany({
      where,
      include: { _count: { select: { issues: true } } },
      orderBy: [{ crawlDepth: 'asc' }, { url: 'asc' }],
      take: query.limit,
      skip: query.offset,
    }),
    db.page.count({ where }),
  ]);

  return { items, total, limit: query.limit, offset: query.offset };
});

app.get('/api/v1/audits/:auditId/failures', async (req, reply) => {
  const params = auditIdParams.parse(req.params);
  const query = z
    .object({
      limit: z.coerce.number().int().min(1).max(500).default(100),
      offset: z.coerce.number().int().min(0).default(0),
    })
    .parse(req.query);
  const audit = await db.audit.findUnique({ where: { id: params.auditId }, select: { id: true } });
  if (!audit) return reply.code(404).send({ error: 'audit_not_found' });

  const where = { auditId: params.auditId };
  const [items, total] = await db.$transaction([
    db.crawlFailure.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      take: query.limit,
      skip: query.offset,
    }),
    db.crawlFailure.count({ where }),
  ]);

  return { items, total, limit: query.limit, offset: query.offset };
});

app.get('/api/v1/pages/:pageId/issues', async (req, reply) => {
  const params = pageIdParams.parse(req.params);
  const page = await db.page.findUnique({
    where: { id: params.pageId },
    select: { id: true, auditId: true, url: true, finalUrl: true },
  });
  if (!page) return reply.code(404).send({ error: 'page_not_found' });

  const issues = await db.issue.findMany({
    where: { pageId: page.id },
    orderBy: [{ severity: 'asc' }, { ruleId: 'asc' }, { id: 'asc' }],
  });
  return { page, issues };
});


const projectIdParams = z.object({ projectId: z.string().min(1) });

function nextScheduleRun(frequency: string, hourUtc: number, dayOfWeek?: number | null, dayOfMonth?: number | null, from = new Date()) {
  const next = new Date(from);
  next.setUTCMinutes(0, 0, 0);
  next.setUTCHours(hourUtc);
  if (next <= from) next.setUTCDate(next.getUTCDate() + 1);
  if (frequency === 'weekly') {
    const target = dayOfWeek ?? 1;
    while (next.getUTCDay() !== target) next.setUTCDate(next.getUTCDate() + 1);
  } else if (frequency === 'monthly') {
    const target = Math.min(28, Math.max(1, dayOfMonth ?? 1));
    next.setUTCDate(target);
    if (next <= from) next.setUTCMonth(next.getUTCMonth() + 1);
  }
  return next;
}

async function enqueueAudit(projectId: string, trigger: 'manual' | 'scheduled' = 'manual') {
  const project = await db.project.findUnique({ where: { id: projectId } });
  if (!project) return null;
  const active = await db.audit.findFirst({ where: { projectId, status: { in: ['queued', 'running'] } } });
  if (active) return active;
  const audit = await db.audit.create({ data: { projectId, trigger } });
  await queue.add('crawl', { auditId: audit.id, projectId, startUrl: project.baseUrl, maxUrls: config.CRAWLER_MAX_URLS }, { jobId: audit.id });
  return audit;
}

app.get('/api/v1/projects/:projectId/platform', async (req, reply) => {
  const { projectId } = projectIdParams.parse(req.params);
  const project = await db.project.findUnique({ where: { id: projectId }, include: { schedule: true } });
  if (!project) return reply.code(404).send({ error: 'project_not_found' });
  const audits = await db.audit.findMany({ where: { projectId, status: 'completed' }, orderBy: { createdAt: 'desc' }, take: 30, include: { _count: { select: { pages: true, issues: true, crawlFailures: true } } } });
  const latest = audits[0] ?? null;
  const previous = audits[1] ?? null;
  let regression = null;
  if (latest && previous) {
    const load = (id: string) => db.audit.findUniqueOrThrow({ where: { id }, select: { id:true, projectId:true, status:true, score:true, pages:{select:{url:true,finalUrl:true}}, issues:{select:{ruleId:true,severity:true,category:true,message:true,evidence:true,page:{select:{url:true,finalUrl:true}}}} } });
    regression = compareAudits(await load(latest.id), await load(previous.id));
  }
  return { project, schedule: project.schedule, audits, latest, previous, regression };
});

app.put('/api/v1/projects/:projectId/schedule', async (req, reply) => {
  const { projectId } = projectIdParams.parse(req.params);
  const body = z.object({ enabled: z.boolean(), frequency: z.enum(['daily','weekly','monthly']), hourUtc: z.number().int().min(0).max(23), dayOfWeek: z.number().int().min(0).max(6).nullable().optional(), dayOfMonth: z.number().int().min(1).max(28).nullable().optional() }).parse(req.body);
  const project = await db.project.findUnique({ where: { id: projectId } });
  if (!project) return reply.code(404).send({ error: 'project_not_found' });
  const nextRunAt = body.enabled ? nextScheduleRun(body.frequency, body.hourUtc, body.dayOfWeek, body.dayOfMonth) : null;
  return db.auditSchedule.upsert({ where: { projectId }, create: { projectId, ...body, nextRunAt }, update: { ...body, nextRunAt } });
});

app.patch('/api/v1/projects/:projectId', async (req, reply) => {
  const { projectId } = projectIdParams.parse(req.params);
  const body = z.object({ retentionDays: z.number().int().min(7).max(3650) }).parse(req.body);
  try { return await db.project.update({ where: { id: projectId }, data: body }); } catch { return reply.code(404).send({ error: 'project_not_found' }); }
});

app.delete('/api/v1/projects/:projectId', async (req, reply) => {
  const { projectId } = projectIdParams.parse(req.params);
  try { await db.project.delete({ where: { id: projectId } }); return reply.code(204).send(); } catch { return reply.code(404).send({ error: 'project_not_found' }); }
});

app.post('/api/v1/audits/:auditId/cancel', async (req, reply) => {
  const { auditId } = auditIdParams.parse(req.params);
  const audit = await db.audit.findUnique({ where: { id: auditId } });
  if (!audit) return reply.code(404).send({ error: 'audit_not_found' });
  if (!['queued','running'].includes(audit.status)) return reply.code(409).send({ error: 'audit_not_active' });
  if (audit.status === 'queued') {
    const job = await queue.getJob(auditId); await job?.remove();
    return db.audit.update({ where: { id: auditId }, data: { status: 'cancelled', cancelRequested: true, completedAt: new Date() } });
  }
  return db.audit.update({ where: { id: auditId }, data: { cancelRequested: true } });
});

app.delete('/api/v1/audits/:auditId', async (req, reply) => {
  const { auditId } = auditIdParams.parse(req.params);
  const audit = await db.audit.findUnique({ where: { id: auditId } });
  if (!audit) return reply.code(404).send({ error: 'audit_not_found' });
  if (['queued','running'].includes(audit.status)) return reply.code(409).send({ error: 'cannot_delete_active_audit' });
  await db.audit.delete({ where: { id: auditId } }); return reply.code(204).send();
});

async function runPlatformMaintenance() {
  const now = new Date();
  const due = await db.auditSchedule.findMany({ where: { enabled: true, nextRunAt: { lte: now } }, include: { project: true } });
  for (const schedule of due) {
    await enqueueAudit(schedule.projectId, 'scheduled');
    await db.auditSchedule.update({ where: { id: schedule.id }, data: { lastRunAt: now, nextRunAt: nextScheduleRun(schedule.frequency, schedule.hourUtc, schedule.dayOfWeek, schedule.dayOfMonth, now) } });
  }
  const staleCutoff = new Date(now.getTime() - 6 * 60 * 60 * 1000);
  await db.audit.updateMany({ where: { status: 'running', startedAt: { lt: staleCutoff } }, data: { status: 'failed', completedAt: now } });
  const projects = await db.project.findMany({ select: { id: true, retentionDays: true } });
  for (const project of projects) {
    const cutoff = new Date(now.getTime() - project.retentionDays * 86400000);
    await db.audit.deleteMany({ where: { projectId: project.id, createdAt: { lt: cutoff }, status: { notIn: ['queued','running'] } } });
  }
}

setInterval(() => runPlatformMaintenance().catch((error) => app.log.error(error)), 60_000).unref();
runPlatformMaintenance().catch((error) => app.log.error(error));

await app.listen({ port: Number(process.env.API_PORT ?? 4000), host: '0.0.0.0' });
