import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const candidates = [resolve(root, 'packages/database/.env'), resolve(root, '.env'), resolve(root, 'apps/api/.env')];
if (!process.env.DATABASE_URL) {
  for (const path of candidates) {
    if (!existsSync(path)) continue;
    // Node's built-in parser handles quoted values and avoids shell evaluation.
    const { parseEnv } = await import('node:util');
    const url = parseEnv(readFileSync(path, 'utf8')).DATABASE_URL;
    if (url) { process.env.DATABASE_URL = url; break; }
  }
}
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is missing. Set it in the shell or in the repository root .env (see .env.example).');
  process.exit(1);
}
const child = spawn('pnpm', ['--filter', '@seo-auditor/database', 'exec', 'prisma', 'studio'], { cwd: root, stdio: 'inherit', env: process.env });
child.on('error', (err) => { console.error('Unable to start Prisma Studio:', err.message); process.exitCode = 1; });
child.on('exit', (code) => { process.exitCode = code ?? 1; });
