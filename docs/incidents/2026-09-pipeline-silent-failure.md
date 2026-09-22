# Incident: monitoring pipeline silently published nothing (2026-08-31 → 2026-09-22)

| Field      | Value                                                                   |
| ---------- | ----------------------------------------------------------------------- |
| Status     | Fix ready (worker); recovery steps pending                              |
| Duration   | 2026-08-31 21:00 UTC → fix deploy (22+ days)                            |
| Impact     | No new digests for project `hht`; September PubMed papers skipped       |
| Detected   | 2026-09-22, by an external look at the public site, not by monitoring   |
| Root cause | Worker sent `monitoredSource` as a string id; Payload rejected it (400) |

## Summary

Every `POST /api/publications` from the worker failed with HTTP 400:

```
The following field is invalid: Monitored Source
This relationship field has the following invalid relationships: 4 0
```

Cloud Scheduler and the Cloud Run Job kept running every hour and exiting 0, so everything looked
green. No digest was published for `hht` after 2026-08-31 17:02 UTC.

## Root cause

- Commit `984ec9b` (2026-08-30) started sending `monitoredSource: source.id` when creating
  publications.
- `CmsClient.listDueProjects` normalized source ids with `String(s.id)`, so `4` became `"4"`.
- On Postgres, Payload ids are numeric. Payload only coerces relationship ids to numbers when the
  related collection declares an explicit `id` field. Otherwise the `relationship` validator calls
  `isValidID("4", "number")`, which returns `false` before any DB lookup. Access control is not
  involved.
- The change reached production with the first CI-built worker image (2026-08-31 21:00 UTC,
  `deploy-worker.yml`). The last good run (17:02 UTC) used the image built manually on 2026-08-28,
  which predates `984ec9b`.

## Why data was lost, not just delayed

The 400 is thrown after classify and summarize, inside the per-source `try` in `runProject`. So:

1. The PubMed source fails on its first new item.
2. ClinicalTrials.gov has 0 new items, so it "succeeds".
3. The run resolves to `completed_partial_failure`, which advances `lastSuccessfulRunAt` for **all**
   sources, as FR-020 requires.
4. PubMed items from each failed window are never fetched again.

The seed project `hht-research` failed on every source, so its watermark never advanced. It
re-ran every hour and made LLM calls each time.

## Why nobody noticed

1. Source and project errors were stored only in `monitoring-runs.sourceResults[].error`. That
   collection is auth-only, and the errors were never written to stdout or Cloud Logging.
2. The job exits 0 whenever per-project errors are caught, so Cloud Run and Scheduler report
   success.
3. There was no alert policy and no heartbeat.
4. FR-010 (no empty digest) makes "broken" look the same as "no news".
5. The public site shows no "last checked" date.
6. The seed project's digest (2026-09-01) made the site look recently updated.
7. No test covered the worker → Payload REST contract.

## Fix

- `apps/worker/src/cms/client.ts`: introduce `CmsId = string | number`, and pass Payload ids back
  unchanged. The id is stringified only for URL query parameters.
- `apps/worker/src/pipeline/runProject.ts`: `ProjectForRun` ids use `CmsId`.
  `sourceResults.sourceId` (a text field) stays a string.
- Regression test: `apps/worker/src/cms/client.test.ts`. Payload returns `id: 4`, and the test
  asserts the worker keeps it as `4`. It fails with `Received: "4"` without the fix.

## Recovery (manual, in order)

1. **Before deploying:** pause the seed project `hht-research` in Admin. Otherwise it starts
   publishing real items (roadmap H2).
2. Deploy the worker by merging to `main`, which triggers `deploy-worker.yml`.
3. Set `hht.lastSuccessfulRunAt` to `2026-08-31T17:00:00Z` so the lost window is fetched once
   (roadmap H4).
4. Verify: the next `hht` run returns `201` on `POST /api/publications` (Vercel runtime logs), and a
   new digest appears on `/ru/projects/hht`.

## Follow-ups

Tracked in [`docs/roadmap-2026-q4.md`](../roadmap-2026-q4.md):

- **Spec 004 `pipeline-health`:** log run and source errors at ERROR, add a GCP log-based alert
  and a heartbeat (dead-man switch), stop advancing the watermark for failed sources, reap stale
  `running` runs, add public "last checked" / `/api/health`.
- **H2:** remove the seed data from production and guard `seed-public-feed.ts` against remote
  databases.
- Consider a CI contract test that creates a publication through Payload REST with the exact
  payload the worker sends.
