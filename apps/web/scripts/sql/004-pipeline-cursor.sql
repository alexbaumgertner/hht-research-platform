-- Spec 004 (Pipeline Health, G1): additive columns for the backlog cursor.
--   monitored_sources.cursor_state            jsonb    (boundary key + ids processed on that day)
--   monitoring_runs_source_results.remaining_count numeric (candidates left over after the run)
-- Both nullable, no backfill, no row changes. Safe to run more than once, and a no-op when
-- ensure-schema has already added the columns.
--
-- Run it BEFORE deploying the worker image that writes them (the worker PATCHes cursorState), first
-- on a Neon branch of production, then on production itself. See docs/migrations/004-pipeline-cursor.md.

BEGIN;

ALTER TABLE monitored_sources ADD COLUMN IF NOT EXISTS cursor_state jsonb;
ALTER TABLE monitoring_runs_source_results ADD COLUMN IF NOT EXISTS remaining_count numeric;

COMMIT;
