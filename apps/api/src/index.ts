import Fastify from 'fastify';
import { z } from 'zod';
import { db } from '@seo-auditor/database';
import { loadConfig } from '@seo-auditor/config';
import { makeAuditQueue } from '@seo-auditor/queue';
const app = Fastify({ logger: true });
const config = loadConfig();
const queue = makeAuditQueue(config.REDIS_URL);
app.get('/health', async () => ({ status: 'ok', version: '0.1.0' }));
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
app.get('/api/v1/audits/:auditId', async (req, reply) => {
  const p = z.object({ auditId: z.string() }).parse(req.params);
  const a = await db.audit.findUnique({
    where: { id: p.auditId },
    include: { _count: { select: { pages: true, issues: true } } },
  });
  return a ?? reply.code(404).send({ error: 'audit_not_found' });
});
await app.listen({ port: Number(process.env.API_PORT ?? 4000), host: '0.0.0.0' });
