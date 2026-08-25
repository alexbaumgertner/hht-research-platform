---
description: "Task list for Research Monitoring MVP implementation"
---

# Tasks: Research Monitoring MVP

**Input**: Design documents from `/specs/001-research-monitoring-mvp/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Included — constitution Principle IX and spec Independent Test / acceptance scenarios require Jest + Playwright. Write failing tests before implementation within each story phase where noted.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

Monorepo per `plan.md`: `apps/web/`, `apps/worker/`, `packages/shared/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [X] T001 Create monorepo directories `apps/web/`, `apps/worker/`, `packages/shared/` and root `pnpm-workspace.yaml` per `plan.md`
- [X] T002 Initialize `apps/web` as Next.js 16.2.6+ App Router + Payload CMS 3 TypeScript app with `@payloadcms/db-postgres` in `apps/web/package.json`
- [X] T003 [P] Initialize `apps/worker` Node/TypeScript package with build scripts in `apps/worker/package.json`
- [X] T004 [P] Initialize `packages/shared` TypeScript library package in `packages/shared/package.json`
- [X] T005 [P] Add ESLint (`eslint-config-next` + typescript-eslint), Prettier (`eslint-config-prettier`), and root scripts in `package.json` / `.eslintrc.*` / `.prettierrc`
- [X] T006 [P] Add Jest config for shared + worker domain tests in `jest.config.ts` (or per-package configs)
- [X] T007 [P] Add Playwright config for web E2E in `apps/web/playwright.config.ts`
- [X] T008 [P] Create `.env.example` documenting `DATABASE_URL`, `PAYLOAD_SECRET`, `AI_GATEWAY_API_KEY`, `RESEND_API_KEY`, `PUBLIC_SITE_URL`, worker API key, bootstrap/batch defaults
- [X] T009 [P] Add Husky + lint-staged pre-commit hook config in `.husky/pre-commit` and `package.json`
- [X] T010 [P] Add Cursor agent hooks in `.cursor/hooks.json` (`afterFileEdit` lint/format; `stop` tsc + build + tests)
- [X] T011 [P] Add GitHub Actions CI workflow for lint, format check, tsc, `next build`, Jest, Playwright in `.github/workflows/ci.yml`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T012 Configure Payload Postgres adapter and `payload.config.ts` in `apps/web/src/payload.config.ts` (Neon `DATABASE_URL`)
- [X] T013 [P] Configure Payload Users collection with admin role for owner auth in `apps/web/src/collections/Users.ts`
- [X] T014 [P] Wire Payload Next.js plugin and `(payload)` admin routes under `apps/web/src/app/(payload)/`
- [X] T015 Install and configure Mantine provider shell for public UI in `apps/web/src/app/[locale]/layout.tsx`
- [X] T016 [P] Configure next-intl with locales `en|de|tr|ru|uk` and message files in `apps/web/src/i18n/` and `apps/web/messages/*.json`
- [X] T017 Create shared Zod/types for schedule, importance, source type, locales in `packages/shared/src/index.ts`
- [X] T018 [P] Implement `dedupeKey` and title-normalization helpers in `packages/shared/src/dedupe.ts`
- [X] T019 [P] Implement schedule-due helpers (`daily`/`weekly`/`monthly` vs `lastSuccessfulRunAt`) in `packages/shared/src/schedule.ts`
- [X] T020 Create Payload access helpers (public read vs admin write; internal API key for worker) in `apps/web/src/access/`
- [X] T021 Add Resend email adapter wiring in `apps/web/src/payload.config.ts` (used later by US4)
- [X] T022 Create worker Dockerfile and entry stub that exits 0 in `apps/worker/Dockerfile` and `apps/worker/src/index.ts`
- [X] T023 Document local run commands aligning with `specs/001-research-monitoring-mvp/quickstart.md` in root `README.md`

**Checkpoint**: Foundation ready — Payload admin boots, Postgres connects, public `[locale]` shell renders, shared package builds, CI hooks exist

---

## Phase 3: User Story 1 - Read a public project digest feed (Priority: P1) 🎯 MVP

**Goal**: Anonymous visitors can open a public home/list, open a project feed, filter by importance, and view publication detail — without registration.

**Independent Test**: With seeded project + digests + publications, visitor opens home → project URL → filters importance → opens publication with summary + original link; write actions unavailable.

### Tests for User Story 1

- [X] T024 [P] [US1] Add Playwright E2E for public home → project feed → importance filter → publication detail in `apps/web/tests/e2e/public-feed.spec.ts`
- [X] T025 [P] [US1] Add Jest unit tests for importance filter helpers in `packages/shared/src/importance.test.ts`

