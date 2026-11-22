# Migration 004: backlog cursor columns (Pipeline Health)

## What changes

| Table                            | Column            | Type      | Purpose                                                   |
| -------------------------------- | ----------------- | --------- | --------------------------------------------------------- |
| `monitored_sources`              | `cursor_state`    | `jsonb`   | Worker-owned: ids already processed on the watermark day. |
| `monitoring_runs_source_results` | `remaining_count` | `numeric` | Candidates left unprocessed after that source's run.      |

Both are nullable and additive. No existing row changes and no backfill is needed. The old worker
and web code keep working on the new schema.

## Why a SQL file and not `pnpm db:migrate`

Same reason as [migration 014](./014-embed-source.md): this project has no Payload migration files,
deploys apply the schema with `ensure-schema` (a Drizzle push), and `pnpm db:generate` would emit a
baseline of the whole schema. The change is two `ADD COLUMN IF NOT EXISTS` statements, so it is a
small reviewed file: `apps/web/scripts/sql/004-pipeline-cursor.sql`. It is idempotent.

## Status

Applied to production by the owner (verified on a Neon branch first). Nothing left to run for this
file; the steps below stay as the record.

## Is it required?

Not strictly: `ensure-schema` adds nullable columns on its own during the web deploy. Run the SQL
first anyway so the columns exist before the worker image (which PATCHes `cursorState`) can reach
production, regardless of deploy order.

## How to run it

Use a **direct** (non-pooled) connection string, and a Neon branch first.

```bash
export BRANCH_URL='postgres://…direct…/neondb?sslmode=require'
psql "$BRANCH_URL" -v ON_ERROR_STOP=1 -f apps/web/scripts/sql/004-pipeline-cursor.sql
psql "$BRANCH_URL" -c "select table_name, column_name, data_type from information_schema.columns
  where column_name in ('cursor_state','remaining_count')"
```

Then the same file on production, **before merging the PR**. Order: SQL, merge, deploy web (CI also
deploys the worker image via `deploy-worker.yml`).

> Never point a local process at the production database (`CLAUDE.md`).

## Rollback

`ALTER TABLE monitored_sources DROP COLUMN cursor_state; ALTER TABLE monitoring_runs_source_results DROP COLUMN remaining_count;`
Not needed in practice: the columns are optional.

## Historical replay (T000, owner decision: last 30 days only)

Existing watermarks may sit past candidates that the old `clampBatch` dropped. Pre-release omissions
older than 30 days are **not** recovered. To recover the last 30 days, after the new worker is
deployed, the owner resets each source watermark once:

```sql
UPDATE monitored_sources
SET last_successful_fetch_at = now() - interval '30 days'
WHERE enabled = true;
```

Run it on production by the owner only. Already stored items are skipped by the dedupe key, so no
duplicates appear. The LLM cost is capped by design: each source processes at most
`BATCH_SIZE_PER_SOURCE` new candidates per run (FR-012), and the rest drain over the following runs.
Watch `remainingCount` on the runs and the `source backlog persists` ERROR (3 consecutive runs).
The newly recovered items land in the next issue, so tell the owner before running it.
