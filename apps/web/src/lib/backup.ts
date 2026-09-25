/**
 * Daily database backup, mailed to the owner as an encrypted attachment.
 *
 * Why not `pg_dump`: Vercel functions have no Postgres binaries, only Node. So
 * this exports data only. The schema lives in the Payload config and is
 * recreated by `ensure-schema` (Drizzle push), which is all a restore needs.
 *
 * Why at all: Neon's free-tier point-in-time restore covers hours, not days.
 * It undoes the last mistake; it does not recover a deletion noticed a week later.
 */
import crypto from 'node:crypto';
import { gunzipSync, gzipSync } from 'node:zlib';

export const DUMP_VERSION = 1;

/**
 * Short-lived or lock/cache rows: nothing worth restoring. `payload_migrations`
 * only holds the schema-push marker, which Payload writes itself when it pushes
 * the schema into the empty restore target.
 */
export const SKIP_TABLES = new Set([
  'payload_migrations',
  'auth_codes',
  'users_sessions',
  'payload_kv',
  'payload_locked_documents',
  'payload_locked_documents_rels',
]);

export type Dump = {
  version: number;
  createdAt: string;
  /** Hash of the database host: shows where a copy came from without leaking the URL. */
  source: string;
  /** Alphabetical; `restoreDump` works out the insert order from the target schema. */
  tables: Array<{ name: string; rows: Record<string, unknown>[] }>;
  sequences: Array<{ name: string; value: string }>;
};

/** The subset of a `pg` client this module needs (Payload's pool provides it). */
export type Queryable = {
  query<R extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    values?: unknown[],
  ): Promise<{ rows: R[] }>;
};

/** `payload.db.pool` of `@payloadcms/db-postgres` (a `pg` Pool). */
export type PoolLike = { connect(): Promise<Queryable & { release(): void }> };

function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

/**
 * Parents before children. We cannot disable FK checks during restore (that
 * needs superuser, which Neon does not give), so insert order must be right.
 * A cycle is appended as-is; `restoreDump` avoids cycles by ordering on
 * NOT NULL keys only.
 */
export function orderTables(
  tables: string[],
  foreignKeys: Array<{ child: string; parent: string }>,
): string[] {
  const deps = new Map(tables.map((t) => [t, new Set<string>()]));
  for (const { child, parent } of foreignKeys) {
    if (child === parent) continue;
    if (deps.has(child) && deps.has(parent)) deps.get(child)!.add(parent);
  }

  const ordered: string[] = [];
  const placed = new Set<string>();
  while (placed.size < tables.length) {
    const ready = tables.filter(
      (t) => !placed.has(t) && [...deps.get(t)!].every((p) => placed.has(p)),
    );
    if (ready.length === 0) {
      ordered.push(...tables.filter((t) => !placed.has(t)));
      break;
    }
    for (const table of ready) {
      ordered.push(table);
      placed.add(table);
    }
  }
  return ordered;
}

/**
 * Reads every table in one REPEATABLE READ, READ ONLY transaction, so the copy
 * is a consistent snapshot even if the worker writes while it runs.
 */
