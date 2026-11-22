# Feature Specification: Clinical Trials and Treatments in Research

**Feature Branch**: `008-clinical-trials`

**Created**: 2026-11-21

**Status**: Draft (owner approval pending)

**Input**: Roadmap 2026 Q4 §6 row 008, finding F13; owner feedback 2026-11-21: ~15 patients read the digest via a VK chat and care most about **research on new drugs and new treatment methods**.

## Context: what PR #17 already shipped

PR #17 (merged 2026-10-31) added patient-facing trial basics. This spec covers **only the gap**.

| Capability                                                                                                                | State in `main`     | Evidence                                                                |
| ------------------------------------------------------------------------------------------------------------------------- | ------------------- | ----------------------------------------------------------------------- |
| Trials fetched from ClinicalTrials.gov by keyword and `LastUpdatePostDate`                                                | Shipped             | `apps/worker/src/adapters/clinicaltrials.ts`                            |
| Trial metadata: overall status, phases, up to 10 countries, min/max age, sex                                              | Shipped             | `extractTrialMetadata`, `trialMetadata` group in `Publications.ts`      |
| Recruitment status normalised (`recruiting`, `notYetRecruiting`, `active`, `completed`, `other`) and shown on card/detail | Shipped             | `apps/web/src/lib/materials.ts` (`normalizeTrialInfo`)                  |
| Cautious wording for pre-results trials (no invented "Results")                                                           | Shipped             | `ai.ts` (`trialOverallStatus` input)                                    |
| Trial metadata refreshed on re-fetch of a known NCT id                                                                    | Shipped, **silent** | `runProject.ts` dedupe branch calls `updatePublication` and `continue`s |
| Trials in the feed as a source category and in issues                                                                     | Shipped             | `MaterialSource = 'trials'`, spec 005                                   |
| **"Recruiting now" view / filter**                                                                                        | **Missing**         | `MaterialsFeed.tsx` filters only by text, source, importance            |
| **What is being tested** (drug / procedure / device, name, stage)                                                         | **Missing**         | `armsInterventionsModule` not fetched                                   |
| **Where** (cities/facilities, per-site status), countries cap 10                                                          | **Partial**         | countries only                                                          |
| **Plain-language eligibility**                                                                                            | **Missing**         | `eligibilityCriteria` text not fetched; only age/sex                    |
| **Dates** (start, primary completion), enrolment, sponsor                                                                 | **Missing**         | not fetched                                                             |
| **Status change appears in the next issue**                                                                               | **Missing**         | dedupe branch never creates a digest entry                              |
| Results-posted flag                                                                                                       | **Missing**         | not fetched                                                             |

## Clarifications

### Session 2026-11-21

- Q: Ordering relative to `007-importance-rubric`? → A: This spec goes **first** for Stage 2 because the audience's stated priority is new drugs/treatments and trials; 007 follows in a reduced form (study-type tag only; see PR description). **[OWNER TO CONFIRM]**
- Q: Is a trial section a new content type or a view over existing publications? → A: A **view and metadata extension** over existing `publications` with `sourceType = clinicaltrials`. No new collection for trials themselves (Constitution II). Status-change events need a small addition to digests (plan §Design D3).

## User Scenarios & Testing _(mandatory)_

### User Story 1 - See which studies I could actually join (Priority: P1)

A patient (or relative) opens the latest issue or the feed and sees a clearly separated
"Recruiting now" group of trials: what is being tested, the phase in plain words, where it runs,
who it is open to (age, sex, a few key conditions), and a link to the official registry entry.

**Why this priority**: Participation is the most concrete thing a patient can do with research news. Today recruiting trials are mixed with papers and cannot be filtered.

**Independent Test**: With seeded publications of mixed recruitment statuses, open the issue and the feed with the "Recruiting now" filter; only `recruiting` and `notYetRecruiting` trials appear, each with intervention, phase, countries/cities, age/sex and the registry link.

**Acceptance Scenarios**:

