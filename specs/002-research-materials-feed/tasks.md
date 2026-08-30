---
description: 'Task list for Research Materials Feed implementation'
---

# Tasks: Research Materials Feed

**Input**: Design documents from `/specs/002-research-materials-feed/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/materials-api.md](./contracts/materials-api.md), [quickstart.md](./quickstart.md)

**Tests**: Included. Constitution Principle IX and `plan.md` require Jest + Playwright updates; `quickstart.md` enumerates the files. Tests are written before the implementation they cover.

**Organization**: Tasks are grouped by user story so each story can be implemented, tested, and demoed independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (`US1`, `US2`, `US3`)
- Include exact file paths in descriptions

## Path Conventions

Monorepo: `apps/web/` (UI, Payload, public API), `apps/worker/` (pipeline), `packages/shared/` (shared types). No new top-level directory.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: New dependency and shared presentation types/copy so later phases share one vocabulary

- [ ] T001 Add `@tabler/icons-react` as a dependency in `apps/web/package.json` and install from the repo root (`pnpm install`)
- [ ] T002 [P] Define `MaterialSource` (`pubmed` | `trials` | `news` | `guideline` | `social`), `DisplayImportance` (`normal` | `high`), `DisplayCategory` (`news` | `guideline` | `social`), and the `Material` view-model type plus the R3 resolution table constants in `apps/web/src/lib/materials.ts`
- [ ] T003 [P] Add a `Materials` message namespace (badge labels, high-importance label, empty-project, no-matches, load-error, search, source-filter, importance-toggle, visible-count, fallback-note, untitled-placeholder) using the reader-facing word "material" — never "publication" — in `apps/web/messages/en.json`, `apps/web/messages/de.json`, `apps/web/messages/tr.json`, `apps/web/messages/ru.json`, and `apps/web/messages/uk.json`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Schema, publishing gate, mapping library, public read contract, and pipeline source-link — MUST complete before any user story UI

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T004 [P] Add optional `displayCategory` select (`news` | `guideline` | `social`) to `apps/web/src/collections/MonitoredSources.ts`, shown in admin only when `type === 'rss'`
- [ ] T005 [P] Add optional `monitoredSource` relationship (→ `monitored-sources`) and system-managed, admin-read-only `feedPublishedAt` date to `apps/web/src/collections/Publications.ts`
- [ ] T006 [P] Add optional sibling `title` text field to `apps/web/src/collections/ContentTranslations.ts` (alongside the existing `fields` group)
- [ ] T007 Generate Payload types after T004–T006 via `pnpm --filter @hht/web generate:types` (updates `apps/web/src/payload-types.ts`)
- [ ] T008 Add `stampFeedPublishedAt(doc, req)` in `apps/web/src/collections/digestHooks.ts` and call it from the existing `afterChange` create hook in `apps/web/src/collections/Digests.ts`, sharing `req` the same way `hasPublishedDigest` already does so Vercel Hobby does not 504
- [ ] T009 [P] Add unit tests for `stampFeedPublishedAt` id extraction and no-op-when-unset behavior in `apps/web/src/collections/digestHooks.test.ts`
- [ ] T010 Write an idempotent backfill that sets `feedPublishedAt = digest.publishedAt` only when unset, for every publication already listed on a digest, in `apps/web/src/scripts/backfill-feed-published-at.ts` (one log line per project)
- [ ] T011 [P] Add `<ColorSchemeScript defaultColorScheme="auto" />` to the document head in `apps/web/src/app/[locale]/layout.tsx`, set `MantineProvider defaultColorScheme="auto"` in `apps/web/src/app/providers.tsx`, and replace the hardcoded `body` background `#f6f8f7` with a Mantine theme token
- [ ] T012 Implement `resolveSource`, `collapseImportance`, `resolveLocalizedContent`, `placeholderTitle`, and `toMaterial` in `apps/web/src/lib/materials.ts` per `data-model.md` and `research.md` R3/R4/R5/R11 (unrecognised `sourceType` → neutral fallback; empty RSS category → `news`; missing date → `null`; empty title → source+date placeholder)
- [ ] T013 [P] Add Jest coverage for the R3 badge table (five outcomes + unrecognised fallback), importance collapse (`critical`/`high` → `high`; `medium`/`low`/`null` → `normal`), locale/title/summary fallback (hit, miss, partial miss), and untitled placeholder in `apps/web/src/lib/materials.test.ts`
- [ ] T014 Implement `GET` in `apps/web/src/app/api/public/projects/[slug]/materials/route.ts` per `contracts/materials-api.md`: public, `locale` query default `en`, only rows with `feedPublishedAt` set, `toMaterial` mapping, sort `date` descending with `null` last, `404` for unknown slug; throw/non-OK on fetch failure (do not swallow to `[]`)
- [ ] T015 Delete the unused public route `apps/web/src/app/api/public/projects/[slug]/digests/route.ts` (Payload `POST /api/digests` is a different route and must stay)
- [ ] T016 Retarget `apps/web/tests/e2e/monitoring-digest.spec.ts` from `GET /api/public/projects/:slug/digests` to `GET /api/public/projects/:slug/materials` and assert a `docs` array
- [ ] T017 Thread `monitoredSource: source.id` into both `cms.createPublication(...)` calls in `apps/worker/src/pipeline/runProject.ts`

