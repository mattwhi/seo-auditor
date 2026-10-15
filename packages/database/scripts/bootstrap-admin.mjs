import { PrismaClient } from '@prisma/client';
import { randomBytes, scryptSync } from 'node:crypto';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
if (!stdin.isTTY) throw Error('Bootstrap requires an interactive terminal');
const db = new PrismaClient();
const rl = createInterface({ input: stdin, output: stdout });
try {
  if (await db.dashboardUser.count() !== 0) throw Error('Bootstrap disabled: users already exist');
  const email = (await rl.question('First administrator email: ')).trim().toLowerCase();
  const password = await rl.question('Initial password (input visible; run only in a private terminal): ');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 12) throw Error('Invalid email or password too short');
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, Buffer.from(salt, 'hex'), 64).toString('hex');
  await db.dashboardUser.create({ data: { email, passwordHash: `scrypt:${salt}:${hash}`, role: 'ADMIN' } });
  console.log('First administrator created');
} finally { rl.close(); await db.$disconnect(); }