### Implementation for User Story 1

- [X] T026 [P] [US1] Create `ResearchProjects` Payload collection (slug, name, description, public fields) in `apps/web/src/collections/ResearchProjects.ts`
- [X] T027 [P] [US1] Create `Publications` Payload collection (summary sections, importance, originalUrl, dedupeKey, project relation) in `apps/web/src/collections/Publications.ts`
- [X] T028 [P] [US1] Create `Digests` Payload collection (project, publishedAt, publications[]) in `apps/web/src/collections/Digests.ts`
- [X] T029 [US1] Register collections in `apps/web/src/payload.config.ts` and run/generate migrations as needed
- [X] T030 [US1] Implement `GET` public projects list (only projects with ≥1 digest) in `apps/web/src/app/api/public/projects/route.ts`
- [X] T031 [P] [US1] Implement `GET` public project by slug in `apps/web/src/app/api/public/projects/[slug]/route.ts`
- [X] T032 [P] [US1] Implement `GET` digests with optional `importance` query in `apps/web/src/app/api/public/projects/[slug]/digests/route.ts`
- [X] T033 [P] [US1] Implement `GET` publication detail (English summary) in `apps/web/src/app/api/public/publications/[id]/route.ts`
- [X] T034 [US1] Build public home/list page in `apps/web/src/app/[locale]/page.tsx`
- [X] T035 [US1] Build project digest feed page with importance filter UI in `apps/web/src/app/[locale]/projects/[slug]/page.tsx`
- [X] T036 [US1] Build publication detail page in `apps/web/src/app/[locale]/projects/[slug]/publications/[publicationId]/page.tsx`
- [X] T037 [US1] Add seed script for one project + digests + mixed-importance publications in `apps/web/src/scripts/seed-public-feed.ts`
- [X] T038 [US1] Ensure unauthenticated visitors cannot mutate collections (access control verification) in `apps/web/src/access/`

**Checkpoint**: US1 fully functional with seed data; Playwright public-feed path passes

---

## Phase 4: User Story 2 - Configure a research project and monitoring (Priority: P2)

**Goal**: Authenticated owner creates/updates project, keywords, sources (PubMed / ClinicalTrials / RSS), schedule, and pause/resume in admin.

**Independent Test**: Owner creates project with keywords, attaches PubMed source, sets schedule, pauses/resumes; config persists; unauthenticated cannot write.

### Tests for User Story 2

- [X] T039 [P] [US2] Add Playwright E2E for admin create project + source + schedule + pause/resume in `apps/web/tests/e2e/admin-project-config.spec.ts`
- [X] T040 [P] [US2] Add Jest tests for keyword non-empty / RSS URL validation helpers in `packages/shared/src/project-validation.test.ts`

### Implementation for User Story 2

- [X] T041 [P] [US2] Extend `ResearchProjects` with keywords[], schedule, monitoringStatus, bootstrapLookbackDays, emailNotificationEnabled, lastSuccessfulRunAt, owner in `apps/web/src/collections/ResearchProjects.ts`
- [X] T042 [P] [US2] Create `MonitoredSources` collection (type, rssUrl, enabled, project) with validation in `apps/web/src/collections/MonitoredSources.ts`
- [X] T043 [US2] Add Payload hooks preventing `monitoringStatus=active` with empty keywords in `apps/web/src/collections/ResearchProjects.ts`
- [X] T044 [US2] Add RSS URL field validation (reject non-URL) in `apps/web/src/collections/MonitoredSources.ts`
- [X] T045 [US2] Configure Admin UI labels/groups for project + sources management in collection `admin` configs under `apps/web/src/collections/`
- [X] T046 [US2] Document owner setup steps (SC-001) linking to quickstart in `README.md`

**Checkpoint**: Owner can fully configure a project in `/admin`; pause freezes intent for later worker skip

---

## Phase 5: User Story 3 - Automatic monitoring run produces a digest (Priority: P3)

**Goal**: Worker fetches since watermark (30-day bootstrap first run), dedupes, classifies, summarizes/ranks, publishes one digest when qualifying items exist; partial source failure still publishes and advances watermark.

**Independent Test**: Configured project + source → run worker → digest or no empty digest; re-run yields 0 duplicates; partial failure behavior matches FR-020.

### Tests for User Story 3

