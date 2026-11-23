-- Spec 004 (Pipeline Health, T009): daily source check timestamp.
--   research_projects.last_checked_at  timestamptz  (nullable, no default, no backfill)
-- Payload `date` fields are timestamp(3) with time zone. Idempotent; a no-op once ensure-schema
-- has added the column. Run BEFORE deploying the worker image that PATCHes `lastCheckedAt`
-- (first on a Neon branch of production, then on production). NOT executed by the agent.
-- See docs/migrations/004-last-checked-at.md.

BEGIN;

ALTER TABLE research_projects
  ADD COLUMN IF NOT EXISTS last_checked_at timestamp(3) with time zone;

COMMIT;
