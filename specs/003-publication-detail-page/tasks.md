---
description: 'Task list for Publication Detail Page implementation'
---

# Tasks: Publication Detail Page

**Input**: Design documents from `/specs/003-publication-detail-page/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/material-detail-api.md](./contracts/material-detail-api.md), [quickstart.md](./quickstart.md)

**Tests**: Included. Constitution Principle IX and `plan.md` require Jest + Playwright; `quickstart.md` enumerates the files. Tests are written before the implementation they cover.

**Organization**: Tasks are grouped by user story so each story can be implemented, tested, and demoed independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (`US1`, `US2`, `US3`)
- Include exact file paths in descriptions

## Path Conventions

Monorepo: `apps/web/` only (UI, public API, messages, E2E). No `apps/worker/` or `packages/shared/` changes. No new top-level directory.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Shared view-model type and reader-facing copy so later phases use one vocabulary

- [ ] T001 Define `MaterialDetail` (id, source, importance, date, originalUrl, title, summary with optional section keys, abstractOrBody, displayedLocale, isFallback, abstractIsFallback) in `apps/web/src/lib/materials.ts` alongside the existing `Material` type
- [ ] T002 [P] Add `Publication` keys `notFound`, `loadError`, `retry`, `abstractHeading` (and keep `originalLink` / `backToFeed` / section headings) using “material” never “publication” in `apps/web/messages/en.json`, `apps/web/messages/de.json`, `apps/web/messages/tr.json`, `apps/web/messages/ru.json`, and `apps/web/messages/uk.json`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Detail mapping + project-scoped public GET + remove the leaky unscoped route — MUST complete before any user-story UI

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T003 Implement `toMaterialDetail` in `apps/web/src/lib/materials.ts` per `data-model.md` and `research.md` R7–R9: reuse `resolveSource`, `collapseImportance`, `placeholderTitle`; omit empty summary keys; `abstractOrBody` trimmed or `null`; `abstractIsFallback` true only when abstract is present and requested locale is not `en`
- [ ] T004 [P] Add Jest cases for empty-section omit, null abstract, importance collapse, placeholder title, and `abstractIsFallback` in `apps/web/src/lib/materials.test.ts`
- [ ] T005 Implement `GET` in `apps/web/src/app/api/public/projects/[slug]/materials/[id]/route.ts` per `contracts/material-detail-api.md`: public, `locale` query default `en`, 400 on invalid locale, 404 with `{ "error": "Not found" }` when id missing **or** project slug mismatches **or** `feedPublishedAt` unset, 200 with `toMaterialDetail` otherwise (missing summary is 200, not 404)
- [ ] T006 [P] Delete `apps/web/src/app/api/public/publications/[id]/route.ts` (Payload `/api/publications` must stay)
- [ ] T007 Confirm no remaining imports or fetches of `/api/public/publications/` under `apps/web/` (page rewrite in US1 will be the last consumer — leave a failing grep note if the old page still calls it until T012)

**Checkpoint**: Mapping and gated detail GET exist; unpublished IDs 404; user-story UI can begin

---

## Phase 3: User Story 1 - Read a material on the site without leaving (Priority: P1) 🎯 MVP

**Goal**: Feed title opens the on-site detail page in the same tab; that page shows source, date, high-importance treatment, structured summary, then full abstract or body; unpublished/unknown is not-found; load failure is a distinct retry state

**Independent Test**: From a seeded project, activate a title → land on `/{locale}/projects/{slug}/publications/{id}` with no new tab. Confirm header then summary then abstract. Bogus id shows not-found, not load-error. Feed has no “opens in a new tab”.

### Tests for User Story 1

> Write these first; they MUST fail against the current outbound-title feed and summary-only detail page

- [ ] T008 [P] [US1] Rewrite `apps/web/tests/e2e/public-feed.spec.ts` so titles are same-tab links containing `/publications/`, there are zero `article a[target="_blank"]` on the feed, and zero visible “opens in a new tab” (invert the 002 assertions)
- [ ] T009 [P] [US1] Add `apps/web/tests/e2e/public-material-detail.spec.ts` asserting content order (source/summary before abstract), omitted empty abstract, not-found copy for a bogus id, and no loading spinner on the happy path
- [ ] T010 [P] [US1] Extend `apps/web/src/scripts/seed-public-feed.ts` so at least one published material has `abstractOrBody`, one published material has none, one has empty summary sections, and one unpublished publication id is logged for the not-found check

### Implementation for User Story 1

- [ ] T011 [P] [US1] Implement `apps/web/src/components/MaterialDetailView.tsx` in FR-025 order: header (title, `SourceBadge`, date when known, high-importance accent/tint/muted label on the header only) → populated summary headings → full abstract block (omit if null); no original-publication link yet (US2)
- [ ] T012 [US1] Rewrite `apps/web/src/app/[locale]/projects/[slug]/publications/[publicationId]/page.tsx` to fetch `GET /api/public/projects/{slug}/materials/{id}?locale=`: 404 → `notFound()`, non-OK → throw, 200 → `MaterialDetailView`; `cache: 'no-store'`; back-to-feed `TextLink` to `/projects/{slug}`
- [ ] T013 [P] [US1] Add `apps/web/src/app/[locale]/projects/[slug]/publications/[publicationId]/not-found.tsx` with distinct not-found copy and a back-to-feed link (FR-030) — wording must differ from load-error
- [ ] T014 [P] [US1] Add `apps/web/src/app/[locale]/projects/[slug]/publications/[publicationId]/error.tsx` with distinct load-error copy and `reset()` retry (FR-031), leaving locale layout chrome in place
- [ ] T015 [US1] Change `apps/web/src/components/MaterialCard.tsx` so the title is a next-intl `Link` to `/projects/{slug}/publications/{id}` (same tab), remove visible `opensInNewTab`, and stop using `material.url`; pass `slug` through `apps/web/src/components/MaterialsFeed.tsx` from `apps/web/src/app/[locale]/projects/[slug]/page.tsx`

**Checkpoint**: User Story 1 is a usable MVP — open the feed, open a material on-site, read summary then abstract without leaving

---

## Phase 4: User Story 2 - Open the original publication only when I choose to (Priority: P2)

**Goal**: A labeled original-source link on the detail header opens in a new tab; the feed never does that job; missing/unusable URLs render no link

**Independent Test**: Open a detail page with a usable original address, follow the link, confirm a new tab and the detail tab still open. Confirm feed titles still do not open the publisher. A material without a URL has no broken link.

### Tests for User Story 2

- [ ] T016 [P] [US2] Extend `apps/web/tests/e2e/public-material-detail.spec.ts` to assert the original-source control has `target="_blank"` and `rel` containing `noopener`, sits in the header (not between summary and abstract), and is absent when `originalUrl` is null

### Implementation for User Story 2

- [ ] T017 [US2] Add the original-publication `Anchor` to `apps/web/src/components/MaterialDetailView.tsx` in the header: sanitized `originalUrl` only, `target="_blank"` `rel="noopener noreferrer"`, visible label from `Publication.originalLink` (no word “publication”), `aria-label` that includes new-tab meaning via `Materials.opensInNewTab` without rendering that string visibly (FR-014, FR-026, FR-027)

**Checkpoint**: User Stories 1 and 2 both work — read on-site, then optionally open the publisher in a new tab

---

## Phase 5: User Story 3 - Read the detail page in my language (Priority: P3)

**Goal**: Detail chrome and structured summary follow the five locales with the same fallback note as the feed; stored abstract stays visible with a language note when the locale is not English; no machine-translation outbound link

**Independent Test**: Open the same material under `en`, `de`, `tr`, `ru`, `uk`. Chrome translates; translated summaries appear when cached; otherwise English summary + fallback note; abstract remains with a note when locale ≠ `en`.

### Tests for User Story 3

- [ ] T018 [P] [US3] Add Jest cases for `displayedLocale` / `isFallback` on title+summary and `abstractIsFallback` in `apps/web/src/lib/materials.test.ts`
- [ ] T019 [P] [US3] Extend `apps/web/tests/e2e/public-material-detail.spec.ts` to switch locale and assert translated section headings plus a fallback note when summary or abstract is not in the active language

### Implementation for User Story 3

- [ ] T020 [US3] Render the feed-style fallback note on `apps/web/src/components/MaterialDetailView.tsx` when `isFallback` and/or `abstractIsFallback`; do not render `translationFallbackUrl` / “Open machine translation”
- [ ] T021 [US3] Finish every `Publication` key used by the detail page in `apps/web/messages/en.json`, `apps/web/messages/de.json`, `apps/web/messages/tr.json`, `apps/web/messages/ru.json`, and `apps/web/messages/uk.json`, and remove unused `translationFallback` if nothing else reads it

**Checkpoint**: All three stories are independently functional — on-site reading, original link, five-locale chrome

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Accessibility, layout, leftover surfaces, and quickstart sign-off

- [ ] T022 [P] Verify keyboard tab order and visible focus on feed title, back-to-feed, original link, and load-error retry in `apps/web/src/components/MaterialCard.tsx`, `apps/web/src/components/MaterialDetailView.tsx`, `apps/web/src/app/[locale]/projects/[slug]/publications/[publicationId]/error.tsx`, and `apps/web/src/app/[locale]/projects/[slug]/publications/[publicationId]/not-found.tsx` (FR-023)
- [ ] T023 [P] Confirm single-column wrap at 320px with no horizontal scroll in `apps/web/src/components/MaterialDetailView.tsx` and `apps/web/src/app/[locale]/projects/[slug]/publications/[publicationId]/page.tsx` (FR-022)
- [ ] T024 Grep reader-facing strings under `apps/web/messages/` and the detail UI so the word “publication” does not appear in copy a reader can see (FR-021); URL path `/publications/` may remain (`research.md` R12)
- [ ] T025 [P] Smoke that `GET /api/public/publications/:id` is gone (404, not a JSON body) and that `apps/web/tests/e2e/i18n-locales.spec.ts` still passes
- [ ] T026 Run the full [quickstart.md](./quickstart.md) gate: `seed:public-feed`, manual table in all five locales, `pnpm --filter @hht/web test`, `pnpm --filter @hht/web test:e2e`, lint, typecheck, and production build

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational — MVP
- **User Story 2 (Phase 4)**: Depends on Foundational; mounts the original link onto US1’s `MaterialDetailView.tsx`
- **User Story 3 (Phase 5)**: Depends on Foundational mapping flags; notes mount on US1’s view
- **Polish (Phase 6)**: Depends on the stories you intend to ship

### User Story Dependencies

- **User Story 1 (P1)**: After Phase 2 only — no dependency on US2/US3
- **User Story 2 (P2)**: After Phase 2; needs US1’s detail view file to attach the original link. Independently testable once that control exists
- **User Story 3 (P3)**: After Phase 2 for `isFallback` / `abstractIsFallback`; note UI mounts on US1’s view

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Mapping/GET before UI
- Detail view before page wiring
- Feed title change after the detail page exists so E2E has a destination
- Story complete before moving to the next priority if staffing is sequential

### Parallel Opportunities

- Phase 1: T001 and T002 in parallel
- Phase 2: T004 after T003; T005 and T006 in parallel after T003
- Once Phase 2 is done: T008, T009, T010 in parallel; T011, T013, T014 in parallel
- US3: T018 and T019 in parallel
- Polish: T022, T023, T025 in parallel

---

## Parallel Example: User Story 1

```bash
# After Phase 2, launch failing tests + seed together:
Task: "Rewrite apps/web/tests/e2e/public-feed.spec.ts for in-app title links"
Task: "Add apps/web/tests/e2e/public-material-detail.spec.ts for order and not-found"
Task: "Extend apps/web/src/scripts/seed-public-feed.ts with abstract/unpublished cases"

