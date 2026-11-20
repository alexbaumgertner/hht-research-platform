# Implementation Plan: Pipeline Health (gap closure)

**Branch**: `004-pipeline-health` | **Date**: 2026-11-21 | **Spec**: [`spec.md`](./spec.md)

## Summary

Close the four open gaps (G1–G4) without touching what already works. Worker: replace
`clampBatch` + "watermark = start of run" with a **cursor that stops at the oldest unprocessed
candidate**. Web: expose and render last-checked time. Ops: run and record the failure drill,
write the "verify monitoring" checklist.

## Technical Context

Same stack as spec 005 (TypeScript/Node ≥ 24, Next.js 16, Payload 3 + Postgres, Jest). **No new
packages. No new collections.** Schema change is additive: one optional field on the monitoring-run
`sourceResults` item (`remainingCount`).

**Constraints**: Constitution III (free tier; no extra LLM calls), VII (worker owns fetching and
watermarks, web only reads), IX (tests precede implementation where practical).

## Design

### G1 — cursor instead of clamp

Current flow (`apps/worker/src/pipeline/runProject.ts`): `fetchCandidates({ limit: batchSize })` →
`clampBatch` → process → `patchSourceWatermark(source.id, startedAt)`.

Proposed flow:

1. Fetch candidates since the source watermark, request `batchSize + 1` (or use adapter paging).
2. If more than `batchSize` came back, **overflow = true**.
3. Sort the processed batch by its own date ascending; on overflow set the watermark to the date of
   the newest _processed_ candidate (not `startedAt`), so the next run starts there. On no overflow
   keep today's behaviour (`startedAt`).
4. Candidates with identical timestamps at the boundary are safe: the next run re-fetches them and
   dedupe skips them (existing behaviour).
5. Record `remainingCount` (unknown exact count → `>= 1`; store the number returned beyond the batch).

**Risk**: adapters do not guarantee ordering (see Research R1). If an adapter cannot be ordered by
date, fall back to fetching with explicit sort or paging until the date window is exhausted, capped
at N pages.

### G2 — drill

No code. A one-off Cloud Run execution with an invalid AI key; record timestamps. Add a section to
`docs/deploy-worker.md` ("Failure drill") with the exact commands and a results table.

### G3/G4 — last checked, thresholds

- `apps/web/src/app/api/public/projects/[slug]/route.ts` already returns `lastSuccessfulRunAt`; render
  it on the project page (`apps/web/src/app/[locale]/projects/[slug]/page.tsx`) with a new i18n key in all five locales.
- `apps/web/src/app/api/health/route.ts` + `lib/health.ts`: threshold derived from project cadence
  (spec FR-009). The CDN cache TTL of 6 h (PR #19) bounds alert latency; document the interaction.

## Research (before tasks T00x start)

- **R1**: ordering guarantees of PubMed ESearch (`sort=pub+date` vs EDAT) and ClinicalTrials.gov v2
  (`sort=LastUpdatePostDate:asc`). Needed for the cursor to be correct.
- **R2**: whether the stale-run reaper (2 h) conflicts with a long catch-up run (task timeout is 30 min, so it should not).

## Testing

- Jest (worker): stub adapter with `batchSize + N`; boundary timestamps; source failure mid-batch; zero items.
- Jest (shared/web): health threshold per cadence.
- Playwright: project page shows last-checked text in `ru` and `en`.
- Manual: failure drill.

## Rollout

Worker image deploys via `deploy-worker.yml` on merge. No data migration. Existing watermarks keep their meaning (they are always "all processed up to here").

## Constitution Check

I (spec first): satisfied by this spec. II (scope): no new source types. III: no new paid calls (FR-012). VI: new copy in 5 locales. VII: cursor logic in worker only. IX: tests listed. No violations.
