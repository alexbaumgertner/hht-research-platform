---
description: 'Task list template for feature implementation'
---

# Tasks: Weekly Digest Issue

**Input**: Design documents from `/specs/005-digest-issue/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: Explicitly requested by the plan (Jest + Playwright are part of the Constitution's
quality gate, Principle IX). Test tasks are included and precede the implementation they cover
where practical.

**Organization**: Tasks are grouped by user story to enable independent implementation and
testing of each story, following the dependency order in [plan.md](./plan.md) §"Implementation
Notes (for `/speckit-tasks`)".

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1–US6)
- Every task includes exact file paths.

## Path Conventions

Existing pnpm monorepo: `apps/web/src/`, `apps/worker/src/`, `packages/shared/src/`. No new
deployable (per plan.md "Project Structure").

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Turn on the required CI check before any feature code lands, per research R16.

- [ ] T001 Add `pnpm --filter @hht/web seed:public-feed` as a step after "Push DB schema" (which
      runs `ensure-schema`) in `.github/workflows/ci.yml`, before the `Playwright` step, with the
      same `env` block already present in the job.
- [ ] T002 Run `pnpm --filter @hht/web seed:public-feed && pnpm test:e2e` locally against the CI
      Postgres config and fix whatever the now-un-skipped seeded specs surface in
      `apps/web/tests/e2e/public-feed.spec.ts`, `apps/web/tests/e2e/public-material-detail.spec.ts`,
      and `apps/web/tests/e2e/monitoring-digest.spec.ts`. Do not touch feature code in this task —
      only fix what the seed step now exposes (contract worker-issue-text.md is unaffected).

**Checkpoint**: CI proves the seeded Playwright specs on every PR, including the future
single-flight spec (T034).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Schema, shared logic, and access-control primitives that every user story's
implementation phase depends on. No user story work can begin until this phase is complete.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

### Schema and hooks (data-model.md §1–§3)

- [ ] T003 Add the new fields (`issueSummaryPoints`, `issueItemSentences`, `issueTextStatus`,
      `issueTextAttempts`, `issueTextError`, `issueTextGeneratedAt`, `issueTextSource`,
      `issueTextRevision`, `hiddenFromPublic`) to `apps/web/src/collections/Digests.ts`, with the
      validation that every `issueSummaryPoints[].items[]` and `issueItemSentences[].publication`
      must be one of the digest's `publications` (data-model.md §1 "Validation and invariants").
- [ ] T004 In `apps/web/src/collections/Digests.ts`, change `beforeValidate`'s "Cannot publish an
      empty digest" check to run only on `create`, or on `update` when `publications` is present in
      the incoming data (data-model.md §1, contract worker-issue-text.md §2.5), so a worker PATCH
      that omits `publications` is not rejected.
- [ ] T005 [P] Determine "owner write vs worker write" in `apps/web/src/access/index.ts` (or the
      shared access helper it already exports, e.g. `isWorkerOrAdmin`/`canUpdateResearchProject`):
      an owner write is any authenticated write that is not the header-only `X-Payload-API-Key` and
      not a `req.user` with the `worker` role (data-model.md §1 "Owner write vs worker write").
      Export a small helper usable from a collection hook to classify the current `req`.
- [ ] T006 Add the revision-bump, owner-edit, and re-queue hook behaviour to
      `apps/web/src/collections/digestHooks.ts`: `beforeChange` bumps `issueTextRevision` when the
      normalized English text (`issueSummaryPoints` text + sorted item ids; `issueItemSentences`
      text by publication id) differs from `originalDoc`; an owner write on that same change also
      sets `issueTextSource: 'edited'`, `issueTextStatus: 'ready'`, `issueTextAttempts: 0`,
      `issueTextError: null` (unless the same save explicitly sets status to `pending`); a change to
      `issueTextStatus: 'pending'` resets `issueTextAttempts` and `issueTextError`. `afterChange`
      (update, revision changed) calls
      `req.payload.db.deleteMany({ collection: 'issue-translations', where: { digest: { equals: id } }, req })`,
      sharing `req` (data-model.md §1 hook table; the documented 504 lesson).
- [ ] T007 [P] Extend `apps/web/tests/e2e/../../src/collections/digestHooks.test.ts` →
      `apps/web/src/collections/digestHooks.test.ts` with cases: revision bump only on a real text
      change (not a no-op re-save); attempts reset on re-queue to `pending`; an owner edit (admin
      session) on a `pending`/`failed` digest → `ready` + `edited`; a worker write (header key or
      `worker` role) keeps `generated` and its own status; an owner edit plus re-queue in the same
      save → `pending` wins (quickstart.md §6).
- [ ] T008 [P] Create `apps/web/src/collections/IssueTranslations.ts`: fields `digest`
      (relationship → `digests`, required, index), `locale` (select `de|tr|ru|uk`, required),
      `status` (select `pending|ready|failed`, required), `sourceRevision` (number, required),
      `leaseExpiresAt` (date), `retryAfter` (date), `attempts` (number, default `1`), `error` (text),
      `summaryPoints` (array of `{ text }`), `itemSentences` (array of
      `{ publication: relationship → publications, sentence }`); a unique compound index on
      `['digest', 'locale']`; `access`: `read: isAuthenticated`, `create`/`update`: deny over REST,
      `delete: isAuthenticated`; admin grouped under "Research", `useAsTitle: 'locale'`, columns
      `digest, locale, status, sourceRevision, updatedAt` (data-model.md §2).
- [ ] T009 [P] Register `IssueTranslations` in `apps/web/src/payload.config.ts`.
- [ ] T010 [P] Add `publishWeekday` (select `monday`…`sunday`), `publishHourUtc` (number, 0–23,
      integer), and `audienceContext` (textarea) to
      `apps/web/src/collections/ResearchProjects.ts`, with `admin.condition` showing
      `publishWeekday`/`publishHourUtc` only for the relevant `schedule` values (data-model.md §3),
      and a `beforeValidate` check rejecting `publishWeekday` without `publishHourUtc` (or the
      reverse) on a weekly project ("Set both publish weekday and hour, or neither").
- [ ] T011 Verify the additive schema pushes cleanly: run
      `pnpm --filter @hht/shared build && pnpm --filter @hht/web ensure-schema` against local
      Postgres (`docker compose up -d`) and confirm no rename prompts (data-model.md §7,
      quickstart.md Prerequisites).

### Shared pure logic (`packages/shared`)

- [ ] T012 [P] Add `PublishWeekdaySchema` (`z.enum([...])`), `ScheduleAnchor` type, and
      `IssueTextStatusSchema` / `IssueTranslationStatusSchema` (`z.enum(['pending','ready','failed'])`)
      to `packages/shared/src/index.ts` (data-model.md §4), re-exporting from `schedule.ts` /
      `issueOrder.ts` as appropriate.
- [ ] T013 [P] Implement `latestScheduledSlot(schedule, anchor, now)` in
      `packages/shared/src/schedule.ts`: weekly with weekday+hour → latest `{weekday} {hour}:00 UTC`
      ≤ `now`; daily with hour → latest `{hour}:00 UTC` ≤ `now`; otherwise `null` (research R5,
      contract worker-issue-text.md §3.1–§3.2). Extend `isProjectDue` and `isProjectStale` to accept
      an optional `anchor` and use the slot-based rule when a slot is returned, falling back to the
      existing interval rule when `null` (backward compatible `ScheduleDueInput`).
- [ ] T014 [P] Add the required test cases to `packages/shared/src/schedule.test.ts`: the R5
      worked-example table row by row; a weekly anchor with a failed 04:00 run due at 05:00, 06:00…
      until success; `monthly` with an anchor set → legacy rule; weekly with no anchor → legacy
      rule; `daily → weekly` switch on a Thursday after a Thursday run → not due until the next
      Monday slot; staleness at Monday 10:01 vs not-stale at 09:59 (contract worker-issue-text.md
      §3.3).
- [ ] T015 [P] Create `packages/shared/src/issueOrder.ts`: `IMPORTANCE_RANK` (`critical` >
      `high` > `medium` > `low` > missing) and `compareIssueItems(a, b)` — raw importance rank desc,
      then `publishedOrUpdatedAt` desc (nulls last), then id asc (research R14, data-model.md §4).
- [ ] T016 [P] Create `packages/shared/src/issueOrder.test.ts` covering importance → date → id
      ordering, including the nulls-last and tie-break cases.

**Checkpoint**: Schema, hooks, and shared ordering/scheduling logic are in place and tested.
User story implementation can now begin.

---

## Phase 3: User Story 1 - Read this week's issue (Priority: P1) 🎯 MVP

**Goal**: A reader who opens a published digest's issue page sees the issue date, a 3–5 point
plain-language summary with traceable links to items, and the full item list with title,
source, date, and one plain-language sentence per item — server-rendered, at 360 px, without
JavaScript.

**Independent Test**: Given a project with at least one published digest with `issueTextStatus:
ready`, open that digest's issue page and confirm the issue date, summary, and material list
(title, source badge, date, one-sentence explanation) are all visible without leaving the page,
and that tapping a material's title opens its existing detail page.

### Worker: generate English issue text (also serves US4's data and US6's plain wording)

- [ ] T017 [US1] Create `apps/worker/src/pipeline/issueText.ts`: prompt builders for (a) per-item
      sentences (batches of ≤ 20 numbered items; structured output `{ items: [{ n, sentence }] }`)
      and (b) the summary (`{ points: [{ text, items: number[] }] }`, 3–5 points from the numbered,
      sentence-annotated items); system-prompt rules from FR-003–FR-006 (plain language, no doses/
      drug-as-advice/treatment changes, nothing beyond the source, cautious wording for early/small
      studies, trial registrations never described as having results); prompt inputs sourced only
      from project data (`name`, `keywords`, `audienceContext`, falling back to "patients and
      families interested in {project name}") and per-item fields (title, kind, `publicationTypes`,
      existing English specialist summary, `abstractOrBody` cut to 1,500 chars), all wrapped in
      `escapeUntrusted` (research R3, R4). Use `packages/shared`'s `compareIssueItems` to number
      items 1..n.
- [ ] T018 [US1] In `apps/worker/src/pipeline/issueText.ts`, implement `validateIssueText()` as a
      pure function: exactly one sentence per item (≤ 35 words); 3–5 points (≤ 120 words total);
      every point references ≥ 1 valid item number (drop invalid numbers, fail if a point is left
      with none); reject on the dose-pattern guard
      (`/\b\d+(?:[.,]\d+)?\s?(mg|mcg|µg|g|ml|iu|units?)\b/i`) and the trial-outcome guard
      (`/\b(results? (show|showed|suggest)|showed|demonstrated|proved|was (effective|safe))\b/i`)
      anywhere in the generated text (research R3, contract worker-issue-text.md §2.3). Map
      validated item numbers back to publication ids.
- [ ] T019 [P] [US1] Create `apps/worker/src/pipeline/issueText.test.ts` covering: mapping numbers
      to publication ids; each validation limit and its failure mode; both guard patterns; the
      single-retry behaviour per step (quickstart.md §6).
- [ ] T020 [US1] Create `apps/worker/src/pipeline/issueSweep.ts`: `sweepIssueText()` — select
      work via `GET /api/digests?depth=0&limit=20&sort=publishedAt` with the `or`/`and` where
      clauses from contract worker-issue-text.md §2.1 (pending, unset, or failed with attempts < 3);
      for each digest (isolated `try`), load the project (`name`, `keywords`, `audienceContext`) and
      its items (`select` fields per §2.2), generate + validate (retry each failing step once), then
      PATCH success (`issueSummaryPoints`, `issueItemSentences`, `issueTextStatus: 'ready'`,
      `issueTextSource: 'generated'`, `issueTextGeneratedAt`, `issueTextError: null`) or failure
      (`issueTextStatus: 'failed'`, `issueTextAttempts: prev + 1`, `issueTextError` ≤ 300 chars, plus
      `logError('issue text generation failed', …)`); on a 4xx from the selection query, log WARN
      `sweep skipped: cms rejected query` and return without PATCHing; on 5xx/network errors, log
      ERROR `sweep list failed` (contract worker-issue-text.md §2.4–§2.6, §4 observability table).
- [ ] T021 [US1] Add `listIssueTextWork`, `getProject`, `listPublicationsForIssue`, and
      `patchDigest` methods to `apps/worker/src/cms/client.ts` for the requests in T020, and update
      `createDigest` in the same file (and its call in `apps/worker/src/pipeline/runProject.ts`) to
      send `issueTextStatus: 'pending'` on every new digest (contract worker-issue-text.md §1, §2.4;
      research R2).
- [ ] T022 [US1] Wire `sweepIssueText()` into `apps/worker/src/index.ts`'s `main()` so it always
      runs after the due-project loop, even when no project was due, without affecting run status or
      watermarks on a sweep failure (contract worker-issue-text.md §1).
- [ ] T023 [P] [US1] Create `apps/worker/src/pipeline/issueSweep.test.ts` covering: selection
      filter (pending/unset/failed<3, excluding hidden-but-otherwise-eligible… hidden digests ARE
      included per R10), the `failed` attempt cap at 3, per-digest isolation (one failure doesn't
      stop the sweep), the 4xx-vs-5xx WARN/ERROR distinction, and the success/failure PATCH bodies
      (quickstart.md §6).

### Web: read path (English-only first)

- [ ] T024 [US1] Create `apps/web/src/lib/issueQueries.ts` (server-only): loaders for a visible
      digest by id (excluding `hiddenFromPublic`) with its ordered items (`compareIssueItems`), and
      for the archive list, reusing `toMaterial` (existing `materials.ts`) for item title/source/
      date/importance and `content-translations` fallback (data-model.md §5, contract
      public-issues-api.md).
- [ ] T025 [US1] Create `apps/web/src/lib/issues.ts`: DTO mapping to `IssueSummaryListItem`
      (`id`, `date`, `itemCount`, `excerpt`, `displayedLocale`, `isFallback`) and `IssueDetail`
      (`id`, `date`, `project`, `summary`/`null`, `items` with `sentence` and
      `isTrialRegistration`, `displayedLocale`, `isFallback`, `translation.status`,
      `meta.title`/`meta.description`), matching the field rules in contract
      public-issues-api.md §1–§2 (English-only for this task; translation fields default to
      `not-needed`/English until T033).
- [ ] T026 [P] [US1] Create `apps/web/src/lib/issues.test.ts` covering DTO mapping, the
      `summary === null` / "not available yet" case, fallback flags, and `meta.description`
      truncation to ≤ 160 chars at a word boundary (quickstart.md §6).
- [ ] T027 [US1] Create `apps/web/src/app/api/public/projects/[slug]/issues/route.ts`: the
      archive list endpoint (`?locale=`, `?limit=` 1–100 default 100), `Cache-Control: no-store`,
      404 body `{ "error": "Not found" }` for unknown project, sorted `publishedAt` desc then `id`
      desc, never triggering a translation (contract public-issues-api.md §1).
- [ ] T028 [US1] Create `apps/web/src/app/api/public/projects/[slug]/issues/[id]/route.ts`: the
      issue detail endpoint, `export const maxDuration = 60`, `?locale=` validated to
      `en|de|tr|ru|uk` (400 on anything else), 404 for unknown/wrong-project/hidden issue with the
      same body as unknown, `Cache-Control: no-store` (contract public-issues-api.md §2). For this
      task, always serve English (`translation.status: 'not-needed'` for any locale); the real
      translation wait/claim logic is added in T033.
- [ ] T029 [US1] Create `apps/web/src/components/IssueView.tsx`: the issue page body — `<h1>`
      heading, summary `<ol>` with "Based on:" anchors `#item-{id}` (or the "not available yet"
      line when `summary === null`), items `<ol>` with `id="item-{id}"`, number, title link to the
      material detail page, `SourceBadge`, trial-registration label, date, sentence — fully server-
      rendered with no client JavaScript (contract issue-pages.md §2).
