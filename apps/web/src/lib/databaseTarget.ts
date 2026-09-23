/**
 * Guards against local tooling touching a managed (production) database.
 * `next dev` pushes Payload schema changes automatically, and seed scripts
 * write demo rows — both must only ever hit a local Postgres by default.
 */

type Env = Record<string, string | undefined>;

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', 'postgres', 'host.docker.internal']);

function databaseHost(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^\[|\]$/g, '');
  } catch {
    return null;
  }
}

export function isLocalDatabaseUrl(url: string | undefined): boolean {
  const host = databaseHost(url);
  return host !== null && LOCAL_HOSTS.has(host);
}

/**
 * Payload auto-push (dev only) is limited to local databases.
 * `scripts/ensure-schema.mjs` sets PAYLOAD_ALLOW_REMOTE_PUSH=1 for deploy builds.
 */
export function shouldPushSchema(env: Env = process.env): boolean {
  return isLocalDatabaseUrl(env.DATABASE_URL) || env.PAYLOAD_ALLOW_REMOTE_PUSH === '1';
}

/** For one-off scripts that write data: refuse remote databases unless ALLOW_REMOTE_DATABASE=1. */
export function assertLocalDatabaseForScript(scriptName: string, env: Env = process.env): void {
  if (isLocalDatabaseUrl(env.DATABASE_URL) || env.ALLOW_REMOTE_DATABASE === '1') return;
  const host = databaseHost(env.DATABASE_URL) ?? 'unknown host';
  throw new Error(
    `${scriptName} refuses to run against remote database ${host}. ` +
      'Point DATABASE_URL at a local Postgres (docker compose up -d) or set ALLOW_REMOTE_DATABASE=1.',
  );
}

/**
 * `next dev`, tests and scripts must not run against a managed database by
 * accident (e.g. DATABASE_URL pulled into .env.development.local by
 * `vercel env pull`). Production runtime and deploy builds are exempt.
 */
export function assertDevDatabaseIsLocal(env: Env = process.env): void {
  if (env.NODE_ENV === 'production') return;
  if (isLocalDatabaseUrl(env.DATABASE_URL)) return;
  if (env.PAYLOAD_ALLOW_REMOTE_PUSH === '1' || env.ALLOW_REMOTE_DATABASE === '1') return;
  const host = databaseHost(env.DATABASE_URL) ?? 'unknown host';
  throw new Error(
    `Refusing to start against remote database ${host} outside production. ` +
      'Use the docker compose Postgres in apps/web/.env.local, or set ALLOW_REMOTE_DATABASE=1 deliberately.',
  );
}
