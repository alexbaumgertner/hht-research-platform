# Implementation Plan: Clinical Trials and Treatments in Research

**Branch**: `008-clinical-trials` | **Date**: 2026-11-21 | **Spec**: [`spec.md`](./spec.md)

## Summary

Extend the existing trial pipeline (adapter → `trialMetadata` → feed/issue UI) in four moves, in
this delivery order so each is shippable alone:

1. **Recruiting now** (US1): richer deterministic trial metadata + a feed filter + an issue group.
2. **Status transitions** (US3): detect change at re-fetch, record once, show in the next issue.
3. **Treatments in research** (US2): intervention type (deterministic for trials, optional AI tag for papers) + stage label + view.
4. **Eligibility points and sites** (US4–US6): behind a flag until a physician has seen the calibration set.

No new source types, no new packages, no new deployables (Constitution II, VII). Schema is additive.

## Technical Context

Same stack as specs 005/006 (TypeScript, Node ≥ 24, Next.js 16, Payload 3.88 + Postgres on Neon,
Mantine, next-intl, `ai` SDK with the gateway, Jest + Playwright). Free-tier discipline (III): LLM calls capped by FR-018.

## Data model (additive)

`publications.trialMetadata` group gains (all optional):

| Field                                | Type                                        | Source (API v2 path, to verify in T001)                       |
| ------------------------------------ | ------------------------------------------- | ------------------------------------------------------------- |
| `interventions[]`                    | array `{ type, name }`                      | `armsInterventionsModule.interventions[]`                     |
| `startDate`, `primaryCompletionDate` | date text (`YYYY-MM[-DD]`)                  | `statusModule.startDateStruct`, `primaryCompletionDateStruct` |
| `enrollmentCount`                    | number                                      | `designModule.enrollmentInfo.count`                           |
| `sponsor`                            | text                                        | `sponsorCollaboratorsModule.leadSponsor.name`                 |
| `healthyVolunteers`                  | text                                        | `eligibilityModule.healthyVolunteers`                         |
| `eligibilityCriteria`                | text (cap ~8 000 chars)                     | `eligibilityModule.eligibilityCriteria`                       |
| `sites[]`                            | array `{ country, city, facility, status }` | `contactsLocationsModule.locations[]`                         |
| `hasResults`                         | checkbox                                    | top-level `hasResults`                                        |
| `registryUpdatedAt`                  | date                                        | `statusModule.lastUpdatePostDateStruct`                       |

`countries` stays (derived, uncapped; cap was `MAX_TRIAL_COUNTRIES = 10`).

`publications` also gains `interventionType` (select, set by trial extraction or AI tag) and
`researchStage` (select, closed set from the spec; derived from phase/type, **not** free text).

New small collection **`trial-transitions`**: `{ publication, fromStatus, toStatus, fromHasResults,
toHasResults, registryUpdatedAt, detectedInRun, reportedInDigest? }` with a unique index on
`(publication, fromStatus, toStatus, toHasResults)` to make FR-006 idempotent.

Digest link: see D3.

## Design

### D1 — Adapter (`apps/worker/src/adapters/clinicaltrials.ts`)

Extend the `Study` type and `extractTrialMetadata`; unknown/missing fields are omitted. Keep
`extractTrialMetadata` pure and unit-tested with captured API JSON fixtures (also covers the
schema-change edge case). Add `researchStage` derivation in `packages/shared` (pure function from
`phases` + `overallStatus`, tested): `PHASE1 → early human safety`, `PHASE2 → effectiveness`,
`PHASE3 → confirming`, `PHASE4 → approved/post-marketing`, `NA/none → observational/other`.

### D2 — Transition detection (`apps/worker/src/pipeline/runProject.ts`)

The query already returns trials updated since the watermark (`AREA[LastUpdatePostDate]RANGE`), so
a status change **arrives as a candidate** and hits the dedupe branch. Today that branch refreshes
metadata and `continue`s. Change:

1. `cms.findPublicationByDedupe` currently returns only `id`; widen to return the stored `trialMetadata.overallStatus` and `hasResults`.
2. If status or `hasResults` differs in a patient-relevant way (spec OQ3), create a `trial-transitions` row (unique index swallows duplicates), then refresh metadata.
3. Flapping A→B→A between runs: compare against the stored value only, so net-zero produces no row.
4. No LLM call for transitions. The entry is rendered from structured data and localised UI strings.

Depends on spec 004 T003 (cursor): a status change that falls into an overflowed batch must not be lost.

