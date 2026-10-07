import Fastify from 'fastify';
import { z } from 'zod';
import { db } from '@seo-auditor/database';
import { loadConfig } from '@seo-auditor/config';
import { makeAuditQueue } from '@seo-auditor/queue';
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
    include: { _count: { select: { pages: true, issues: true } } },
    orderBy: { createdAt: 'desc' },
    take: 25,
  });
});
app.post('/api/v1/projects/:projectId/audits', async (req, reply) => {
  const p = z.object({ projectId: z.string() }).parse(req.params);
  const project = await db.project.findUnique({ where: { id: p.projectId } });
  if (!project) return reply.code(404).send({ error: 'project_not_found' });
  const audit = await db.audit.create({ data: { projectId: project.id } });
  await queue.add(
    'crawl',
    {
      auditId: audit.id,
      projectId: project.id,
      startUrl: project.baseUrl,
      maxUrls: config.CRAWLER_MAX_URLS,
    },
    { jobId: audit.id },
  );
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
    include: { _count: { select: { pages: true, issues: true } } },
  });
  return a ?? reply.code(404).send({ error: 'audit_not_found' });
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

await app.listen({ port: Number(process.env.API_PORT ?? 4000), host: '0.0.0.0' });
