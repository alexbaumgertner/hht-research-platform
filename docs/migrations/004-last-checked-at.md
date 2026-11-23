# Migration 004b: `research_projects.last_checked_at` (daily check)

Part of spec 004, owner decision on Open Question 2: every project is checked daily, even weekly
ones; `/api/health` is unhealthy when the last successful check is older than 26 h. Publishing
stays on the weekly slot.

| Table               | Column            | Type                                    |
| ------------------- | ----------------- | --------------------------------------- |
| `research_projects` | `last_checked_at` | `timestamp(3) with time zone`, nullable |

Additive, no backfill, no row changes. Until a project's first daily check, `/api/health` falls back
to `lastSuccessfulRunAt` (a successful run also counts as a check), so deploy order cannot raise a
false alarm beyond what that value already implies.

File: `apps/web/scripts/sql/004-last-checked-at.sql` (idempotent). Why a SQL file and not
`pnpm db:migrate`: see [migration 014](./014-embed-source.md).

## How to run it (owner)

Direct (non-pooled) connection string, Neon branch of production first:

```bash
export BRANCH_URL='postgres://…direct…/neondb?sslmode=require'
psql "$BRANCH_URL" -v ON_ERROR_STOP=1 -f apps/web/scripts/sql/004-last-checked-at.sql
psql "$BRANCH_URL" -c "select column_name, data_type from information_schema.columns
  where table_name='research_projects' and column_name='last_checked_at'"
```

Then production, **before merging the PR** (the worker PATCHes `lastCheckedAt`). The agent has not
run this file anywhere.

Rollback: `ALTER TABLE research_projects DROP COLUMN last_checked_at;` (optional column; health
falls back to `lastSuccessfulRunAt`).