export async function createDump(client: Queryable, databaseUrl: string): Promise<Dump> {
  await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  try {
    const { rows: tableRows } = await client.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
        ORDER BY table_name`,
    );
    const names = tableRows.map((r) => r.table_name).filter((name) => !SKIP_TABLES.has(name));

    const tables: Dump['tables'] = [];
    for (const name of names) {
      const { rows } = await client.query(`SELECT * FROM ${quoteIdent(name)}`);
      tables.push({ name, rows });
    }

    // Without sequences, the first insert after a restore collides with an existing id.
    const { rows: sequences } = await client.query<{ name: string; value: string | null }>(
      `SELECT sequencename AS name, last_value::text AS value
         FROM pg_sequences WHERE schemaname = 'public' ORDER BY sequencename`,
    );

    await client.query('COMMIT');
    return {
      version: DUMP_VERSION,
      createdAt: new Date().toISOString(),
      source: fingerprint(databaseUrl),
      tables,
      sequences: sequences.flatMap((s) =>
        s.value === null ? [] : [{ name: s.name, value: s.value }],
      ),
    };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  }
}

function fingerprint(url: string): string {
  try {
    return crypto.createHash('sha256').update(new URL(url).hostname).digest('hex').slice(0, 8);
  } catch {
    return 'unknown';
  }
}

export function totalRows(dump: Dump): number {
  return dump.tables.reduce((sum, t) => sum + t.rows.length, 0);
}

/** What the copy contains, for the email body and `backup:verify`. */
export function summarize(dump: Dump): string {
  const lines = dump.tables
    .filter((t) => t.rows.length > 0)
    .map((t) => `  ${t.name}: ${t.rows.length}`);
  return [`Rows: ${totalRows(dump)}`, ...lines, `Sequences: ${dump.sequences.length}`].join('\n');
}

// ───────────────────────── encryption ─────────────────────────

/**
 * AES-256-GCM key: 32 bytes, base64, in `BACKUP_KEY` (`openssl rand -base64 32`).
 * Keep it in a password manager, not in the same mailbox: losing it loses every copy.
 */
export function backupKey(env: Record<string, string | undefined> = process.env): Buffer | null {
  const raw = env.BACKUP_KEY?.trim();
  if (!raw) return null;
  const key = Buffer.from(raw, 'base64');
  if (key.length !== 32) {
    throw new Error('BACKUP_KEY must be 32 bytes in base64 (openssl rand -base64 32)');
  }
  return key;
}

/** gzip, then encrypt. File layout: iv (12) | tag (16) | ciphertext — self-contained. */
export function packDump(dump: Dump, key: Buffer): Buffer {
  const plain = gzipSync(Buffer.from(JSON.stringify(dump), 'utf8'));
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const body = Buffer.concat([cipher.update(plain), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]);
}

/** Throws on a wrong key or a tampered file (GCM cannot tell the two apart). */
export function unpackDump(packed: Buffer, key: Buffer): Dump {
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, packed.subarray(0, 12));
  decipher.setAuthTag(packed.subarray(12, 28));
  const plain = Buffer.concat([decipher.update(packed.subarray(28)), decipher.final()]);
  return JSON.parse(gunzipSync(plain).toString('utf8')) as Dump;
}

export function backupFileName(dump: Pick<Dump, 'createdAt'>): string {
  return `hht-news-${dump.createdAt.slice(0, 10)}.json.gz.enc`;
}

// ───────────────────────── restore ─────────────────────────

const INSERT_CHUNK_ROWS = 200;

type ForeignKey = { child: string; column: string; parent: string; nullable: boolean };

const FOREIGN_KEY_COLUMNS_SQL = `
  SELECT tc.table_name AS child, kcu.column_name AS "column", ccu.table_name AS parent,
         (c.is_nullable = 'YES') AS nullable
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON kcu.constraint_name = tc.constraint_name AND kcu.table_schema = tc.table_schema
  JOIN information_schema.constraint_column_usage ccu
    ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
  JOIN information_schema.columns c
    ON c.table_schema = tc.table_schema AND c.table_name = tc.table_name
   AND c.column_name = kcu.column_name
  WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'`;

/**
 * Inserts a dump into a database whose schema already exists (Payload pushes
 * it on start) and whose tables are empty. Refuses a table that already has
 * rows, so it can never merge into or duplicate live data. One transaction:
 * a failure leaves the target untouched.
 *
 * Payload's schema has foreign-key cycles (`digests.run` ↔ `monitoring_runs.digest`),
 * so no insert order satisfies every key. Rows are inserted in the order of the
 * NOT NULL keys only (those cannot form a cycle, or the data could not exist),
 * with nullable foreign keys left NULL, and those are filled in afterwards.
 */
export async function restoreDump(client: Queryable, dump: Dump): Promise<{ rows: number }> {
  await client.query('BEGIN');
  try {
    const { rows: foreignKeys } = await client.query<ForeignKey>(FOREIGN_KEY_COLUMNS_SQL);
    const deferred = new Map<string, Set<string>>();
    for (const fk of foreignKeys) {
      if (!fk.nullable) continue;
      if (!deferred.has(fk.child)) deferred.set(fk.child, new Set());
      deferred.get(fk.child)!.add(fk.column);
    }

    const byName = new Map(dump.tables.map((t) => [t.name, t]));
    const order = orderTables(
      [...byName.keys()],
      foreignKeys.filter((fk) => !fk.nullable),
    );

    let rows = 0;
    for (const tableName of order) {
      const table = byName.get(tableName)!;
      if (table.rows.length === 0) continue;
      const name = quoteIdent(table.name);

      const { rows: existing } = await client.query<{ n: number }>(
        `SELECT count(*)::int AS n FROM ${name}`,
      );
      if ((existing[0]?.n ?? 0) > 0) {
        throw new Error(`Table ${table.name} is not empty; restore only into an empty database`);
      }

      const { rows: columns } = await client.query<{ column_name: string; data_type: string }>(
        `SELECT column_name, data_type FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = $1`,
        [table.name],
      );
      const json = new Set(
        columns
          .filter((c) => c.data_type === 'jsonb' || c.data_type === 'json')
          .map((c) => c.column_name),
      );
      const later = deferred.get(table.name) ?? new Set<string>();
      // `pg` would send a JS array as a Postgres array, not JSON.
      const encode = (column: string, value: unknown) =>
        json.has(column) && value !== null && value !== undefined ? JSON.stringify(value) : value;

      const keys = Object.keys(table.rows[0]!);
      for (let start = 0; start < table.rows.length; start += INSERT_CHUNK_ROWS) {
        const chunk = table.rows.slice(start, start + INSERT_CHUNK_ROWS);
        const values: unknown[] = [];
        const tuples = chunk.map((row) => {
          const params = keys.map((key) => {
            values.push(later.has(key) ? null : encode(key, row[key]));
            return `$${values.length}`;
          });
          return `(${params.join(', ')})`;
        });
        await client.query(
          `INSERT INTO ${name} (${keys.map(quoteIdent).join(', ')}) VALUES ${tuples.join(', ')}`,
          values,
        );
      }
      rows += table.rows.length;
    }

    // Second pass: every row now exists, so the nullable keys can point anywhere.
    for (const [tableName, laterColumns] of deferred) {
      const table = byName.get(tableName);
      if (!table || table.rows.length === 0) continue;
      const columns = [...laterColumns].filter((c) => c in table.rows[0]!);
      if (columns.length === 0) continue;
      const assignments = columns.map((c, i) => `${quoteIdent(c)} = $${i + 1}`).join(', ');
      for (const row of table.rows) {
        if (columns.every((c) => row[c] === null || row[c] === undefined)) continue;
        await client.query(
          `UPDATE ${quoteIdent(tableName)} SET ${assignments} WHERE "id" = $${columns.length + 1}`,
          [...columns.map((c) => row[c] ?? null), row.id],
        );
      }
    }

    for (const sequence of dump.sequences) {
      await client.query('SELECT setval($1, $2::bigint, true)', [
        `public.${quoteIdent(sequence.name)}`,
        sequence.value,
      ]);
    }

    await client.query('COMMIT');
    return { rows };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  }
}