- [ ] T030 [P] [US1] Create `apps/web/src/components/IssueArchiveList.tsx` and
      `apps/web/src/components/LatestIssueCard.tsx` (used by US4, stubbed/wired here since they
      share the same DTOs) — deferred styling only; data plumbing lands with US4's T038–T039.
- [ ] T031 [US1] Create the issue route tree in
      `apps/web/src/app/[locale]/projects/[slug]/issues/[issueId]/page.tsx`,
      `not-found.tsx`, and `error.tsx` (mirroring the 003 material-detail pattern), rendering
      `IssueView` from the detail endpoint via a `cache()`-wrapped fetch shared with
      `generateMetadata` (T041) (contract issue-pages.md §1–§2).
- [ ] T032 [P] [US1] Create `apps/web/tests/e2e/public-issue.spec.ts` covering US1's flows:
      summary → anchors → items → material detail navigation, the "summary not available yet" path
      for a `pending` digest, a 360 px viewport with JavaScript disabled (no horizontal scroll,
      anchors work), against the seed fixtures added in T054 (quickstart.md §1, §6).

**Checkpoint**: User Story 1 is fully functional and testable independently in English.

---

## Phase 4: User Story 2 - Share a link that previews well (Priority: P1)

**Goal**: Pasting a published issue's URL into Telegram, VK, WhatsApp, or Facebook shows a rich
preview: a project-and-date title, a one-line description from the issue summary, and an image,
in the reader's locale.

