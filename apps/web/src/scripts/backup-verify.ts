/**
 * Check a mailed backup without restoring it: does my key open it, and what is inside?
 *
 * Usage: BACKUP_KEY='…' pnpm --filter @hht/web backup:verify -- ~/Downloads/hht-news-2026-09-25.json.gz.enc
 *
 * Touches no database. Worth doing by hand every few months: tests catch broken
 * code, not a copy that quietly became incomplete after a schema change.
 */
import { readFile } from 'node:fs/promises';

import { DUMP_VERSION, backupKey, summarize, unpackDump, type Dump } from '../lib/backup';

async function main() {
  const path = process.argv.slice(2).find((arg) => arg !== '--');
  if (!path) {
    console.error('Usage: pnpm --filter @hht/web backup:verify -- <file.json.gz.enc>');
    process.exit(1);
  }

  const key = backupKey();
  if (!key) {
    console.error('BACKUP_KEY is not set. Take it from the password manager:');
    console.error(`  BACKUP_KEY='…' pnpm --filter @hht/web backup:verify -- ${path}`);
    process.exit(1);
  }

  const file = await readFile(path.replace(/^~/, process.env.HOME ?? '~'));
  let dump: Dump;
  try {
    dump = unpackDump(file, key);
  } catch {
    console.error('Cannot decrypt: wrong key or damaged file.');
    process.exit(1);
  }

  if (dump.version !== DUMP_VERSION) {
    console.warn(`Warning: backup version ${dump.version}, this code reads ${DUMP_VERSION}.`);
  }
  const ageHours = Math.round((Date.now() - Date.parse(dump.createdAt)) / 36e5);
  console.log(`\nBackup ${dump.createdAt} (${ageHours} h ago), source ${dump.source}\n`);
  console.log(summarize(dump));

  const publications = dump.tables.find((t) => t.name === 'publications')?.rows.length ?? 0;
  const projects = dump.tables.find((t) => t.name === 'research_projects')?.rows.length ?? 0;
  if (!publications || !projects) {
    console.error('\nNo projects or publications in this backup: it would restore nothing useful.');
    process.exit(1);
  }
  console.log('\nReadable and not empty. Restore: pnpm --filter @hht/web backup:restore -- <file>');
}

void main();
