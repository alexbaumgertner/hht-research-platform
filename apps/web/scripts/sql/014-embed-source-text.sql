-- Spec 014 (Embeddable Widget): partner attribution values like `site:<key>` can't be a Postgres enum.
-- Turns subscribers.source and analytics_counts.source from enums into varchar, and adds the two
-- widget metrics. Existing values are kept as they are. Safe to run more than once.
--
-- Run it BEFORE deploying the code that needs it, first on a Neon branch of production, then on
-- production itself. See docs/migrations/014-embed-source.md.

BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'subscribers'
      AND column_name = 'source' AND data_type = 'USER-DEFINED'
  ) THEN
    ALTER TABLE subscribers ALTER COLUMN source DROP DEFAULT;
    ALTER TABLE subscribers ALTER COLUMN source TYPE varchar USING source::text;
    ALTER TABLE subscribers ALTER COLUMN source SET DEFAULT 'other'::varchar;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'analytics_counts'
      AND column_name = 'source' AND data_type = 'USER-DEFINED'
  ) THEN
    -- The unique index on (project_id, issue_key, source, metric) is rebuilt by this statement.
    ALTER TABLE analytics_counts ALTER COLUMN source TYPE varchar USING source::text;
  END IF;
END
$$;

DROP TYPE IF EXISTS enum_subscribers_source;
DROP TYPE IF EXISTS enum_analytics_counts_source;

COMMIT;

-- ADD VALUE can't be used in the same transaction that created the value, so it runs on its own.
ALTER TYPE enum_analytics_counts_metric ADD VALUE IF NOT EXISTS 'widget_view';
ALTER TYPE enum_analytics_counts_metric ADD VALUE IF NOT EXISTS 'outbound_click';
