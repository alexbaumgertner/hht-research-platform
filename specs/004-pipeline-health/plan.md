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
`sourceResults` item (`remainingCount`) and one optional `cursorState` JSON field on `monitored-sources`.

**Constraints**: Constitution III (free tier; no extra LLM calls), VII (worker owns fetching and
watermarks, web only reads), IX (tests precede implementation where practical).

## Design

### G1 — cursor instead of clamp

Current flow (`apps/worker/src/pipeline/runProject.ts`): `fetchCandidates({ limit: batchSize })` →
`clampBatch` → process → `patchSourceWatermark(source.id, startedAt)`.

Proposed flow:

1. Fetch candidates since the source watermark, request `batchSize + 1` (or use adapter paging).
2. If more than `batchSize` came back, **overflow = true**.
3. **Cursor is the source's own query key, not the display date.** PubMed is queried with
   `datetype=edat`, ClinicalTrials.gov with `LastUpdatePostDate`. The cursor MUST be expressed in
   that key. `Candidate.publishedOrUpdatedAt` (electronic/journal date, may even be in the future)
   MUST NOT be used. Adapters therefore return, per candidate, a `cursorKey` (EDAT / last-update
   date at full available precision) in addition to the display date.
4. Process candidates in ascending `cursorKey` order. On overflow set the watermark to the
   `cursorKey` of the newest _processed_ candidate (not `startedAt`). With no overflow keep today's
   behaviour (`startedAt`).
5. **Progress across equal-key boundaries.** Both sources query at day precision, so more than one
   batch can share the boundary day; an inclusive re-fetch would then return the same candidates
   forever. Therefore persist, per source, a small `cursorState`:
   `{ boundaryKey, processedIds[] }` (ids already handled at the boundary day). The next run
   excludes `processedIds` _before_ applying the batch limit (or pages past them with the adapter's
   offset/page token). Once the boundary day is exhausted the watermark moves to the next day and
   `cursorState` is cleared. If a page cap is reached before the boundary day is exhausted, the run
   persists `cursorState` and continues from it next run (never restarts from the day's start).
   Candidates without a source-native key (undated RSS items) keep today's rule: they are processed
   in the run that sees them and never move the watermark backwards. Tests: a multi-run test that
   drains `3 × batchSize` candidates sharing one day (each run's selection limit is spent only on
   unprocessed items), and a case where the display date differs from the query key.
6. Record `remainingCount` (unknown exact count → `>= 1`; store the number returned beyond the batch).

**Risk**: adapters do not guarantee ordering (see Research R1). If an adapter cannot be ordered by
date, fall back to fetching with explicit sort or paging until the date window is exhausted, capped
at N pages.

### G2 — drill

No code. A one-off Cloud Run execution that is **guaranteed to reach an AI call**: an invalid AI key
alone proves nothing, because `listDueProjects` skips projects outside their cadence and
`runProject` skips AI calls for deduplicated candidates. The drill therefore requires (1) a
controlled project that is due now (temporary test project, or the owner forces a manual run) and
(2) at least one new candidate that reaches an AI operation. Before measuring alert delay, confirm
the expected authentication `ERROR` log entry exists; if it does not, the drill is invalid. Document
cleanup: restore the real AI key, delete the test project and any candidate/publication it created,
and confirm the next scheduled run succeeds. Add a section to `docs/deploy-worker.md` ("Failure
drill") with the exact commands, the cleanup steps and a results table.

### G3/G4 — last checked, thresholds (mostly shipped)

Verified on `main`: the project page already renders `t('lastChecked', …)` (key exists in all five
locales) and `lib/health.ts` already delegates to `isProjectStale` in `packages/shared`, which applies
project cadence, weekly anchors and a six-hour grace period. These are **shipped behaviour with
regression checks, not new implementation**. What remains is an owner-policy question only:

- Whether the existing stale rule is the right alert threshold for a weekly project (Open Question 2).
  If the answer is "keep", no code changes; if "change", extend `isProjectStale` (keeping anchored
  scheduling semantics, not replacing it with a flat constant) and its tests in `schedule.test.ts`.
- Whether patients keep seeing `lastChecked` (Open Question 3).
- The CDN cache TTL of 6 h (PR #19) bounds alert latency; document the interaction in the runbook.

## Research (before tasks T00x start)

- **R1**: ordering guarantees of PubMed ESearch (`sort=pub+date` vs EDAT) and ClinicalTrials.gov v2
  (`sort=LastUpdatePostDate:asc`). Needed for the cursor to be correct.
- **R2**: whether the stale-run reaper (2 h) conflicts with a long catch-up run (task timeout is 30 min, so it should not).

## Testing

- Jest (worker): stub adapter with `batchSize + N`; boundary timestamps; **multi-run drain of more than one batch on the same day**; cursor key differing from display date; undated RSS candidates; source failure mid-batch; zero items.
- Regression only (already shipped): `isProjectStale` per cadence (`schedule.test.ts`), last-checked text in `ru` and `en` (existing e2e/unit if present; add only if missing).
- Manual: failure drill.

## Rollout

Worker image deploys via `deploy-worker.yml` on merge. Schema change is additive (no backfill needed for it).

**Historical omissions are not recovered by the deploy.** Existing watermarks do NOT prove that all
earlier candidates were processed: the current limited fetch advanced to `startedAt` even when
candidates were omitted (G1). Keeping them unchanged only prevents future loss. Either (a) document
that pre-release overflow stays unrecovered, or (b) the owner runs a bounded replay (reset each
source watermark by N days, relying on dedupe to skip already-stored items, with a cost cap on LLM
calls). Decide in Open Question 1; default: (b) for the last 30 days only.

## Constitution Check

I (spec first): satisfied by this spec. II (scope): no new source types. III: no new paid calls (FR-012). VI: new copy in 5 locales. VII: cursor logic in worker only. IX: tests listed. No violations.