# Then launch independent UI files together:
Task: "Implement apps/web/src/components/MaterialDetailView.tsx"
Task: "Add publications/[publicationId]/not-found.tsx"
Task: "Add publications/[publicationId]/error.tsx"
```

## Parallel Example: User Story 2

```bash
Task: "Extend apps/web/tests/e2e/public-material-detail.spec.ts for original-link new tab"
# Then:
Task: "Add original Anchor to apps/web/src/components/MaterialDetailView.tsx"
```

## Parallel Example: User Story 3

```bash
Task: "Add Jest fallback-flag cases in apps/web/src/lib/materials.test.ts"
Task: "Extend apps/web/tests/e2e/public-material-detail.spec.ts for locale switch"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: seed, open the feed, click a title, read summary then abstract on-site
5. Demo if ready — a reader no longer has to leave the site to assess a material

### Incremental Delivery

1. Setup + Foundational → gated detail GET returns eligible materials only
2. User Story 1 → Test independently → Demo (MVP)
3. User Story 2 → Test independently → Demo (original link)
4. User Story 3 → Test independently → Demo (five locales)
5. Polish → quickstart.md sign-off

### Parallel Team Strategy

1. Team completes Setup + Foundational together
2. Then:
   - Developer A: User Story 1 (view, page, feed title, not-found/error)
   - Developer B: User Story 2 (original link + E2E; merge onto A’s view)
   - Developer C: User Story 3 (fallback notes + locale messages)
3. Coordinate on `MaterialDetailView.tsx`, `materials.ts`, and the five `messages/*.json` files

---

## Notes

- [P] tasks = different files, no dependencies on incomplete work
- [Story] label maps the task to US1 / US2 / US3
- Keep the App Router path `publications/[publicationId]`; do not rename it to `materials` (`research.md` R12)
- Do not add a worker translation pipeline for abstracts (`research.md` R8, R10)
- Do not restore feed filter query on back-to-feed (`research.md` R13)
- Zero new public write endpoints; unpublished ≡ unknown 404 (`research.md` R3)
- Commit after each task or logical group
- Stop at any checkpoint to validate the story independently
