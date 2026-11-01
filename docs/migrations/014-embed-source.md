# Migration 014: `source` becomes text (Embeddable Widget)

## What changes

| Table              | Column   | Before                              | After                                     |
| ------------------ | -------- | ----------------------------------- | ----------------------------------------- |
| `subscribers`      | `source` | enum `enum_subscribers_source`      | `varchar`, default `'other'`              |
| `analytics_counts` | `source` | enum `enum_analytics_counts_source` | `varchar`                                 |
| `analytics_counts` | `metric` | enum without the widget metrics     | enum plus `widget_view`, `outbound_click` |

The reason: a partner is attributed as `site:<key>`, and keys are per project, so the value can't be
a fixed enum. The allowed syntax is enforced in the collections
(`vk|wa|fb|tg|other|site:<key>`). Every existing value stays valid, and no row changes.

The new `embed_partners*` tables and the new project fields are additive. Payload creates them on
its own.

## Why a SQL file and not `pnpm db:migrate`

This project has no Payload migration files. Deploys apply the schema with `ensure-schema`
(`vercel.json` build command), which is a one-shot Drizzle push. `pnpm db:generate` would create a
baseline of the **whole** schema, which is wrong for a database that already exists. The change is
two columns, so it is a small, reviewed SQL file:

`apps/web/scripts/sql/014-embed-source-text.sql`

It is idempotent: it checks the column type first, so running it twice, or after the push has
already converted the columns, does nothing.

## Is it required?

Not strictly. Tested on PostgreSQL with a copy of the schema in its **old** shape (enum columns,
rows for `tg`, `wa` and `other`):

- `ensure-schema` on its own converted both columns, added the two metrics, printed
  `Payload schema push complete`, asked nothing without a TTY, and kept every row.
- The SQL file on its own produced the same result, and a following `ensure-schema` found no diff.

Running the SQL first is still the safer path on production: the change is explicit and reviewable,
and it doesn't depend on how Drizzle's push treats an enum-to-text change on that database.

## How to run it

Use a **direct** (non-pooled) connection string. Neon's pooled host (`-pooler`) is fine for the
app, but run DDL on the direct one.

1. **Branch first.** In the Neon console, create a branch from production (or
   `neonctl branches create --name embed-source-check`). Copy the branch's direct connection string.

2. **Apply on the branch and check:**

   ```bash
   export BRANCH_URL='postgres://…direct…/neondb?sslmode=require'
   psql "$BRANCH_URL" -v ON_ERROR_STOP=1 -f apps/web/scripts/sql/014-embed-source-text.sql

   psql "$BRANCH_URL" -c "select table_name, data_type from information_schema.columns
     where column_name = 'source' and table_name in ('subscribers','analytics_counts')"
   psql "$BRANCH_URL" -c "select source, count(*) from subscribers group by 1 order by 1"
   ```

   Expect `character varying` for both and the same counts per source as on production.

3. **Check the push on the branch** (optional but cheap): run the deploy's schema step against it
   and read the last line.

   ```bash
   DATABASE_URL="$BRANCH_URL" pnpm --filter @hht/web ensure-schema
   # ensure-schema: Payload schema push complete
   ```

4. **Production, before merging the PR:**

   ```bash
   export PROD_URL='postgres://…direct…/neondb?sslmode=require'
   psql "$PROD_URL" -v ON_ERROR_STOP=1 -f apps/web/scripts/sql/014-embed-source-text.sql
   ```

   The old code keeps working on the new columns, because `varchar` accepts every value the enum
   did. So the order is: SQL, then merge and deploy.

5. **After the deploy**, the build log should contain `ensure-schema: Payload schema push complete`.
   Delete the Neon branch.

> Never point a local process at the production database (`CLAUDE.md`). Run `psql` and
> `ensure-schema` only with the branch URL until step 4.

## Preview deployments

Vercel preview builds also run `ensure-schema`. If the preview environment's `DATABASE_URL` points
at production data (a branch of it, or the same database), the preview build of this PR can already
have applied the push. Check which database the preview uses before relying on step 4, and run the
SQL anyway; it is a no-op when the columns are already `varchar`.

## Rollback

Converting back to an enum fails while `site:<key>` values exist. Map them first:

```sql
BEGIN;
UPDATE subscribers SET source = 'other' WHERE source LIKE 'site:%';
UPDATE analytics_counts SET source = 'other' WHERE source LIKE 'site:%';
-- merge duplicates created by the update, then recreate the enums and cast the columns back
COMMIT;
```

`analytics_counts` has a unique index on `(project_id, issue_key, source, metric)`, so the second
`UPDATE` can collide. Sum the counts of the colliding rows into one before updating. In practice
rolling back isn't needed: `varchar` is a superset, and the previous code runs on it unchanged.