**Independent Test**: Paste a published issue's URL into a link-preview tool (or curl with a
bot user agent) and confirm the preview shows a project-and-date title, a summary-derived
description, and an image.

### Implementation for User Story 2

- [ ] T033 [US2] Set `htmlLimitedBots` in `apps/web/next.config.ts` to Next's built-in bot
      pattern plus `TelegramBot|Viber`, and add `outputFileTracingIncludes` for the
      `opengraph-image` routes created in T036–T038 (research R11, R12; contract issue-pages.md
      §3, §5).
- [ ] T034 [P] [US2] Create `apps/web/src/lib/metadata.ts`: a shared builder for
      `openGraph`/`twitter` metadata that keeps the inherited `og:image` on pages that set their own
      `openGraph` object (either by leaving `openGraph.images` to the file convention and proving it
      survives, or by setting `images` explicitly to the project image URL) (research R12, contract
      issue-pages.md §3).
- [ ] T035 [US2] Add `generateMetadata` to `apps/web/src/app/[locale]/layout.tsx`
      (`metadataBase`, `title.template`, default description, `openGraph.siteName`/`locale`,
      `alternates.languages` for all five locales) and to
      `apps/web/src/app/[locale]/page.tsx`, `apps/web/src/app/[locale]/projects/[slug]/page.tsx`,
      the archive page (T039), the issue page (T031), and
      `apps/web/src/app/[locale]/projects/[slug]/publications/[publicationId]/page.tsx`, per the
      route table in contract issue-pages.md §3, each also emitting
      `twitter.card = 'summary_large_image'`.
