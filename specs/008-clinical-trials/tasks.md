# Tasks: Clinical Trials and Treatments in Research

**Input**: [spec.md](./spec.md), [plan.md](./plan.md). **Estimate**: about 5 evenings for Release 1 (US1 + US3), +3 for Release 2 (US2, US4–US6). Status: Draft.

Format: `[ID] [P?] [Story] Description`. `[P]` = parallelisable. Tests precede implementation.

## Phase 1: Research and decisions

- [ ] T001 Capture API v2 fixtures for 5 HHT trials and confirm field paths in `apps/worker/src/adapters/__fixtures__/clinicaltrials/*.json` (plan R1).
- [ ] T002 [P] Check what `extractReferenceIds` stores and shows (plan R2); note result in `specs/008-clinical-trials/research.md`.
- [ ] T003 Owner decisions recorded in spec Clarifications: D3 A/B/C, OQ1–OQ7.

## Phase 2: Release 1a — US1 Recruiting now (P1)

- [ ] T004 [US1] Tests: extended `extractTrialMetadata` on fixtures (interventions, dates, sites, `hasResults`, missing fields) in `apps/worker/src/adapters/clinicaltrials.test.ts`.
- [ ] T005 [US1] Extend `Study` type and `extractTrialMetadata`; drop the 10-country cap in `apps/worker/src/adapters/clinicaltrials.ts` and `types.ts`.
- [ ] T006 [US1] Extend `trialMetadata` fields in `apps/web/src/collections/Publications.ts`; `pnpm --filter @hht/web generate:types`; migration per repo rules (ask first).
- [ ] T007 [P] [US1] `researchStage` pure function + tests in `packages/shared/src/` (`trialStage.ts`, `trialStage.test.ts`).
- [ ] T008 [US1] Tests: server-side `status=recruiting` in the materials API **including a recruiting trial outside the first 200 feed records**, pagination, and extended `normalizeTrialInfo` (`apps/web/src/lib/materials.test.ts`, API route test).
- [ ] T009 [US1] Implement the `status=recruiting` query parameter (filter before limit/pagination) in the materials API and extended `TrialInfo` in `apps/web/src/lib/materials.ts`; the feed switch sets the parameter.
- [ ] T010 [P] [US1] "Recruiting now" switch in `apps/web/src/components/MaterialsFeed.tsx`; trial card fields in `MaterialCard.tsx`.
- [ ] T011 [US1] "Recruiting now" group in `apps/web/src/components/IssueView.tsx`.
- [ ] T012 [P] [US1] i18n keys in `apps/web/messages/{en,ru,de,tr,uk}.json`.
- [ ] T013 [US1] Playwright: filter, group order, 360 px layout in `apps/web/tests/e2e/`.
- [ ] T014 [US1] Backfill script for existing trials (owner runs it): `apps/worker/src/scripts/backfill-trial-metadata.ts`.

## Phase 3: Release 1b — US3 Status transitions (P1)

- [ ] T015 [US3] Tests: transition detection (change, none, flapping, results posted, duplicate run, **repeated A→B→A→B occurrences reported twice**, **irrelevant trial / no `feedPublishedAt` records no public update**) in `apps/worker/src/pipeline/trialTransitions.test.ts`.
- [ ] T016 [US3] Widen `findPublicationByDedupe` result in `apps/worker/src/cms/client.ts`; detect and record transitions in `runProject.ts` dedupe branch (depends on 004 T003).
- [ ] T017 [US3] New `trial-transitions` collection with unique index in `apps/web/src/collections/TrialTransitions.ts`; register in `payload.config.ts`; access: worker create, public none.
- [ ] T018 [US3] Per chosen D3 option: `digests.trialUpdates` + relax `assertDigestHasPublications` in `apps/web/src/collections/Digests.ts` and `digestHooks.ts`; amend spec 005 note.
- [ ] T018a [US3] (D3-A) Publication gate: `shouldPublishDigest` accepts zero publications with non-empty `trialUpdates`; issue-text generation and readiness work from update items; public issue API maps `trialUpdates`; re-check visibility when attaching and loading updates.
- [ ] T019 [US3] Worker attaches unreported transitions to the next digest; marks `reportedInDigest`.
- [ ] T020 [P] [US3] Update block in `IssueView.tsx` and email template in `apps/worker/src/notify/` (spec 006 issue email) — check email renders updates.
- [ ] T021 [US3] Playwright + integration: one entry, then none, on rerun; **integration test delivers an update-only issue to subscribers** (issue text `ready`, email sent).

**Release 1 checkpoint**: owner reviews the first issue with real data; sends calibration set (FR-017) to the physician.

## Phase 4: Release 2a — US2 Treatments in research (P1)

- [ ] T022 [US2] Tests: intervention-type mapping from registry types; paper tag zod enum; stage label mapping.
- [ ] T023 [US2] Add `interventionType`, `researchStage` to `Publications.ts`; trial values from registry in the worker.
- [ ] T024 [US2] Add optional intervention tag to the `summarizeAndRank` schema/prompt in `apps/worker/src/pipeline/ai.ts` (no extra call).
- [ ] T025 [US2] Treatments view route `apps/web/src/app/[locale]/projects/[slug]/treatments/page.tsx` + cache tags per `docs/public-caching.md`.
- [ ] T026 [P] [US2] `TrustNotice` on the view; i18n keys in 5 locales; Playwright for disclaimer and stage labels.
- [ ] T026a [US2] "Now approved" label («Теперь одобрено · <кем>») for an approval of a known drug for a new indication: needs a cited regulator source (authority and date); without one, show the stage label only. Tests: label with source, no label without source, 5 locales.

## Phase 5: Release 2b — US4, US5, US6 (P2/P3)

- [ ] T027 [US5] Sites list on `MaterialDetailView.tsx` with locale-relevant countries first (config from OQ1) + test.
- [ ] T028 [P] [US6] Dates/enrolment/sponsor on detail page + tests (missing values omitted).
- [ ] T029 [US4] Eligibility points generator behind `ELIGIBILITY_POINTS`: prompt with `untrusted_content` wrapper, zod ≤ 6 points, forbidden-phrase test, in `apps/worker/src/pipeline/ai.ts` (or `eligibility.ts`).
- [ ] T029a [US4] Translation of `eligibilityPoints`: storage per locale, translation-contract and public-reader changes, English fallback, re-translate on criteria change, locale tests; budget under FR-018.
- [ ] T030 [US4] Render points (in the reader's locale) + AI label + "only the study team decides" on the detail page; structured facts first.
- [ ] T031 Prepare the calibration set (≥ 15 items) as a doc in `docs/launch/` for the physician (FR-017). **Owner action**: send and collect written feedback.

## Done when

SC-001–SC-005 hold; `pnpm lint && pnpm format:check && pnpm typecheck && pnpm test && pnpm test:e2e` green; docs updated (`docs/public-caching.md`, README feature list).