**Checkpoint**: Schema, gate, mapping, materials endpoint, and source-link are in place — user story UI can begin

---

## Phase 3: User Story 1 - Scan what is new on a research topic (Priority: P1) 🎯 MVP

**Goal**: A reader opening `/[locale]/projects/[slug]` sees a single-column, newest-first, read-only feed of published materials with distinct source badges, subtle high-importance treatment, outbound title links, and a distinct load-failure state

**Independent Test**: Seed materials across all five source categories and both importance levels. Load the project page. Verify newest-first order, badge distinctness, high-importance accent/tint/label (not alarm styling), title links open externally in a new tab, non-title clicks do nothing, no add/edit/delete controls, unpublished materials absent, and a load failure shows retry while chrome stays usable.

### Tests for User Story 1

> Write these first; they MUST fail against the current digest-grouped page

- [ ] T018 [P] [US1] Extend `apps/web/src/scripts/seed-public-feed.ts` so `hht-research` has at least one published material per source (`pubmed`, `trials`, `news`, `guideline`, `social`) — including RSS sources tagged `guideline` and `social` — plus one `high` and one `normal` importance, one with no summary, and one with `publishedOrUpdatedAt` unset
- [ ] T019 [P] [US1] Rewrite `apps/web/tests/e2e/public-feed.spec.ts` to assert a flat feed (no digest headings), newest-first order, five badge labels, high-importance treatment, title `target="_blank"` to the external URL (not `/publications/[id]`), and zero add/edit/delete controls

### Implementation for User Story 1

- [ ] T020 [P] [US1] Implement `apps/web/src/components/SourceBadge.tsx` using `@tabler/icons-react` plus Mantine `Badge`/`ThemeIcon` tokens: same icon, label, and color per category under light and dark; unrecognised source → neutral fallback badge
- [ ] T021 [P] [US1] Implement `apps/web/src/components/MaterialCard.tsx`: source badge, title as sanitized outbound link (`rel="noopener noreferrer"`, new-tab discoverable to AT), date or none, summary when present, high-importance soft edge + faint tint + muted text label (FR-020/FR-021); no other interactive regions
- [ ] T022 [US1] Rewrite `apps/web/src/app/[locale]/projects/[slug]/page.tsx` to server-fetch `GET /api/public/projects/{slug}/materials?locale=` (throw on non-OK, matching `fetchProject`), render a single centred column of `MaterialCard`s newest-first, and show the empty-project message when `docs` is empty — no loading placeholder
- [ ] T023 [P] [US1] Add `apps/web/src/app/[locale]/projects/[slug]/error.tsx` that shows a distinctly worded inline error with `reset()` retry and does not replace `[locale]/layout.tsx` chrome
- [ ] T024 [US1] Delete `apps/web/src/components/ImportanceFilter.tsx` and remove every import/usage (including `Suspense` around it in the old page)
- [ ] T025 [US1] Replace digest-era `Project.feedTitle` / `Project.empty` / `Project.filter*` copy with Materials-feed strings in `apps/web/messages/{en,de,tr,ru,uk}.json` so all five locales have complete US1 chrome

**Checkpoint**: User Story 1 is a usable MVP — open the page, scan the list, follow a title out

---

## Phase 4: User Story 2 - Narrow the feed down to what I care about (Priority: P2)

**Goal**: Search, multi-select source chips, and a high-importance switch combine client-side; the reader can tell an empty project from an over-filtered list

**Independent Test**: With a seeded multi-category list, exercise each control alone and together. Empty chip selection shows all (not none). Visible count updates. Over-filtered list shows "nothing matches" + clear-filters. A project with zero published materials shows "nothing published yet" and no clear-filters prompt.

### Tests for User Story 2

- [ ] T026 [P] [US2] Add `filterMaterials` (search ∧ sources ∧ importance; empty source list = all; case-insensitive match on displayed title/summary) and empty-state selection (`empty-project` vs `no-matches`) plus Jest cases in `apps/web/src/lib/materials.ts` and `apps/web/src/lib/materials.test.ts`
- [ ] T027 [P] [US2] Extend `apps/web/tests/e2e/public-feed.spec.ts` with search, source chips (including deselect-all ⇒ all), high-importance switch, combined filters, visible count, no-matches + clear, and empty-project (no clear prompt)

