import { PrismaClient } from '@prisma/client';
import { randomBytes, scryptSync } from 'node:crypto';
import { createInterface } from 'node:readline';
import { stdin, stdout } from 'node:process';

if (!stdin.isTTY || !stdout.isTTY) throw new Error('Run this command in a private interactive terminal.');
const db = new PrismaClient();
const rl = createInterface({ input: stdin, output: stdout, terminal: true });
function ask(prompt, hidden = false) {
  return new Promise((resolve) => {
    if (!hidden) return rl.question(prompt, resolve);
    stdout.write(prompt);
    let value = '';
    const onData = (char) => {
      const text = String(char);
      if (text === '\r' || text === '\n') { stdout.write('\n'); stdin.off('data', onData); stdin.setRawMode(false); resolve(value); }
      else if (text === '\u0003') { stdin.setRawMode(false); stdout.write('\n'); process.exit(130); }
      else if (text === '\u007f' || text === '\b') value = value.slice(0, -1);
      else if (text >= ' ' && text !== '\u007f') value += text;
    };
    stdin.setRawMode(true);
    stdin.on('data', onData);
  });
}
try {
  const email = (await ask('Existing administrator email: ')).trim().toLowerCase();
  const user = await db.dashboardUser.findUnique({ where: { email } });
  if (!user || user.role !== 'ADMIN' || user.disabled) throw new Error('No active administrator found for that email.');
  const password = await ask('New password (hidden): ', true);
  const confirmation = await ask('Confirm password (hidden): ', true);
  if (password.length < 12 || password.length > 1024 || password !== confirmation) throw new Error('Passwords must match and contain 12–1024 characters.');
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, Buffer.from(salt, 'hex'), 64).toString('hex');
  await db.$transaction(async (tx) => {
    await tx.dashboardUser.update({ where: { id: user.id }, data: { passwordHash: `scrypt:${salt}:${hash}` } });
    await tx.dashboardSession.deleteMany({ where: { userId: user.id } });
  });
  stdout.write('Administrator password updated. Existing sessions revoked.\n');
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Password reset failed');
  process.exitCode = 1;
} finally {
  rl.close();
  await db.$disconnect();
}