1. **Given** an issue contains trials with statuses recruiting, not-yet-recruiting and completed, **When** the reader opens it, **Then** recruiting and not-yet-recruiting trials are shown in a "Recruiting now" group before papers, and completed ones are not in that group.
2. **Given** the feed, **When** the reader switches on the "Recruiting now" filter, **Then** only open-to-join trials are listed, newest status update first.
3. **Given** a trial card, **When** it renders, **Then** it shows status, phase in plain words (e.g. "early safety study", "tests whether it works"), the tested intervention name(s), countries, and the age/sex limits.
4. **Given** a trial card on a 360 px screen, **When** the reader scrolls, **Then** no horizontal scrolling is needed and the registry link is a primary action.
5. **Given** a trial has no recruitment status in the registry, **When** it renders, **Then** it is not shown as recruiting (shown as "status unknown").

---

### User Story 2 - Know what is new in treatments (Priority: P1)

A "Treatments in research" view groups items by **what is being studied**: a medicine, a
procedure/surgery, a device, gene or cell therapy, supportive care, or a diagnostic. Each carries an
honest research-stage label so nobody mistakes an early study for an available treatment.

**Why this priority**: This is the owner's stated patient interest. It also directly answers "what is new this week" in a way a patient can act on (ask the doctor, consider a trial).

**Independent Test**: With seeded trials and papers having intervention types, open the Treatments view and confirm grouping by type, a stage label on every item, and a visible "not a recommendation" notice.

**Acceptance Scenarios**:

1. **Given** a trial, **When** it is ingested, **Then** its intervention type and names are taken **deterministically** from the registry (`armsInterventionsModule`), not from an LLM.
2. **Given** a paper, **When** it is ingested, **Then** an intervention type tag is proposed by the LLM only if the abstract states one, otherwise `unspecified`; the tag is labelled as AI-generated in the UI.
3. **Given** any item in the Treatments view, **When** it renders, **Then** it shows a research stage from this closed set: `laboratory / animal`, `early human safety (phase 1)`, `testing effectiveness (phase 2)`, `confirming (phase 3)`, `approved/post-marketing`, `observational / other`, `unknown`.
4. **Given** the Treatments view, **When** it renders, **Then** the disclaimer "this is research, not a recommendation or an available treatment; discuss with your doctor" is visible (reuses `TrustNotice`).
5. **Given** an item reports efficacy, **When** summarised, **Then** the text uses the existing cautious-wording rules (`ai.ts`); it never states a cure or guaranteed benefit.

---

### User Story 3 - A changed trial shows up again (Priority: P1)

When a tracked trial changes in a way that matters (it starts recruiting, stops recruiting,
is suspended, terminated, withdrawn, completed, or posts results), the next issue contains a short
"Update" entry: old status → new status, date, link.

**Why this priority**: "Opens for recruitment" is the most valuable event for a patient and is currently dropped. Dedupe by NCT id means a trial is mentioned once, forever.

**Independent Test**: Seed a publication with status `NOT_YET_RECRUITING`; run the worker with a stubbed registry returning `RECRUITING`; the next issue contains one update entry for it, and a second run with no further change adds none.

**Acceptance Scenarios**:

1. **Given** a known trial changes `NOT_YET_RECRUITING → RECRUITING`, **When** the next run executes, **Then** the issue includes an update entry showing both statuses and the registry update date.
2. **Given** the same change was already reported, **When** the next run executes, **Then** it is not reported again (idempotent per transition).
3. **Given** only non-patient-relevant fields changed (contacts, descriptions), **When** the run executes, **Then** metadata is refreshed silently as today and no update entry is created.
4. **Given** a trial moves to `TERMINATED`, `SUSPENDED` or `WITHDRAWN`, **When** reported, **Then** the entry says so plainly and shows the registry's stated reason if present, without speculation.
5. **Given** results are newly posted, **When** reported, **Then** the entry links to the registry results and does **not** claim an outcome (the existing no-invented-results rule applies).

---

### User Story 4 - Understand eligibility in plain words (Priority: P2)

For a recruiting trial the reader sees, besides age and sex, a short plain-language list of the
main "who can / cannot join" points, with a link to the full official criteria.

**Why this priority**: Eligibility text in registries is dense; patients need a first filter before contacting a study team. It is P2 because it adds LLM-generated medical text and needs safety review (Open Question 2).

**Independent Test**: For a trial with criteria text, the detail page shows ≤ 6 points in the reader's language, a label "AI summary of the registry text", the original text link, and the sentence "only the study team can decide eligibility".

**Acceptance Scenarios**:

