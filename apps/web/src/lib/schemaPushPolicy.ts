/**
 * Decision logic for `scripts/ensure-schema.mjs` (pure, no database access).
 *
 * The script computes a dry-run of the Payload schema push (drizzle-kit
 * `pushSchema`) and hands the result here. Nothing in this file prompts:
 * a destructive change is either refused or, outside production and only on
 * explicit opt-in, applied.
 */

type Env = Record<string, string | undefined>;

export interface SchemaPushPlan {
  /** SQL that drizzle-kit would execute. */
  statements: string[];
  /** Warnings drizzle-kit would ask the user to accept. */
  warnings: string[];
  hasDataLoss: boolean;
}

export type SchemaPushDecision =
  | { action: 'apply' }
  | { action: 'skip'; reason: string }
  | { action: 'fail'; reason: string; destructive: string[] };

const SCHEMA_PREFIX = String.raw`(?:(?:"[^"]+"|\w+)\.)?`;
const TABLE_NAME = String.raw`(?:"([^"]+)"|(\w+))`;
const DROP_COLUMN = new RegExp(
  String.raw`ALTER\s+TABLE\s+${SCHEMA_PREFIX}${TABLE_NAME}\s+DROP\s+COLUMN\s+(?:IF\s+EXISTS\s+)?(?:"([^"]+)"|(\w+))`,
  'i',
);
const DROP_TABLE = new RegExp(
  String.raw`DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?${SCHEMA_PREFIX}${TABLE_NAME}`,
  'i',
);

/** Columns / tables a plan would remove, as `table.column` or `table` (whole table). */
export function listDestructiveChanges(plan: SchemaPushPlan): string[] {
  const found = new Set<string>();
  for (const statement of plan.statements) {
    const column = DROP_COLUMN.exec(statement);
    if (column) {
      found.add(`${column[1] ?? column[2]}.${column[3] ?? column[4]}`);
      continue;
    }
    const table = DROP_TABLE.exec(statement);
    if (table) found.add(`${table[1] ?? table[2]} (whole table)`);
  }
  return [...found].sort();
}

export function isProductionBuild(env: Env): boolean {
  return env.VERCEL_ENV === 'production';
}

function parseUrl(url: string | undefined): { host: string; database: string } | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return { host: parsed.hostname.toLowerCase(), database: parsed.pathname.replace(/^\//, '') };
  } catch {
    return null;
  }
}

/**
 * A preview build must never push to the production database.
 * Production is identified by `PRODUCTION_DATABASE_HOST` / `PRODUCTION_DATABASE_NAME`
 * (set them on the Vercel Preview environment). Returns an error message or null.
 * Neon pooled and direct hosts differ only by `-pooler`, so that suffix is ignored.
 */
export function previewTargetError(env: Env): string | null {
  if (env.VERCEL_ENV !== 'preview') return null;
  const target = parseUrl(env.DATABASE_URL);
  if (!target) return 'DATABASE_URL is missing or not a valid URL.';

  const normalize = (host: string) => host.replace(/-pooler(?=\.)/, '');
  const prodHost = env.PRODUCTION_DATABASE_HOST?.trim().toLowerCase();
  if (prodHost && normalize(prodHost) === normalize(target.host)) {
    return `preview DATABASE_URL points at the production host ${target.host}.`;
  }
  const prodName = env.PRODUCTION_DATABASE_NAME?.trim();
  if (prodName && !prodHost && prodName === target.database) {
    return `preview DATABASE_URL uses the production database name "${target.database}" and PRODUCTION_DATABASE_HOST is not set to tell branches apart.`;
  }
  return null;
}

export function decideSchemaPush(env: Env, plan: SchemaPushPlan): SchemaPushDecision {
  const targetError = previewTargetError(env);
  if (targetError) {
    return {
      action: 'fail',
      reason: `Refusing to push the schema: ${targetError} Previews must use their own Neon branch.`,
      destructive: [],
    };
  }

  if (plan.statements.length === 0 && plan.warnings.length === 0) {
    return { action: 'skip', reason: 'schema is already up to date' };
  }

  const destructive = listDestructiveChanges(plan);
  const risky = destructive.length > 0 || plan.hasDataLoss || plan.warnings.length > 0;
  if (!risky) return { action: 'apply' };

  const optedIn = env.ENSURE_SCHEMA_ALLOW_DESTRUCTIVE === '1' && !isProductionBuild(env);
  if (optedIn) return { action: 'apply' };

  const where = isProductionBuild(env)
    ? 'Destructive schema changes are never applied automatically in a production build; write and review a migration instead.'
    : 'This branch is probably behind main: merge main (it likely lacks fields that exist in the database) or, if the removal is intended, run it deliberately with ENSURE_SCHEMA_ALLOW_DESTRUCTIVE=1 outside production.';
  const lines = [
    'ensure-schema: the schema push would remove data and was NOT applied.',
    where,
    destructive.length ? `Affected: ${destructive.join(', ')}` : 'Affected: (see warnings)',
    ...plan.warnings.map((warning) => `warning: ${warning}`),
  ];
  return { action: 'fail', reason: lines.join('\n'), destructive };
}
