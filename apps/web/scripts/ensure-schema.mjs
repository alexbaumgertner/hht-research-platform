/**
 * Ensures Payload Postgres tables exist before `next build`.
 * Payload only auto-pushes schema when NODE_ENV !== 'production', so this
 * script forces a one-shot push using the deployment DATABASE_URL.
 *
 * Env files are loaded by payload.config via loadLocalEnv().
 */
import { randomUUID } from 'node:crypto';
import { unlink } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { decideSchemaPush } from '../src/lib/schemaPushPolicy.ts';

process.env.NODE_ENV = 'development';
// Deploy builds target the managed database on purpose (see lib/databaseTarget.ts).
process.env.PAYLOAD_ALLOW_REMOTE_PUSH = '1';
// Payload's own push asks "Accept warnings and push schema?" on destructive changes and
// hangs without a TTY (exit 13). Disable it; the guarded push below replaces it.
process.env.PAYLOAD_SKIP_AUTO_PUSH = '1';

// drizzle-kit may also ask interactive rename questions; never wait for an answer.
const PLAN_TIMEOUT_MS = 120_000;

// Ephemeral secret for schema push only — never serves traffic.
process.env.PAYLOAD_SECRET ||= randomUUID();

const dirname = path.dirname(fileURLToPath(import.meta.url));
const generatedTypes = path.resolve(dirname, '../src/payload-types.ts');

try {
  const { getPayload } = await import('payload');
  const { default: config } = await import('../src/payload.config.ts');

  if (!process.env.DATABASE_URL) {
    console.error(
      'ensure-schema: DATABASE_URL is required (set it in apps/web/.env.local or the environment)',
    );
    process.exit(1);
  }

  const payload = await getPayload({ config });
  const adapter = payload.db;

  const { pushSchema } = adapter.requireDrizzleKit();
  const timer = setTimeout(() => {
    console.error(
      'ensure-schema: computing the schema diff did not finish; drizzle-kit is probably waiting for an interactive answer (e.g. column rename). Run ensure-schema locally against a copy of this database.',
    );
    process.exit(1);
  }, PLAN_TIMEOUT_MS);
  const result = await pushSchema(
    adapter.schema,
    adapter.drizzle,
    adapter.schemaName ? [adapter.schemaName] : undefined,
    adapter.tablesFilter,
    adapter.extensions?.postgis ? ['postgis'] : undefined,
  );
  clearTimeout(timer);

  const decision = decideSchemaPush(process.env, {
    statements: result.statementsToExecute ?? [],
    warnings: result.warnings ?? [],
    hasDataLoss: Boolean(result.hasDataLoss),
  });
  if (decision.action === 'fail') {
    console.error(decision.reason);
    process.exit(2);
  }
  if (decision.action === 'apply') await result.apply();
  console.log(
    decision.action === 'skip'
      ? `ensure-schema: ${decision.reason}`
      : 'ensure-schema: Payload schema push complete',
  );

  // getPayload may emit payload-types.ts; remove it so `next build` typechecks
  // match local (types file is gitignored and not part of the app source).
  await unlink(generatedTypes).catch(() => undefined);

  // Force-exit: Payload keeps the pg pool open and would hang the build.
  process.exit(0);
} catch (error) {
  console.error('ensure-schema: failed', error);
  process.exit(1);
}