1. **Given** a trial with eligibility criteria, **When** the detail page renders, **Then** structured facts (age, sex, accepts healthy volunteers) come from registry fields and the point list is generated from the criteria text.
2. **Given** the LLM output omits or distorts a hard limit (age, sex), **When** rendered, **Then** the structured facts are shown first and are the authoritative ones.
3. **Given** a reader wonders if they qualify, **When** they read the section, **Then** the wording is never "you are eligible"; it is "may be open to people who…".

---

### User Story 5 - Where is it run (Priority: P2)

The trial shows all countries and, for the countries relevant to the reader's locale, the cities
and facilities with their own recruitment status. No geolocation of the reader is used.

**Why this priority**: Most HHT trials are in a few centres; "which country" is the first question from a patient who would have to travel.

**Independent Test**: A trial with 14 sites in 8 countries shows all 8 countries (no cap of 10), and the cities for the locale's relevant countries are visible on the detail page.

**Acceptance Scenarios**:

1. **Given** a trial with sites in more than 10 countries, **When** it renders, **Then** all countries are available (collapsed beyond a threshold), not truncated.
2. **Given** the reader's locale is `ru`, **When** the detail renders, **Then** sites in Russia, Ukraine, Belarus, Kazakhstan and Turkey (see Open Question 1) are listed first with city and facility.
3. **Given** a site's own status is `not recruiting`, **When** listed, **Then** it is marked as such.

---

### User Story 6 - Dates and size (Priority: P3)

Start date, expected primary completion and planned enrolment appear on the trial detail page.

**Independent Test**: Seeded trial with dates and enrolment shows them localised; missing values are omitted, not shown as zero.

### Edge Cases