### D3 — Showing transitions in an issue (decision needed)

`digests` has `publications[]` and the hook `assertDigestHasPublications` forbids an empty digest
(spec 001 FR-010). A week with only status changes would publish nothing. Options:

- **A (proposed)**: add `digests.trialUpdates[]` (relationship to `trial-transitions`) and relax the no-empty rule to "at least one publication **or** one trial update". Issue page renders an "Updates to trials you may follow" block.
- **B**: re-open the publication by creating a _new_ publication row per transition (title "Update: …"). Simpler schema, but pollutes the feed and the dedupe key.
- **C**: show updates only on the trial detail page and in the feed badge, not in the issue. Smallest change, weakest for the patient.

Recommendation: A. Needs owner confirmation because it changes FR-010 semantics. **[Open: OQ in PR]**

### D4 — Web (`apps/web`)

- `lib/materials.ts`: extend `TrialInfo` (interventions, dates, sites, stage); add `filterMaterials` option `recruitingNow`.
- `components/MaterialsFeed.tsx`: "Recruiting now" switch (pattern: `HighImportanceSwitch.tsx`), sorted by `registryUpdatedAt` desc.
- `components/IssueView.tsx`: group "Recruiting now" before papers; update entries block (D3-A).
- `components/MaterialCard.tsx` / `MaterialDetailView.tsx`: intervention names, plain-words phase, countries (collapsed beyond 5), age/sex, registry link primary; detail adds dates, enrolment, sponsor, sites with locale-relevant countries first.
- New "Treatments in research" view: `apps/web/src/app/[locale]/projects/[slug]/treatments/page.tsx`, grouped by `interventionType`, with `TrustNotice` and the stage label. Reuses the materials API (new query params), no new endpoint family.
- i18n: new keys in `messages/{en,ru,de,tr,uk}.json`; the existing parity unit test guards drift.
- Caching: public routes are cached (PR #21). New views must tag/invalidate consistently with `docs/public-caching.md` (open PR #21 — rebase on it before implementing).

### D5 — AI parts (worker, behind flags)

- **Paper intervention tag**: add one field to the existing `summarizeAndRank` schema (no extra call). Prompt: "state the type only if the abstract names it, else `unspecified`". Output validated by zod enum.
- **Eligibility points**: one call per newly recruiting trial, only if `ELIGIBILITY_POINTS=1`. Prompt reuses the `untrusted_content` wrapping from `ai.ts`; output ≤ 6 short points; instruction forbids "you are eligible/not eligible". Stored on the publication as `eligibilityPoints` (en) and translated by the existing path.

## Research (T001–T003)

- **R1**: Capture real API v2 responses for 5 HHT trials; confirm every field path in the table; note `hasResults`, per-site `status` and result-posting behaviour.
- **R2**: Verify what `extractReferenceIds` (PR #17) stores for papers citing NCT ids and whether the UI links them (US edge case).
- **R3**: Decide with the owner D3 A/B/C and the transition list (OQ3) before T009.

## Testing

- Jest `apps/worker`: adapter extraction fixtures; transition detection (status change, no change, flapping, results posted, duplicate run); stage derivation (`packages/shared`).
- Jest `apps/web`: `materials.ts` filter, `normalizeTrialInfo` extended, i18n key parity.
- Playwright: feed "Recruiting now" filter; issue group order; update block; Treatments view disclaimer; 360 px layout (no horizontal scroll) in `ru`.
- Safety checks in test data: assert no card/update string contains forbidden phrases list ("cure", "effective treatment" …) for generated fixtures; calibration set review by owner/physician is manual (FR-017).

## Rollout

1. Merge 004 cursor (T003) first, or rebase on it.
2. Schema is additive; `ensure-schema` handles it (PR #20). Run `pnpm migrate`/`db:generate` per repo rules, **ask first**, no production DB access from agents.
3. Backfill existing trials with new metadata via a script modelled on `apps/worker/src/scripts/backfill-source-metadata.ts` (run by the owner).
4. Turn on the Treatments view and `ELIGIBILITY_POINTS` separately from the first release.

## Constitution Check

I spec-first ✓. II scope: no new source types; transitions collection is the only new collection and is required for idempotence ✓. III: LLM calls bounded (FR-018) ✓. IV public by default ✓. V maintainability: pure functions + fixtures ✓. VI i18n ✓ (5 locales). VII: worker detects, web renders ✓. IX tests ✓. **Flag**: D3-A relaxes spec 001 FR-010 (no empty digest); needs an amendment note in 005.
