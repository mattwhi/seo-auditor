import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { mkdirSync, openSync, readFileSync, closeSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

/** Deployment secret, never an administrator-entered project credential.
 * For local single-host use, generate a durable 0600 key on first start.
 * Production web/API containers MUST mount the same persistent secret directory.
 * Preserve an existing WORDPRESS_CREDENTIAL_ENCRYPTION_KEY when upgrading.
 */
function encryptionKey(): Buffer {
  const fromEnvironment = process.env.WORDPRESS_CREDENTIAL_ENCRYPTION_KEY;
  if (fromEnvironment) {
    if (!/^[a-f0-9]{64}$/i.test(fromEnvironment)) throw new Error('wordpress_encryption_key_invalid');
    return Buffer.from(fromEnvironment, 'hex');
  }
  const location = resolve(process.env.SEO_AUDITOR_SECRET_DIR ?? resolve(process.cwd(), '../../.runtime/secrets'), 'wordpress-credential.key');
  try {
    const existing = readFileSync(location, 'utf8').trim();
    if (!/^[a-f0-9]{64}$/i.test(existing)) throw new Error('wordpress_encryption_key_invalid');
    return Buffer.from(existing, 'hex');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  mkdirSync(dirname(location), { recursive: true, mode: 0o700 });
  try {
    const fd = openSync(location, 'wx', 0o600);
    try { writeFileSync(fd, randomBytes(32).toString('hex')); }
    finally { closeSync(fd); }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
  }
  const value = readFileSync(location, 'utf8').trim();
  if (!/^[a-f0-9]{64}$/i.test(value)) throw new Error('wordpress_encryption_key_invalid');
  return Buffer.from(value, 'hex');
}
export function encryptWordPressPassword(password: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(password, 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64'), cipher.getAuthTag().toString('base64'), ciphertext.toString('base64')].join(':');
}
export function decryptWordPressPassword(value: string): string {
  const [version, ivString, tagString, ciphertextString] = value.split(':');
  if (version !== 'v1' || !ivString || !tagString || !ciphertextString) throw new Error('wordpress_credential_invalid');
  const iv = Buffer.from(ivString, 'base64'); const tag = Buffer.from(tagString, 'base64');
  if (iv.length !== 12 || tag.length !== 16) throw new Error('wordpress_credential_invalid');
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(Buffer.from(ciphertextString, 'base64')), decipher.final()]).toString('utf8');
}