- Registry text is English only: card titles and the "plain-language" parts are generated/translated per the existing translation pipeline; official criteria and titles stay linked, not paraphrased as fact.
- A paper cites an NCT id: link the paper and the trial (PR #17 added `extractReferenceIds`; verify its output is stored and shown). **[Research task]**
- A trial matches the keywords only incidentally (another condition in a list): existing relevance classifier decides; irrelevant trials are stored hidden as today.
- Trial withdrawn before enrolment: stays in the system, never in "Recruiting now".
- Sponsor contacts (email/phone) exist in the registry: **not** copied (privacy/liability); link to the registry only. See Open Question 5.
- Registry API field missing or schema change: extraction returns partial metadata; unknown fields are omitted, never defaulted.
- More than one update for the same trial in one run: one entry showing the net transition.
- Status flapping (A → B → A between two runs): no entry (net change is zero).

## Requirements _(mandatory)_

### Functional Requirements

**Data (worker):**

- **FR-001**: The ClinicalTrials.gov adapter MUST also extract, when present: intervention list (type, name), start date, primary completion date, enrolment count, sponsor name, healthy-volunteers flag, eligibility criteria text, per-site facility/city/country/status, and `hasResults`.
- **FR-002**: Intervention type and names for trials MUST come from registry fields only (no LLM).
- **FR-003**: The country cap of 10 MUST be removed from stored data; display collapsing is a UI concern.
- **FR-004**: For papers, an intervention-type tag MAY be produced by the LLM with the allowed set {medicine, procedure, device, gene-cell, supportive, diagnostic, unspecified}; when the abstract does not state it, the tag MUST be `unspecified`.
- **FR-005**: The worker MUST compare a re-fetched trial's `overallStatus` and `hasResults` with the stored values and record a **status transition** when they differ in a patient-relevant way (see Open Question 3).
- **FR-006**: A transition MUST be recorded once per distinct occurrence `(trial, from, to, hasResults, registry update date)` and be reported in the next digest. Retries of the same run are idempotent; a later recurrence of the same change type (e.g. a second suspension) MUST remain reportable. Only trials eligible for the public feed (relevant, `feedPublishedAt` set) produce public transitions.

**Reader experience (web):**

- **FR-007**: Issue pages and the feed MUST offer a "Recruiting now" group/filter limited to `recruiting` and `notYetRecruiting`.
- **FR-008**: Trial cards MUST show: status, plain-words phase, intervention names, countries, age/sex, registry link.
- **FR-009**: A "Treatments in research" view MUST group items by intervention type and show a research-stage label from the closed set in User Story 2.
- **FR-010**: Update entries MUST show old → new status, the registry update date and the registry link.
- **FR-011**: The detail page MUST show structured eligibility facts plus the AI-generated point list (FR-013) with a visible AI label and the "only the study team decides" sentence.
- **FR-012**: The detail page MUST show sites per country with per-site status; locale-relevant countries first (list in Open Question 1).
- **FR-013**: The eligibility point list MUST be ≤ 6 points, generated from the registry text under the existing safety rules (no dosing, no treatment advice, cite source, uncertainty wording), and MUST NOT contradict the structured facts.
- **FR-014**: All new copy MUST exist in `en`, `ru`, `de`, `tr`, `uk` (a unit test fails on key drift, as today).
- **FR-015**: Trust notice (disclaimer + AI label) MUST appear on the Treatments view and on trial detail pages.

**Safety & quality:**

- **FR-016**: No text may state or imply efficacy, availability for purchase, or that a patient should join/leave a study.
- **FR-017**: A calibration set of ≥ 15 trial and treatment items MUST be prepared for the physician (roadmap criterion 3), including the eligibility summaries.
- **FR-018**: The number of paid LLM calls per run MUST NOT grow per source beyond: +1 call per newly ingested paper (intervention tag, may be folded into the existing summarise call) and +1 per _newly recruiting_ trial (eligibility points).

### Key Entities

- **Publication** (existing, `sourceType = clinicaltrials`): `trialMetadata` extended (see plan data model).
- **Trial status transition**: `(publication, fromStatus, toStatus, registryUpdatedAt, reportedInDigest?)`.
- **Intervention**: `{ type, name }` list on a publication.
- **Site**: `{ country, city?, facility?, status? }` list on a publication.
- **Digest** (existing): references its status transitions so the issue can render "Update" entries.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: In the first issue after release, every recruiting trial in the project is in "Recruiting now" with intervention, phase, countries and registry link (checked against the registry by hand for ≥ 5 trials).
- **SC-002**: A seeded status change produces exactly one update entry in the next issue and none in the following one (integration test).
- **SC-003**: No trial card or update entry contains an efficacy claim (checked on the calibration set by the owner and by one physician; ties to roadmap criterion 3).
- **SC-004**: At least one patient in the VK chat confirms in conversation that they found a trial they could discuss with their doctor, or reports why not (qualitative check; owner collects).
- **SC-005**: Trial-related LLM calls per run stay within FR-018.

## Assumptions

- ClinicalTrials.gov API v2 provides the fields in FR-001 (to be verified in the research task: `armsInterventionsModule`, `designModule.enrollmentInfo`, `statusModule.*DateStruct`, `eligibilityModule.eligibilityCriteria` / `healthyVolunteers`, `contactsLocationsModule.locations[].status`, top-level `hasResults`).
- The existing translation pipeline can translate the new short strings (cards, updates) on the current lazy/pre-generation path.
- The VK chat remains the primary distribution channel; no VK-specific features here.
- Medical content wording is reviewed by the owner and, per roadmap criterion 3, by one physician before launch.

## Open Questions (for the owner)

1. **Regions to prioritise** in site lists: proposed `ru`: RU, UA, BY, KZ, TR + EU; `tr`: TR + EU; `uk`: UA + EU; `de`: DE/AT/CH; `en`: none. Is this right for your patients?
2. **Eligibility paraphrase (US4):** acceptable to ship AI-generated plain-language points in v1, or structured facts only until a physician has seen the calibration set? Proposed: structured facts in v1, AI points behind a flag turned on after physician feedback.
3. **Which transitions count as "patient-relevant"?** Proposed: any change of `overallStatus` among {not yet recruiting, recruiting, enrolling by invitation, active not recruiting, suspended, terminated, withdrawn, completed}, plus `hasResults` false→true. Anything to add or drop?
4. **Treatments view — what counts as "new"?** Include only investigational interventions, or also approved drugs studied for a new use (repurposing)? Proposed: both, with the stage label `approved/post-marketing` making the difference visible.
5. **Contacts:** show only the registry link, or also the study's public contact email/phone? Proposed: link only.
6. **Naming for patients:** "Recruiting now" / «Идёт набор участников» and "Treatments in research" / «Лечение: что исследуют». Confirm the Russian wording.
7. **Ordering vs 007:** confirm that 008 precedes 007 for the rest of Q4 (reduced 007 afterwards).