- [X] T047 [P] [US3] Add Jest tests for dedupe key generation in `packages/shared/src/dedupe.test.ts`
- [X] T048 [P] [US3] Add Jest tests for schedule-due and pause skip logic in `packages/shared/src/schedule.test.ts`
- [X] T049 [P] [US3] Add Jest tests for pipeline batching / empty-digest rules in `apps/worker/src/pipeline/publish.test.ts`
- [X] T050 [US3] Add Playwright (or API) verification that a run produces a visible digest on public feed in `apps/web/tests/e2e/monitoring-digest.spec.ts`

### Implementation for User Story 3

- [X] T051 [P] [US3] Create `MonitoringRuns` collection (status, sourceResults, stats, triggeredBy, digest relation) in `apps/web/src/collections/MonitoringRuns.ts`
- [X] T052 [US3] Expose worker-authenticated write access for runs/publications/digests/project watermark in `apps/web/src/access/` and env `PAYLOAD_API_KEY` usage
- [X] T053 [P] [US3] Implement PubMed E-utilities adapter in `apps/worker/src/adapters/pubmed.ts`
- [X] T054 [P] [US3] Implement ClinicalTrials.gov API v2 adapter in `apps/worker/src/adapters/clinicaltrials.ts`
- [X] T055 [P] [US3] Implement RSS adapter with non-feed failure in `apps/worker/src/adapters/rss.ts`
- [X] T056 [US3] Implement CMS client (list due projects, upsert publication, create run/digest, patch watermark) in `apps/worker/src/cms/client.ts`
- [X] T057 [US3] Implement classify + summarize + importance via Vercel AI SDK / AI Gateway in `apps/worker/src/pipeline/ai.ts`
- [X] T058 [US3] Implement per-project pipeline (fetch → batch ≤50 → dedupe → classify → summarize → digest) in `apps/worker/src/pipeline/runProject.ts`
- [X] T059 [US3] Implement due-project selection + partial-failure status handling in `apps/worker/src/index.ts`
- [X] T060 [US3] Add optional manual run trigger for owner (admin custom endpoint or collection action) in `apps/web/src/endpoints/manualRun.ts`
- [X] T061 [US3] Add Cloud Scheduler + Cloud Run Job deploy notes (single hourly scheduler) in `apps/worker/README.md`

**Checkpoint**: Worker produces digests per contracts/monitoring-worker.md; SC-002/SC-005 satisfied

---

## Phase 6: User Story 4 - Optional digest published email (Priority: P4)

**Goal**: When enabled, owner receives one short link-only email on digest publish; when disabled, none.

**Independent Test**: Enable → publish → email with feed link only; disable → publish → zero emails.

### Tests for User Story 4

- [X] T062 [P] [US4] Add Jest test that notification payload excludes digest body and includes feed URL in `apps/worker/src/notify/digestEmail.test.ts`

### Implementation for User Story 4

- [X] T063 [US4] Implement Resend digest notification sender in `apps/worker/src/notify/digestEmail.ts`
- [X] T064 [US4] Call notifier from publish path only when `emailNotificationEnabled` in `apps/worker/src/pipeline/runProject.ts`
- [X] T065 [US4] Ensure Admin toggle for `emailNotificationEnabled` is visible on Research Project in `apps/web/src/collections/ResearchProjects.ts`

**Checkpoint**: SC-006 satisfied

---

## Phase 7: User Story 5 - Read digests in a preferred language (Priority: P5)

**Goal**: UI chrome in five locales; on-demand AI translation of English summaries cached per publication+locale.

**Independent Test**: Switch locales → chrome translates; first non-en summary request generates+caches; second request reuses cache.

### Tests for User Story 5

- [X] T066 [P] [US5] Add Playwright E2E for locale switcher across five locales in `apps/web/tests/e2e/i18n-locales.spec.ts`
- [X] T067 [P] [US5] Add Jest test for translation cache hit/miss helper in `apps/web/src/lib/translations.test.ts`

### Implementation for User Story 5

- [X] T068 [P] [US5] Create `ContentTranslations` collection (publication, locale, fields) with unique (publication, locale) in `apps/web/src/collections/ContentTranslations.ts`
- [X] T069 [US5] Extend publication public API to accept `locale`, generate+cache translation via AI Gateway in `apps/web/src/app/api/public/publications/[id]/route.ts`
- [X] T070 [US5] Add locale switcher component in `apps/web/src/components/LocaleSwitcher.tsx`
- [X] T071 [US5] Complete message catalogs for UI chrome in `apps/web/messages/{en,de,tr,ru,uk}.json`
- [X] T072 [US5] Add machine-translation fallback link field when AI translation fails in `apps/web/src/lib/translationFallback.ts`

