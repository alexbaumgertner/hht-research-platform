# Tasks: Pipeline Health (gap closure)

**Input**: [spec.md](./spec.md), [plan.md](./plan.md). **Estimate**: about 2 evenings. Status: Draft.

Format: `[ID] [P?] [Story] Description`. `[P]` = parallelisable.

## Phase 1: Research

- [ ] T001 [US1] Record ordering guarantees of PubMed ESearch and ClinicalTrials.gov v2 (sort params, paging) in `specs/004-pipeline-health/research.md`.

## Phase 2: US1 — no lost items (P1)

- [ ] T002 [US1] Test first: stub adapter with `batchSize + N` candidates, boundary timestamps, mid-batch failure, zero items, in `apps/worker/src/pipeline/runProject.test.ts` (new) and `publish.test.ts`.
- [ ] T003 [US1] Replace `clampBatch` usage with overflow-aware selection and cursor watermark in `apps/worker/src/pipeline/publish.ts` and `runProject.ts`.
- [ ] T004 [P] [US1] Add optional `remainingCount` to `sourceResults` in `apps/web/src/collections/MonitoringRuns.ts`; worker writes it in `apps/worker/src/cms/client.ts`; `pnpm --filter @hht/web generate:types`.
- [ ] T005 [US1] ERROR log when `remainingCount > 0` for 3 consecutive runs (per source) in `runProject.ts`.

## Phase 3: US2 — drill (P1)

- [ ] T006 [US2] Write "Failure drill" section with commands and results table in `docs/deploy-worker.md`. **Owner action**: run the drill (needs production access; agents must not touch production).
- [ ] T007 [US2] Record result (date, alert delay) in the same section.

## Phase 4: US3 — quiet week vs broken (P2)

- [ ] T008 [US3] Test first: per-cadence threshold in `apps/web/src/lib/health.test.ts`.
- [ ] T009 [US3] Implement cadence-aware threshold in `apps/web/src/lib/health.ts` (after Open Question 2 is answered).
- [ ] T010 [P] [US3] Render last-checked on the project page; i18n keys in `apps/web/messages/{en,ru,de,tr,uk}.json`.
- [ ] T011 [US3] Playwright check for the last-checked text in `ru` and `en`.

## Phase 5: US4 — monitoring checklist (P3)

- [ ] T012 [US4] Add "Verify monitoring" checklist to `docs/deploy-worker.md`; **owner action**: confirm `hht-health` host (Open Question 4).

## Done when

SC-001–SC-004 hold; `pnpm lint && pnpm format:check && pnpm typecheck && pnpm test` and `pnpm test:e2e` green.