- [ ] T036 [P] [US2] Add IBM Plex Sans Regular/SemiBold TTF fonts (with their OFL license) to
      `apps/web/assets/fonts/`.
- [ ] T037 [P] [US2] Create `apps/web/src/app/[locale]/opengraph-image.tsx` (site card:
      `Site.name` + `Site.tagline`) using `next/og` `ImageResponse`, 1200×630 PNG, Node runtime,
      reading the committed fonts (contract issue-pages.md §5).
- [ ] T038 [US2] Create `apps/web/src/app/[locale]/projects/[slug]/opengraph-image.tsx`
      (project name + `Project.imageTagline`, falling back to the site card if the project fails to
      load) and
      `apps/web/src/app/[locale]/projects/[slug]/issues/[issueId]/opengraph-image.tsx`
      (project name + localized issue date + `Issue.imageCount`, falling back to the project card if
      the issue is hidden, unknown, or fails to load — FR-010), both via `issueQueries.ts` (T024),
      never triggering or waiting for translation (contract issue-pages.md §5).
- [ ] T039 [P] [US2] Create `apps/web/tests/e2e/share-metadata.spec.ts`: a `TelegramBot` user
      agent request to the issue, archive, **and material detail** pages returns `<head>` containing
      `og:title`, `og:description`, and an absolute `og:image`; the image route returns
      `200 image/png` (quickstart.md §4, §6; research R11 inheritance risk).

