import { randomBytes, scrypt as scryptCallback } from 'node:crypto';
import { promisify } from 'node:util';
import { Pool } from 'pg';

const scrypt = promisify(scryptCallback);
const KEY_LENGTH = 64;

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const derived = (await scrypt(password, salt, KEY_LENGTH)) as Buffer;
  return `scrypt$${salt}$${derived.toString('hex')}`;
}

async function main() {
  const connectionString = process.env.MIGRATION_DATABASE_URL;
  if (!connectionString) throw new Error('MIGRATION_DATABASE_URL is required');

  const email = (process.env.STAGING_TEST_EMAIL ?? 'm0-auth-e2e@panda.local').toLowerCase().trim();
  const password = process.env.STAGING_TEST_PASSWORD;
  if (!password || password.length < 16) {
    throw new Error('STAGING_TEST_PASSWORD must be provided and contain at least 16 characters');
  }

  const passwordHash = await hashPassword(password);
  const pool = new Pool({ connectionString, max: 1 });
  try {
    await pool.query(
      `INSERT INTO users (email, name, password_hash, password_changed_at)
       VALUES ($1, 'M0 Auth E2E', $2, now())
       ON CONFLICT (email) DO UPDATE
       SET name = EXCLUDED.name,
           password_hash = EXCLUDED.password_hash,
           password_changed_at = now()`,
      [email, passwordHash],
    );
    console.log(`staging auth user: READY (${email})`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
