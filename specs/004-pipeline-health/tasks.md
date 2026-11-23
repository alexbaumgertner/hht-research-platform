# Tasks: Pipeline Health (gap closure)

**Input**: [spec.md](./spec.md), [plan.md](./plan.md). **Estimate**: about 2 evenings. Status: Draft.

Format: `[ID] [P?] [Story] Description`. `[P]` = parallelisable.

## Phase 0: Rollout decision

- [x] T000 Decide historical replay (plan Rollout, Open Question 1): document unrecovered pre-release omissions, or the owner runs a bounded replay of the last 30 days with an LLM cost cap.

## Phase 1: Research

- [x] T001 [US1] Record ordering guarantees of PubMed ESearch and ClinicalTrials.gov v2 (sort params, paging) in `specs/004-pipeline-health/research.md`.

## Phase 2: US1 — no lost items (P1)

- [x] T002 [US1] Test first: stub adapter with `batchSize + N` candidates, **3 × batchSize on a single boundary day**, cursor key differs from display date (PubMed EDAT vs electronic/future journal date), **a multi-run test that drains more than one batch sharing one day**, undated RSS candidates, mid-batch failure, zero items, in `apps/worker/src/pipeline/runProject.test.ts` (new) and `publish.test.ts`.
- [x] T003 [US1] Replace `clampBatch` usage with overflow-aware selection and cursor watermark in `apps/worker/src/pipeline/publish.ts` and `runProject.ts`.
- [x] T004 [P] [US1] Add optional `remainingCount` to `sourceResults` in `apps/web/src/collections/MonitoringRuns.ts` and optional `cursorState` (JSON) to `apps/web/src/collections/MonitoredSources.ts`; adapters return `cursorKey` in `apps/worker/src/adapters/{pubmed,clinicaltrials}.ts`; worker writes it in `apps/worker/src/cms/client.ts`; `pnpm --filter @hht/web generate:types`.
- [x] T005 [US1] ERROR log when `remainingCount > 0` for 3 consecutive runs (per source) in `runProject.ts`.

## Phase 3: US2 — drill (P1)

- [x] T006 [US2] Write "Failure drill" section in `docs/deploy-worker.md`: controlled due project + a candidate that reaches an AI call, confirm the auth `ERROR` before timing the alert, cleanup steps, results table. **Owner action**: run the drill (needs production access; agents must not touch production). Section written; drill not yet run.
- [ ] T007 [US2] Record result (date, alert delay) in the same section.

## Phase 4: US3 — quiet week vs broken (P2)

- [x] T008 [US3] Regression check (already shipped): confirm `isProjectStale` tests cover daily, weekly-anchored and grace-period cases in `packages/shared/src/schedule.test.ts`; add only missing cases.
- [x] T009 [US3] Owner chose daily checks with a 26 h threshold (Open Question 2): `lastCheckedAt` on `research-projects` (SQL `apps/web/scripts/sql/004-last-checked-at.sql`, owner applies), worker `checkProject` daily lightweight check for projects not due for a run, `isCheckStale`/`isCheckDue` in `packages/shared/src/schedule.ts`, `/api/health` and `lib/health.ts` read it, project page shows the newer of check and run.
- [x] T010 [P] [US3] Regression check (already shipped): the project page renders `lastChecked` in all five locales. Only the wording/visibility may change (Open Question 3).
- [x] T011 [US3] Ensure a test asserts the last-checked text in `ru` and `en`; add if missing.

## Phase 5: US4 — monitoring checklist (P3)

- [x] T012 [US4] Add "Verify monitoring" checklist to `docs/deploy-worker.md`; **owner action**: confirm `hht-health` host (Open Question 4).

## Done when

SC-001–SC-004 hold; `pnpm lint && pnpm format:check && pnpm typecheck && pnpm test` and `pnpm test:e2e` green.