**Checkpoint**: User Stories 1 AND 2 both work independently; shared previews are rich and
localized.

---

## Phase 5: User Story 3 - Trust signals (Priority: P1)

**Goal**: Every issue page and material detail page shows a medical disclaimer and an
AI-generated label, in the reader's active locale.

**Independent Test**: Open any published issue page and any material detail page and confirm
both display the disclaimer text and the AI-generated label, in the active locale.

### Implementation for User Story 3

- [ ] T040 [P] [US3] Create `apps/web/src/components/TrustNotice.tsx`: a server component with
      no client JavaScript rendering `Trust.disclaimer` and `Trust.aiLabel` from next-intl messages,
      containing no disease names (contract issue-pages.md §4, FR-011).
- [ ] T041 [US3] Render `TrustNotice` on the issue page (`IssueView.tsx`, below the summary and
      at the end, per contract issue-pages.md §2 step 4) and on
      `apps/web/src/app/[locale]/projects/[slug]/publications/[publicationId]/page.tsx`.
- [ ] T042 [P] [US3] Add the `Trust.disclaimer` and `Trust.aiLabel` keys to
      `apps/web/messages/{en,de,tr,ru,uk}.json` (contract issue-pages.md §6).
- [ ] T043 [P] [US3] Extend `apps/web/tests/e2e/public-issue.spec.ts` (or a shared assertion
      used by it and the material-detail spec) to confirm the disclaimer and AI-generated label
      render on both the issue page and the material detail page, across all five locales
      (quickstart.md §1, §6).

**Checkpoint**: User Stories 1, 2, and 3 all work independently; every reader-facing page ships
with trust signals from day one.

---

## Phase 6: User Story 4 - Browse past issues (Priority: P2)

**Goal**: A reader on the project page sees the latest issue presented prominently, with a link
to an archive of every past issue for that project, newest first; the flat materials feed
remains available unchanged.

**Independent Test**: Given a project with two or more published issues, open the project page,
confirm the latest issue is prominently featured, follow the archive link, and confirm every
published issue is listed newest first, each linking to its issue page.

### Implementation for User Story 4