**Checkpoint**: SC-004 satisfied; FR-016/FR-017 met

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Hardening, docs, and full quickstart validation

- [X] T073 [P] Align public empty-state vs home-list omission (FR-021) in `apps/web/src/app/[locale]/` and public projects route
- [X] T074 [P] Add MIT `LICENSE` at repo root if missing
- [X] T075 Verify all quickstart scenarios V1–V6 in `specs/001-research-monitoring-mvp/quickstart.md` against a running stack
- [X] T076 Confirm CI required checks green on a PR: lint, format, tsc, build, Jest, Playwright via `.github/workflows/ci.yml`
- [X] T077 [P] Final pass: topic-agnostic naming (no HHT hardcoding in domain code) across `apps/` and `packages/shared/`
- [X] T078 Docker Compose optional local Postgres for offline dev in `docker-compose.yml`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup — **BLOCKS** all user stories
- **US1 (Phase 3)**: After Foundational — MVP with seed data
- **US2 (Phase 4)**: After Foundational; extends collections used by US1 (safe sequential after US1 recommended)
- **US3 (Phase 5)**: Needs US2 config fields + US1 digest/publication model; after US2
- **US4 (Phase 6)**: Depends on US3 publish path
- **US5 (Phase 7)**: Can start after US1 publication API exists; best after US1 stable (parallel with US2–US4 if staffed)
- **Polish (Phase 8)**: After desired stories complete

### User Story Dependencies

- **US1 (P1)**: After Phase 2 only — seed digests; no worker required
- **US2 (P2)**: After Phase 2 — admin config; independently testable without worker
- **US3 (P3)**: After US2 (and US1 collections) — worker pipeline
- **US4 (P4)**: After US3 publish
- **US5 (P5)**: After US1 publication detail API; independent of email

### Within Each User Story

- Tests marked in story phase SHOULD be written and fail before implementation
- Collections before public/admin APIs before UI
- Worker adapters before pipeline orchestration
- Story complete before next priority unless explicitly parallel

### Parallel Opportunities

- Phase 1: T003–T011 marked [P]
- Phase 2: T013–T014, T016, T018–T019 marked [P]
- US1: T024–T025, T026–T028, T031–T033 marked [P]
- US2: T039–T040, T041–T042 marked [P]
- US3: T047–T049, T053–T055 marked [P]
- US5 can proceed in parallel with US2–US4 after US1 API exists
- Solo maintainer: execute P1 → P2 → P3 → P4 → P5 sequentially

---

## Parallel Example: User Story 1

```bash
# Tests in parallel:
Task: "Playwright E2E public feed in apps/web/tests/e2e/public-feed.spec.ts"
Task: "Jest importance helpers in packages/shared/src/importance.test.ts"

# Collections in parallel:
Task: "ResearchProjects in apps/web/src/collections/ResearchProjects.ts"
Task: "Publications in apps/web/src/collections/Publications.ts"
Task: "Digests in apps/web/src/collections/Digests.ts"

# Public API routes in parallel after collections registered:
Task: "GET digests route"
Task: "GET publication route"
Task: "GET project by slug route"
```

---

## Parallel Example: User Story 3

```bash
# Adapter implementations in parallel:
Task: "PubMed adapter in apps/worker/src/adapters/pubmed.ts"
Task: "ClinicalTrials adapter in apps/worker/src/adapters/clinicaltrials.ts"
Task: "RSS adapter in apps/worker/src/adapters/rss.ts"

# Unit tests in parallel:
Task: "dedupe.test.ts"
Task: "schedule.test.ts"
Task: "publish.test.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: US1 + seed script
4. **STOP and VALIDATE**: Playwright public-feed + manual quickstart V1
5. Demo public digest UX before worker work

### Incremental Delivery

1. Setup + Foundational → platform boots
2. US1 → public read MVP
3. US2 → owner can configure (still no automation)
4. US3 → automated digests (production value)
5. US4 → optional email
6. US5 → full i18n content
7. Polish → quickstart V1–V6 + CI green

### Suggested MVP scope

**Ship gate for first demo**: Phases 1–3 (US1) with seed data.  
**Ship gate for real HHT monitoring**: through US3 (Phases 1–5). US4/US5 complete the constitution MVP intent.

---

## Notes

- [P] = different files, no incomplete-task dependencies
- [USn] maps to spec user stories for traceability
- Domain code MUST stay topic-agnostic (HHT is seed/content only)
- Commit after each task or logical group
- Stop at checkpoints to validate independently
- Contracts reference: `contracts/public-api.md`, `contracts/admin-api.md`, `contracts/monitoring-worker.md`