### Implementation for User Story 2

- [ ] T028 [P] [US2] Implement `apps/web/src/components/MaterialSearchInput.tsx` (leading Tabler search icon, accessible label, keyboard-operable)
- [ ] T029 [P] [US2] Implement `apps/web/src/components/SourceCategoryFilter.tsx` as a Mantine `Chip.Group` of the five categories; empty selection means all
- [ ] T030 [P] [US2] Implement `apps/web/src/components/HighImportanceSwitch.tsx` as a single labelled switch
- [ ] T031 [US2] Implement `apps/web/src/components/MaterialsFeed.tsx` as the client owner of `{ q, sources, important }` in the URL (`?q=&sources=&important=`), filtering the already-fetched `Material[]` in memory, stating the visible count in a live region (FR-051), and rendering no-matches + clear-filters
- [ ] T032 [US2] Mount `MaterialsFeed` from `apps/web/src/app/[locale]/projects/[slug]/page.tsx`; when `docs.length === 0` hide or inert the controls and show only the empty-project message
- [ ] T033 [US2] Complete search / chip / switch / count / no-matches / clear-filters strings in `apps/web/messages/{en,de,tr,ru,uk}.json`

**Checkpoint**: User Stories 1 and 2 both work — a reader can scan and then narrow

---

## Phase 5: User Story 3 - Read the materials in my own language (Priority: P3)

**Goal**: Interface and material titles/summaries follow the active locale; missing translations fall back with a quiet language note; filter state survives a locale switch

**Independent Test**: Seed partial translation coverage. Visit the feed in `en`, `de`, `tr`, `ru`, and `uk`. Chrome and content translate; untranslated items stay visible with a fallback note; search + chips + importance survive the language change; search rematches against the newly displayed language.

### Tests for User Story 3

- [ ] T034 [P] [US3] Add Jest cases for fallback-note flags (`isFallback`, `displayedLocale`) and for search matching the displayed (not stored-English-only) title/summary in `apps/web/src/lib/materials.test.ts`
- [ ] T035 [P] [US3] Extend `apps/web/tests/e2e/public-feed.spec.ts` so a locale switch keeps `q` / `sources` / `important` and shows a fallback note on an untranslated material; confirm `apps/web/tests/e2e/i18n-locales.spec.ts` still passes

### Implementation for User Story 3

- [ ] T036 [P] [US3] Extend `apps/web/src/components/LocaleSwitcher.tsx` to append the current URL query string when navigating to the new locale (no-op on pages with no query)
- [ ] T037 [P] [US3] Extend `translateSummary` in `apps/worker/src/pipeline/translate.ts` to return `{ title, ...summary }` from the same AI Gateway call, and persist `title` on `content-translations` from `apps/worker/src/pipeline/runProject.ts`
- [ ] T038 [US3] Render the unobtrusive fallback-language note on `apps/web/src/components/MaterialCard.tsx` when `isFallback` is true
- [ ] T039 [US3] Seed one material with a non-English cached title+summary and one left untranslated in `apps/web/src/scripts/seed-public-feed.ts`
- [ ] T040 [US3] Finish every `Materials` key in all five locale files and retire leftover digest-grouped `Project.importance.*` / `Project.filter*` keys that no public surface still reads

**Checkpoint**: All three stories are independently functional — scan, filter, and read in any of the five locales

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Accessibility, responsive layout, leftover surfaces, and quickstart sign-off

- [ ] T041 [P] Verify keyboard tab order and visible focus rings on search, chips, importance switch, and `LocaleSwitcher` (FR-046, FR-047) in `apps/web/src/components/MaterialsFeed.tsx`, `apps/web/src/components/MaterialSearchInput.tsx`, `apps/web/src/components/SourceCategoryFilter.tsx`, `apps/web/src/components/HighImportanceSwitch.tsx`, and `apps/web/src/components/LocaleSwitcher.tsx`
- [ ] T042 [P] Stack header and controls at 320px with no horizontal scroll or clipped labels in `apps/web/src/app/[locale]/projects/[slug]/page.tsx` and `apps/web/src/components/MaterialsFeed.tsx` (FR-044, FR-043 — stay single-column at every width)
- [ ] T043 Confirm title links expose "opens in a new tab" to assistive technology in `apps/web/src/components/MaterialCard.tsx` (FR-050) and that source/importance meaning is in text, not colour alone (FR-048, FR-049)
- [ ] T044 [P] Smoke-check `apps/web/tests/e2e/admin-project-config.spec.ts` and `apps/web/tests/e2e/i18n-locales.spec.ts` still pass after the removed digests route and message-key churn
- [ ] T045 Run the full [quickstart.md](./quickstart.md) gate: backfill script, `seed:public-feed`, manual verification table in all five locales (including OS dark scheme), `pnpm test`, `pnpm test:e2e`, `pnpm lint`, `pnpm typecheck`, `pnpm build`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational — MVP
- **User Story 2 (Phase 4)**: Depends on Foundational; integrates with US1's `page.tsx` / `MaterialCard` but is independently testable via `filterMaterials` + `MaterialsFeed`
- **User Story 3 (Phase 5)**: Depends on Foundational; filter-preserve requires US2 URL state to be meaningful, but locale fallback in `toMaterial` is already in Phase 2
- **Polish (Phase 6)**: Depends on the stories you intend to ship

