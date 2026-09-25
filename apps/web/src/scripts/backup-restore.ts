/**
 * Restore a mailed backup into an EMPTY database.
 *
 * Usage:
 *   DATABASE_URL=postgres://…/empty_db BACKUP_KEY='…' \
 *     pnpm --filter @hht/web backup:restore -- ~/Downloads/hht-news-2026-09-25.json.gz.enc
 *
 * Starting Payload pushes the schema into the empty database first, then rows
 * are inserted in foreign-key order and sequences are reset. Refuses a table
 * that already has rows. Local databases only unless ALLOW_REMOTE_DATABASE=1
 * (for a real recovery into a fresh Neon branch).
 */
import { readFile } from 'node:fs/promises';

import { getPayload } from 'payload';
import config from '@payload-config';

import { backupKey, restoreDump, unpackDump, type PoolLike } from '../lib/backup';
import { assertLocalDatabaseForScript } from '../lib/databaseTarget';

async function main() {
  assertLocalDatabaseForScript('backup:restore');

  const path = process.argv.slice(2).find((arg) => arg !== '--');
  if (!path) {
    console.error('Usage: pnpm --filter @hht/web backup:restore -- <file.json.gz.enc>');
    process.exit(1);
  }
  const key = backupKey();
  if (!key) {
    console.error('BACKUP_KEY is not set. Take it from the password manager.');
    process.exit(1);
  }

  const dump = unpackDump(await readFile(path.replace(/^~/, process.env.HOME ?? '~')), key);
  const payload = await getPayload({ config });
  const client = await (payload.db as unknown as { pool: PoolLike }).pool.connect();
  try {
    const { rows } = await restoreDump(client, dump);
    console.log(`Restored ${rows} rows from the backup of ${dump.createdAt}.`);
  } finally {
    client.release();
  }
  process.exit(0);
}

main().catch((error) => {
  console.error('backup:restore failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
