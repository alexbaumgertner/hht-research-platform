/**
 * Ensures Payload Postgres tables exist before `next build`.
 * Payload only auto-pushes schema when NODE_ENV !== 'production', so this
 * script forces a one-shot push using the deployment DATABASE_URL.
 */
import { randomUUID } from 'node:crypto';
import { unlink } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

process.env.NODE_ENV = 'development';

if (!process.env.DATABASE_URL) {
  console.error('ensure-schema: DATABASE_URL is required');
  process.exit(1);
}

// Ephemeral secret for schema push only — never serves traffic.
process.env.PAYLOAD_SECRET ||= randomUUID();

const dirname = path.dirname(fileURLToPath(import.meta.url));
const generatedTypes = path.resolve(dirname, '../src/payload-types.ts');

try {
  const { getPayload } = await import('payload');
  const { default: config } = await import('../src/payload.config.ts');
  await getPayload({ config });
  console.log('ensure-schema: Payload schema push complete');

  // getPayload may emit payload-types.ts; remove it so `next build` typechecks
  // match local (types file is gitignored and not part of the app source).
  await unlink(generatedTypes).catch(() => undefined);

  // Force-exit: Payload keeps the pg pool open and would hang the build.
  process.exit(0);
} catch (error) {
  console.error('ensure-schema: failed', error);
  process.exit(1);
}
