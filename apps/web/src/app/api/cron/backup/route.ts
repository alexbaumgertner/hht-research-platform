import { NextResponse } from 'next/server';
import { getPayload } from 'payload';
import config from '@payload-config';

import {
  type PoolLike,
  backupFileName,
  backupKey,
  createDump,
  packDump,
  summarize,
  totalRows,
} from '@/lib/backup';
import { cronAuthorized } from '@/lib/cronAuth';
import { sendEmail } from '@/lib/email';

export const runtime = 'nodejs';
export const maxDuration = 300;

/** Resend accepts up to 40 MB per email; stay well below it. */
const MAX_ATTACHMENT_BYTES = 30 * 1024 * 1024;

const NO_STORE = { 'Cache-Control': 'no-store' };

/**
 * Daily backup (Vercel Cron, `vercel.json`): dump every table, gzip, encrypt
 * with BACKUP_KEY and mail it to BACKUP_EMAIL. The mailbox is the only store.
 * A failed backup sends a "NOT made" email: a silent failure is worse than none.
 */
export async function GET(request: Request) {
  if (!cronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });
  }

  const to = process.env.BACKUP_EMAIL?.trim();
  try {
    if (!to) throw new Error('BACKUP_EMAIL is not set');
    const key = backupKey();
    if (!key) throw new Error('BACKUP_KEY is not set; refusing to mail an unencrypted copy');

    const payload = await getPayload({ config });
    const pool = (payload.db as unknown as { pool: PoolLike }).pool;
    const client = await pool.connect();
    let dump;
    try {
      dump = await createDump(client, process.env.DATABASE_URL ?? '');
    } finally {
      client.release();
    }

    const file = packDump(dump, key);
    const date = dump.createdAt.slice(0, 10);
    const attach = file.byteLength <= MAX_ATTACHMENT_BYTES;
    const sizeKb = Math.ceil(file.byteLength / 1024);

    await sendEmail({
      to,
      subject: `HHT News backup ${date}`,
      text: [
        `Database backup ${dump.createdAt} (source ${dump.source}).`,
        '',
        summarize(dump),
        '',
        `Encrypted file: ${sizeKb} KB.`,
        attach
          ? 'Check it: pnpm --filter @hht/web backup:verify -- <file>'
          : `NOT attached: the file exceeds ${MAX_ATTACHMENT_BYTES / 1024 / 1024} MB. Move backups to storage.`,
      ].join('\n'),
      ...(attach ? { attachments: [{ filename: backupFileName(dump), content: file }] } : {}),
    });

    return NextResponse.json(
      { ok: true, rows: totalRows(dump), bytes: file.byteLength, attached: attach },
      { headers: NO_STORE },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[backup] failed', { error: message });
    if (to) {
      await sendEmail({
        to,
        subject: 'HHT News backup NOT made',
        text: `The daily database backup failed:\n\n${message}`,
      }).catch((mailError) => console.error('[backup] failure email not sent', { mailError }));
    }
    return NextResponse.json({ error: message }, { status: 500, headers: NO_STORE });
  }
}