### User Story Dependencies

- **User Story 1 (P1)**: After Phase 2 only — no dependency on US2/US3
- **User Story 2 (P2)**: After Phase 2; mounts into the US1 page. Filter logic is unit-testable without the page
- **User Story 3 (P3)**: After Phase 2 for fallback data; `LocaleSwitcher` query carry is independently testable; fallback note mounts on US1's card

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Mapping/models before UI
- Server page before client feed controls
- Story complete before moving to the next priority if staffing is sequential

### Parallel Opportunities

- Phase 1: T002 and T003 in parallel after T001's install (or with it)
- Phase 2: T004, T005, T006, T011 in parallel; T009 and T010 after T008; T013 after T012; T015/T016 after T014
- Once Phase 2 is done, US1 UI files (T020, T021, T023) can proceed in parallel
- US2 control components (T028, T029, T030) in parallel after T026
- US3 T036 and T037 in parallel

---

## Parallel Example: User Story 1

```bash
# After Phase 2, launch seed + failing E2E together:
Task: "Extend apps/web/src/scripts/seed-public-feed.ts with five categories and both importance levels"
Task: "Rewrite apps/web/tests/e2e/public-feed.spec.ts for the flat feed"

# Then launch independent UI files together:
Task: "Implement apps/web/src/components/SourceBadge.tsx"
Task: "Implement apps/web/src/components/MaterialCard.tsx"
Task: "Add apps/web/src/app/[locale]/projects/[slug]/error.tsx"
```

## Parallel Example: User Story 2

```bash
# Filter logic + E2E skeleton together:
Task: "Add filterMaterials and empty-state tests in apps/web/src/lib/materials.ts and materials.test.ts"
Task: "Extend apps/web/tests/e2e/public-feed.spec.ts with filter scenarios"

# Then launch the three controls together:
Task: "Implement apps/web/src/components/MaterialSearchInput.tsx"
Task: "Implement apps/web/src/components/SourceCategoryFilter.tsx"
Task: "Implement apps/web/src/components/HighImportanceSwitch.tsx"
```

## Parallel Example: User Story 3

```bash
Task: "Extend apps/web/src/components/LocaleSwitcher.tsx to carry the query string"
Task: "Extend apps/worker/src/pipeline/translate.ts to translate title in the same AI call"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: seed, open `/en/projects/hht-research`, confirm order/badges/links/error boundary
5. Demo if ready — a reader can already scan what is new

### Incremental Delivery

1. Setup + Foundational → materials API returns eligible, locale-resolved items
2. User Story 1 → Test independently → Demo (MVP)
3. User Story 2 → Test independently → Demo (filterable feed)
4. User Story 3 → Test independently → Demo (five-locale feed)
5. Polish → quickstart.md sign-off

### Parallel Team Strategy

1. Team completes Setup + Foundational together
2. Then:
   - Developer A: User Story 1 (page, cards, badges, error.tsx)
   - Developer B: User Story 2 (filter module + controls; merge onto A's page)
   - Developer C: User Story 3 (LocaleSwitcher + worker title translation + fallback note)
3. Coordinate on `page.tsx`, `MaterialCard.tsx`, `materials.ts`, and the five `messages/*.json` files

---

## Notes

- [P] tasks = different files, no dependencies on incomplete work
- [Story] label maps the task to US1 / US2 / US3
- Digests remain the publishing gate (`feedPublishedAt`); they MUST NOT reappear as visual groupings
- The publication detail page at `/{locale}/projects/{slug}/publications/{id}` stays; the feed simply stops linking to it (`research.md` R12)
- Worker still talks to Payload only over REST — do not add direct Postgres access
- Ingestion source types stay at three; guideline/social are display-only
- Zero new public write endpoints (SC-009)
- Commit after each task or logical group
- Stop at any checkpoint to validate the story independently
