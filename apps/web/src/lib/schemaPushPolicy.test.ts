import { decideSchemaPush, listDestructiveChanges, previewTargetError } from './schemaPushPolicy';

const safe = {
  statements: ['ALTER TABLE "subscribers" ADD COLUMN "x" varchar;'],
  warnings: [],
  hasDataLoss: false,
};
const dropping = {
  statements: [
    'ALTER TABLE "publications" DROP COLUMN "trial_metadata_phase";',
    'ALTER TABLE "publications" DROP COLUMN IF EXISTS "trial_metadata_status";',
    'DROP TABLE "old_things" CASCADE;',
  ],
  warnings: ['You are about to delete 2 columns'],
  hasDataLoss: true,
};
const NEON = 'postgres://u:p@ep-dev-pooler.eu-central-1.aws.neon.tech/neondb';

describe('listDestructiveChanges', () => {
  it('lists dropped columns and tables', () => {
    expect(listDestructiveChanges(dropping)).toEqual([
      'old_things (whole table)',
      'publications.trial_metadata_phase',
      'publications.trial_metadata_status',
    ]);
    expect(listDestructiveChanges(safe)).toEqual([]);
  });
});

describe('listDestructiveChanges with schema qualifiers', () => {
  const plan = (...statements: string[]) => ({ statements, warnings: [], hasDataLoss: true });
  it('reports the real table for a quoted schema qualifier', () => {
    expect(
      listDestructiveChanges(
        plan('ALTER TABLE "public"."publications" DROP COLUMN "trial_metadata_phase";'),
      ),
    ).toEqual(['publications.trial_metadata_phase']);
  });
  it('reports the real table for a qualified DROP TABLE', () => {
    expect(listDestructiveChanges(plan('DROP TABLE IF EXISTS "public"."publications";'))).toEqual([
      'publications (whole table)',
    ]);
  });
  it('handles an unquoted public.table', () => {
    expect(
      listDestructiveChanges(
        plan(
          'ALTER TABLE public.publications DROP COLUMN trial_metadata_phase;',
          'DROP TABLE public.old_things;',
        ),
      ),
    ).toEqual(['old_things (whole table)', 'publications.trial_metadata_phase']);
  });
});

describe('previewTargetError', () => {
  const prod = { PRODUCTION_DATABASE_HOST: 'ep-prod.eu-central-1.aws.neon.tech' };
  it('rejects the production host in a preview, ignoring -pooler', () => {
    const env = {
      ...prod,
      VERCEL_ENV: 'preview',
      DATABASE_URL: 'postgres://u:p@ep-prod-pooler.eu-central-1.aws.neon.tech/neondb',
    };
    expect(previewTargetError(env)).toMatch(/production host/);
  });
  it('accepts another host and ignores non-preview environments', () => {
    expect(previewTargetError({ ...prod, VERCEL_ENV: 'preview', DATABASE_URL: NEON })).toBeNull();
    expect(
      previewTargetError({ ...prod, VERCEL_ENV: 'production', DATABASE_URL: NEON }),
    ).toBeNull();
  });
  it('treats an empty or whitespace host as unset for the database-name fallback', () => {
    for (const host of ['', '   ']) {
      const env = {
        VERCEL_ENV: 'preview',
        DATABASE_URL: NEON,
        PRODUCTION_DATABASE_HOST: host,
        PRODUCTION_DATABASE_NAME: 'neondb',
      };
      expect(previewTargetError(env)).toMatch(/production database name/);
    }
  });
  it('rejects a preview without a usable DATABASE_URL', () => {
    expect(previewTargetError({ VERCEL_ENV: 'preview' })).toMatch(/DATABASE_URL/);
  });
});

describe('decideSchemaPush', () => {
  it('skips when nothing changes and applies additive changes', () => {
    const env = { VERCEL_ENV: 'preview', DATABASE_URL: NEON };
    expect(decideSchemaPush(env, { statements: [], warnings: [], hasDataLoss: false }).action).toBe(
      'skip',
    );
    expect(decideSchemaPush(env, safe)).toEqual({ action: 'apply' });
  });

  it('fails on destructive changes in preview with the affected columns', () => {
    const decision = decideSchemaPush({ VERCEL_ENV: 'preview', DATABASE_URL: NEON }, dropping);
    expect(decision.action).toBe('fail');
    if (decision.action === 'fail') {
      expect(decision.reason).toMatch(/merge main/);
      expect(decision.reason).toMatch(/publications\.trial_metadata_phase/);
    }
  });

  it('never applies destructive changes in production, even when opted in', () => {
    const env = {
      VERCEL_ENV: 'production',
      DATABASE_URL: NEON,
      ENSURE_SCHEMA_ALLOW_DESTRUCTIVE: '1',
    };
    const decision = decideSchemaPush(env, dropping);
    expect(decision.action).toBe('fail');
    if (decision.action === 'fail') expect(decision.reason).toMatch(/production build/);
  });

  it('allows an explicit opt-in outside production', () => {
    const env = { DATABASE_URL: NEON, ENSURE_SCHEMA_ALLOW_DESTRUCTIVE: '1' };
    expect(decideSchemaPush(env, dropping)).toEqual({ action: 'apply' });
  });

  it('refuses a preview that targets production before looking at the plan', () => {
    const env = {
      VERCEL_ENV: 'preview',
      DATABASE_URL: NEON,
      PRODUCTION_DATABASE_HOST: 'ep-dev.eu-central-1.aws.neon.tech',
    };
    const decision = decideSchemaPush(env, safe);
    expect(decision.action).toBe('fail');
  });

  it('treats unexplained warnings as risky', () => {
    const plan = {
      statements: ['ALTER TABLE "a" ALTER COLUMN "b" TYPE integer;'],
      warnings: ['x'],
      hasDataLoss: false,
    };
    expect(decideSchemaPush({ DATABASE_URL: NEON }, plan).action).toBe('fail');
  });
});
