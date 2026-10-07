import { z } from 'zod';
const schema = z.object({
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  CRAWLER_USER_AGENT: z.string().default('OpenSEOAuditorBot/0.1'),
  CRAWLER_CONCURRENCY: z.coerce.number().int().positive().default(4),
  CRAWLER_MAX_URLS: z.coerce.number().int().positive().default(500),
  CRAWLER_REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(15000),
});
export const loadConfig = () => schema.parse(process.env);