- [ ] T044 [US4] Finish `apps/web/src/components/LatestIssueCard.tsx` (date + excerpt, "Read
      this issue" and "All issues" links) fed by `GET …/issues?limit=1`, and
      `apps/web/src/components/IssueArchiveList.tsx` (every visible issue, newest first, each row
      showing date/item count/excerpt, linking to its issue page) fed by `GET …/issues` (contract
      public-issues-api.md §1, contract issue-pages.md §1).
- [ ] T045 [US4] Update `apps/web/src/app/[locale]/projects/[slug]/page.tsx` to render
      `LatestIssueCard` above the unchanged flat materials feed (FR-019), with `Project.noIssuesYet`
      shown when there is no visible issue yet.
- [ ] T046 [US4] Create `apps/web/src/app/[locale]/projects/[slug]/issues/page.tsx` (the
      archive) rendering `IssueArchiveList`, with `generateMetadata` per contract issue-pages.md §3
      (`Issue.archiveMetaTitle`, inherited project image).
- [ ] T047 [P] [US4] Extend `apps/web/tests/e2e/public-issue.spec.ts` (or a new archive-focused
      spec) with: the latest-issue card on the project page, the archive listing newest first with
      working links, a hidden digest absent from both while its materials stay in the flat feed
      (quickstart.md §2, §6).

**Checkpoint**: User Stories 1–4 all work independently; readers and the chat admin can find any
past issue.

---

## Phase 7: User Story 5 - Read in my language (Priority: P2)

**Goal**: A reader in German, Turkish, Russian, or Ukrainian sees issue-level text translated on
first request and cached; concurrent first requests trigger at most one translation; edits/
regeneration invalidate cached translations.

**Independent Test**: Open a published issue in a locale with no cached translation, confirm
English-with-note or a translation appears within ~8 s, reopen in the same locale and confirm
the cached translation is served instantly with no new delay.

### Implementation for User Story 5

- [ ] T048 [US5] Create `apps/web/src/lib/issueTranslator.ts`: a translator interface with a
      `gateway` implementation (using the existing `ai` + `@ai-sdk/gateway` packages,
      `AI_GATEWAY_API_KEY`/`AI_GATEWAY_MODEL`, default model `openai/gpt-4o-mini`) and a `stub`
      implementation returning deterministic `[<locale>] …` text with a configurable delay
      (`ISSUE_TRANSLATOR_STUB_DELAY_MS`), selected via `ISSUE_TRANSLATOR` and refusing `stub` when
      `VERCEL_ENV === 'production'` (research R6, contract public-issues-api.md §4).
- [ ] T049 [US5] Create `apps/web/src/lib/issueTranslation.ts`: the claim/wait/reclaim state
      machine against the `issue-translations` collection — read the `(digest, locale)` row; serve
      `ready` rows matching `sourceRevision`; treat `pending` with a live lease as "wait" (poll
      every 400 ms); treat `failed` with `retryAfter` in the future as "serve English, no retry";
      otherwise reclaim (delete the old row by id) then claim (`create` with
      `leaseExpiresAt: now + 120s`); on a lost race (create fails, a row now exists), fall back to
      "wait"; on success, own the translation and later `update` the claimed row's id to `ready` or
      to `failed` with `retryAfter: now + 15min` (discarding the result if the row was deleted by an
      edit in the meantime) (research R7, R9, data-model.md §2). Behind an interface so it can be
      tested against an in-memory unique-key fake store.
- [ ] T050 [P] [US5] Create `apps/web/src/lib/issueTranslation.test.ts` against a unique-key
      fake store: lost race → waiter; expired lease → reclaim by id; cooldown respected; revision
      mismatch → reclaim (quickstart.md §6).
- [ ] T051 [US5] Wire the wait-then-fallback flow into
      `apps/web/src/app/api/public/projects/[slug]/issues/[id]/route.ts`: for a non-`en` locale,
      start `translateAndStore()` (using T048/T049) as a promise registered with `after()` from
      `next/server`, `await Promise.race([promise, sleepUntil(deadline)])` with
      `deadline = requestStart + 8000ms`; respond translated if resolved in time, else English with
      `translation.status: 'pending'`; a waiter (lost the race or found a live lease) polls the row
      every 400 ms until `ready`/`failed`/deadline; crawlers get the identical code path (no
      user-agent branching) (research R8, contract public-issues-api.md §2 timing table).
- [ ] T052 [US5] Ensure `apps/web/src/app/api/public/projects/[slug]/issues/route.ts` (archive)
      and the latest-issue-card query never trigger a translation — they only use an existing
      `ready` row matching `sourceRevision`, else English (contract public-issues-api.md §1, "Never
      triggers a translation").
- [ ] T053 [US5] Create
      `apps/web/src/app/api/test/issue-translations/route.ts`: a test-only reset/read endpoint that
      returns 404 unless `ISSUE_TRANSLATOR=stub` and `VERCEL_ENV !== 'production'`, used by the
      single-flight spec to clear rows for its dedicated digest and to read row count/`attempts`
      (research R16, quickstart.md §3).
- [ ] T054 [US5] Extend `apps/web/src/scripts/seed-public-feed.ts` with: a digest with
      `issueTextStatus: ready`, 3 summary points (with item refs) and one sentence per item
      including one ClinicalTrials.gov item; a digest with `issueTextStatus: pending` and no text; a
      digest with `hiddenFromPublic: true` whose materials stay in the feed; and a digest reserved
      for the single-flight spec (quickstart.md Prerequisites, §6).
- [ ] T055 [P] [US5] Create `apps/web/tests/e2e/issue-translation.spec.ts`: 8 concurrent
      `GET`s for one untranslated issue+locale → exactly one `issue-translations` row with
      `attempts === 1` (via the T053 reset route, clearing state first so CI's `retries: 2` doesn't
      see a stale row); a slow stub → English + `pending` note within 8 s, then translated on
      reload; an edit/regeneration invalidation case (quickstart.md §3, §6).
- [ ] T056 [US5] Add `Issue.translationPending` / `Issue.translationUnavailable` rendering to
      `IssueView.tsx` when `isFallback` is true, matching `translation.status` (contract
      issue-pages.md §2 step 3).

**Checkpoint**: User Stories 1–5 all work independently; the primary Russian-speaking audience
gets translated issues with a database-enforced single-flight guarantee.

---

## Phase 8: User Story 6 - Plain site chrome (Priority: P3)

**Goal**: Header, page titles, and descriptions read as plain, welcoming, patient-facing
language across all five locales, with no internal/technical terminology.

**Independent Test**: Review the site header, homepage/project titles, and meta descriptions
across all five locales and confirm no internal/technical wording remains and all text reads as
addressed to a patient.

### Implementation for User Story 6

- [ ] T057 [US6] Replace the hardcoded header string in
      `apps/web/src/app/[locale]/layout.tsx` with `Site.name`, and rewrite `Home.*` /
      `Project.*` message strings in `apps/web/messages/{en,de,tr,ru,uk}.json` for a patient
      audience (no "Research Monitoring", no "configured research projects"), per the key list in
      contract issue-pages.md §6.
- [ ] T058 [P] [US6] Add the remaining new message keys from contract issue-pages.md §6
      (`Site.description`/`tagline`, `Home.metaTitle`, `Project.metaDescription`/`imageTagline`/
      `imageAlt`/`latestIssueHeading`/`readIssue`/`allIssues`/`noIssuesYet`, and the full `Issue.*`
      set) to all five locale files, keeping wording plain and disease-name-free (FR-018).
- [ ] T059 [P] [US6] Add or extend an i18n coverage check (reusing the pattern in
      `apps/web/tests/e2e/i18n-locales.spec.ts`) confirming the header, homepage/project titles, and
      meta descriptions contain no leftover internal terminology across all five locales
      (quickstart.md's "Done when", FR-018 acceptance scenario).

**Checkpoint**: All user stories (US1–US6) are independently functional. The full feature is
ready for cross-cutting polish.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Rollout readiness, documentation, and the checks that span multiple stories.

- [ ] T060 [P] Update `docs/deploy-worker.md` with the note that `AI_GATEWAY_API_KEY` is now
      required on Vercel (Production and Preview) for issue-text translation (research R6, plan.md
      Project Structure).
- [ ] T061 Update `apps/web/src/lib/health.ts` and `apps/web/src/app/api/health/route.ts` to pass
      the new anchor fields (`publishWeekday`, `publishHourUtc`) through to the anchor-aware
      `isProjectStale`, keeping the response shape unchanged (contract worker-issue-text.md §3,
      contract public-issues-api.md §3).
- [ ] T062 Update `apps/worker/src/cms/client.ts`'s `listDueProjects` to read `publishWeekday`
      and `publishHourUtc` from `GET /api/research-projects?depth=1&…` and pass them as `anchor` to
      `isProjectDue` (contract worker-issue-text.md §3.1).
- [ ] T063 [P] Run the full automated check suite from quickstart.md §6
      (`pnpm lint && pnpm format:check && pnpm typecheck`, `pnpm test`,
      `pnpm --filter @hht/web seed:public-feed && pnpm test:e2e`) and fix any remaining failures.
- [ ] T064 Walk the production rollout checklist in quickstart.md §7 up through step 6 (schema
      deploy, historical-digest backfill review per SC-004, setting `hht` to weekly with
      `audienceContext`, confirming `/api/health` stays 200, confirming the first unattended Monday
      publish) and record the outcome for SC-003/SC-004.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately.
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories.
- **User Stories (Phase 3–8)**: All depend on Foundational phase completion.
  - US1, US2, US3 are all P1 and largely independent of each other, but US2's metadata work
    (T035) and US3's `TrustNotice` (T041) both attach to the issue page built in US1 (T031), so
    in practice US1 lands first even though it is not a formal blocker for US2/US3's own code.
  - US4 depends on US1's DTOs/endpoints (T024–T028) existing.
  - US5 depends on US1's issue detail route (T028) existing to wrap with the wait/claim logic.
  - US6 is independent polish and can proceed any time after Foundational.
- **Polish (Phase 9)**: Depends on all desired user stories being complete.

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational — no dependencies on other stories.
- **User Story 2 (P1)**: Can start after Foundational; its metadata/image work reads issue data
  produced by US1's `issueQueries.ts`/`issues.ts` (T024–T025), so implement after or alongside
  US1.
- **User Story 3 (P1)**: Can start after Foundational; independent component, attaches to pages
  from US1 and to the existing material detail page.
- **User Story 4 (P2)**: Depends on US1's archive/detail DTOs and endpoints (T024–T028).
- **User Story 5 (P2)**: Depends on US1's issue detail route (T028).
- **User Story 6 (P3)**: Independent of the other stories; only touches messages and chrome.

### Within Each User Story

- Worker generation (US1) before web read path, since the web DTOs assume `issueTextStatus`/
  `issueSummaryPoints`/`issueItemSentences` exist.
- Tests are written alongside (marked `[P]` where they touch only test files) their
  implementation task and must fail before that implementation lands.
- Models/collections before services; services before routes; routes before UI.

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel (there are none beyond T001→T002, which are
  sequential).
- Foundational: T005, T007–T010, T012–T016 are all [P] (different files).
- Once Foundational completes: US1, US2 (partially), US3, and US6 can start in parallel by
  different people; US4 and US5 start once US1's read-path files exist.
- Within US1: T019, T023, T026, T030, T032 are [P] (test/component files independent of the
  main sequential chain).
- Within US2: T034, T036, T037, T039 are [P].
- Within US3: T040, T042, T043 are [P].
- Within US5: T050, T055 are [P].
- Within US6: T058, T059 are [P].
- Within Polish: T060, T063 are [P].

---

## Parallel Example: User Story 1

```bash
# After T017–T022 (worker) and T024–T025 (DTOs) land, these can run together:
Task: "Create apps/worker/src/pipeline/issueText.test.ts"
Task: "Create apps/worker/src/pipeline/issueSweep.test.ts"
Task: "Create apps/web/src/lib/issues.test.ts"
Task: "Create apps/web/src/components/IssueArchiveList.tsx and LatestIssueCard.tsx (data plumbing deferred to US4)"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (turn on CI seeding).
2. Complete Phase 2: Foundational (schema, hooks, shared schedule/order logic) — CRITICAL,
   blocks all stories.
3. Complete Phase 3: User Story 1 (worker generation + English read path + issue page).
4. **STOP and VALIDATE**: run quickstart.md §1 manually and `public-issue.spec.ts`.
5. Deploy/demo if ready — this alone makes a published digest visible and readable for the
   first time.

### Incremental Delivery

1. Setup + Foundational → foundation ready.
2. US1 → English issue pages readable and traceable → deploy/demo (MVP).
3. US2 → rich, localized share previews → deploy/demo.
4. US3 → trust notice on every reader page → deploy/demo (per the plan, do not ship US1 without
   US3 in the same release — Principle IV / roadmap risk note says trust signals ship with the
   first reader-visible page).
5. US4 → archive and latest-issue card → deploy/demo.
6. US5 → on-demand translation with single-flight → deploy/demo (closes the primary
   Russian-speaking audience gap).
7. US6 → plain chrome copy → deploy/demo.
8. Polish → rollout checklist, health/schedule wiring, docs.

### Parallel Team Strategy

With multiple developers, after Foundational:

- Developer A: US1 (worker sweep + web read path + issue page) — the critical path others
  depend on.
- Developer B: US3 (`TrustNotice`) and US6 (chrome/messages) in parallel — no dependency on US1
  internals beyond where the component is mounted.
- Developer C: starts US2's metadata/image scaffolding (T033–T037, which don't need real issue
  data) while waiting for US1's DTOs, then finishes T038–T039 once US1 lands.
- Once US1 lands: Developer A moves to US5 (translation), Developer B/C pick up US4 (archive/
  latest-issue card).

---

## Notes

- [P] tasks = different files, no dependencies.
- [Story] label maps task to specific user story for traceability.
- Per research R2/R15, generation is worker-only and all schema changes are additive — no task
  here should rename or remove an existing field.
- Per research R16, T001–T002 (CI seeding) must land and be green before any other feature
  code, so failures it surfaces are fixed in isolation.
- Do not cut US3 (trust notice) or US2 (share previews/OG images) to save time — the plan and
  roadmap explicitly flag both as risks if deferred.
- Commit after each task or logical group; stop at any checkpoint to validate a story
  independently.
