---
description: 'Task list for 014 Embeddable Widget'
---

# Tasks: Embeddable Widget

**Input**: Design documents from `/specs/014-embeddable-widget/`

**Prerequisites**: [`plan.md`](./plan.md), [`spec.md`](./spec.md), [`research.md`](./research.md), [`data-model.md`](./data-model.md), [`contracts/`](./contracts/), [`quickstart.md`](./quickstart.md)

**Tests**: Included. `CLAUDE.md` requires "Tests first from the spec's acceptance criteria", and
Constitution IX requires Jest and Playwright gates. Each test task MUST be written and seen to
fail before the implementation task it covers.

**Organization**: Tasks are grouped by user story (spec.md US1–US5) so each story can be
implemented and verified on its own.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an unfinished task)
- **[Story]**: US1–US5 from spec.md. Setup, Foundational, Polish and Launch tasks have no story label.
- Paths are repo-relative. `apps/web` is the Next.js + Payload app, and `packages/shared` holds
  the pure shared logic.

## Path conventions

- Shared logic and its tests: `packages/shared/src/*.ts` and `*.test.ts` (Jest)
- Web unit tests: `apps/web/src/**/*.test.ts` (Jest, `testMatch: **/src/**/*.test.ts`)
- E2E: `apps/web/tests/e2e/*.spec.ts` (Playwright). Fixtures: `apps/web/tests/fixtures/`
- Commands (truncate output): `pnpm check 2>&1 | tail -50`,
  `pnpm --filter @hht/web test:e2e -- embed 2>&1 | tail -50`,
  `pnpm --filter @hht/web generate:types`
- Never point a local process at the production database (`CLAUDE.md`).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Settle the one open technical question, and add test infrastructure.

- [ ] T001 Spike the Next.js 16.3.3 cache APIs in a throwaway route under `apps/web/src/app/embed/_spike/[id]/route.ts`. Delete it afterwards and don't commit it. Using `next build && next start`, confirm all of these:
  - a route handler with `export const dynamic = 'force-static'`, `export const revalidate = 3600`, `export const dynamicParams = true` and `generateStaticParams() { return [] }` is cached per path;
  - custom response headers (`Content-Security-Policy`, `X-Robots-Tag`) are served unchanged from the cache;
  - `revalidateTag('t', { expire: 0 })`, called from a Payload hook context (a route handler), makes the next request re-render.

  Record the outcome under "To verify in implementation" in `specs/014-embeddable-widget/research.md` R3. If any check fails, switch the plan to R3's fallback (dynamic handler + `Cache-Control: public, s-maxage=300`) and note it there before T020.

- [ ] T002 [P] Add the dev dependency `@axe-core/playwright` with `pnpm --filter @hht/web add -D @axe-core/playwright`, and commit the lockfile. It is justified in plan.md Complexity Tracking. Don't add any runtime dependency.
- [ ] T003 [P] Add the `Widget` namespace to `apps/web/messages/en.json`, `de.json`, `tr.json`, `ru.json` and `uk.json`, with these keys: `frameTitle`, `heading`, `summaryHeading`, `moreItems` (ICU plural on `count`), `allIssues`, `firstIssueComing`, `subscribeHeading`, `subscribeButton`, `fallbackSentence`, `fallbackCommunity`, `fallbackSubscribe`.
  - Plain, patient-facing wording (spec 005 FR-018). No disease names. Use `{projectName}` and `{date}` placeholders.
  - Reuse the existing `Issue.*`, `Subscribe.*` and `Trust.*` keys instead of duplicating them (contract `embed-page.md` "Messages").
- [ ] T004 [P] Create the two-origin fixture `apps/web/tests/fixtures/partner-host.html` (quickstart §2). It contains:
  - a `data-digest-widget` container with `data-project="hht-research"`, `data-partner="e2e-partner"`, `data-locale="ru"` and a fallback `<p>` with two links;
  - `<script async src="http://localhost:3000/embed/v1.js">`;
  - some text above and below, so resizing is visible.

  Also create `apps/web/tests/fixtures/partner-host-iframe.html` with the plain frame snippet from contract `embed-snippet.md`, using `height="900"`.

- [ ] T005 [P] Create the Playwright helper `apps/web/tests/e2e/embed-helpers.ts`. It exports:
  - `servePartnerHost(page, origin, html)`, which uses `page.route(origin + '/**')` to fulfil the given HTML for `http://partner.test` (allowed) and `http://blocked.test` (not allowed);
  - `snippetHtml({ partner, locale, items, theme, subscribe })`, which renders the script snippet pointing at the test `baseURL`;
  - `widgetFrame(page)`, which returns the frame locator.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared parsing rules, the schema changes and seed data that every story depends on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

### Tests first

- [x] T006 [P] Write failing tests in `packages/shared/src/chatSource.test.ts`:
  - `parseSourceToken`: accepts `vk`, `wa`, `fb`, `tg` and any `site:<key>` where the key matches `^[a-z0-9][a-z0-9-]{1,31}$`. Returns `other` for missing values, `site:`, `site:-x`, `site:UPPER`, a key longer than 32 chars, and `site:a b`.
  - `resolveSubscriptionSource(value, partnerKeys)`: returns `site:<key>` only when `<key>` is in `partnerKeys`, otherwise `other`. Chat sources pass through.
  - `partnerSource(key)`: returns `site:<key>`.
  - `parseChatSource` is unchanged.
- [x] T007 [P] Write failing tests in `packages/shared/src/embed.test.ts`:
  - `PartnerKeySchema` (`^[a-z0-9][a-z0-9-]{1,31}$`).
  - `normalizeEmbedOrigin`:
    - returns the lowercased `scheme://host[:port]`;
    - rejects a path, query, fragment, `*` wildcard, userinfo and non-http(s) schemes;
    - requires `https:` "except `http:` for `localhost`, `127.0.0.1` and `*.test`";
    - drops a default port.
  - `parseEmbedOptions` / `formatEmbedOptions`:
    - accepts `^(auto|light|dark)-([1-9]|1[0-9]|20)-(form|link)$`;
    - invalid parts fall back to `auto`, `3`, `form`;
    - returns `{ canonical, changed }` so the route can 308;
    - round-trips.
  - Notice segment mapping: `check-inbox|need-consent|bad-email|try-later` ↔ `check_inbox|need_consent|bad_email|try_later`.

### Implementation

- [x] T008 Implement `parseSourceToken`, `resolveSubscriptionSource` and `partnerSource`, plus the `PARTNER_SOURCE_PREFIX = 'site:'` constant and the `SubscriptionSource` type, in `packages/shared/src/chatSource.ts` until T006 passes. Leave `CHAT_SOURCES` and `parseChatSource` unchanged.
- [x] T009 Implement `PartnerKeySchema`, `normalizeEmbedOrigin`, `EmbedTheme`/`EmbedMode` types, `parseEmbedOptions`, `formatEmbedOptions`, `EMBED_NOTICES` and `noticeToSegment`/`segmentToNotice` in the new `packages/shared/src/embed.ts`, until T007 passes. Re-export them from `packages/shared/src/index.ts` and build with `pnpm --filter @hht/shared build`.
- [x] T010 Add the `embedPartners` array field to `apps/web/src/collections/ResearchProjects.ts`, in a new "Embedding" collapsible, with the same write access as the other project settings. Rows:
  - `name`: text, required. "Max 80 chars."
  - `key`: text, required, validated with `PartnerKeySchema`. "Unique within the project", enforced by a `beforeValidate` hook across rows.
  - `origins`: array of `{ origin: text }`, `minRows: 1`. Each value goes through `normalizeEmbedOrigin` in `beforeValidate`, invalid values are rejected with a readable error, and "Duplicates are rejected".
  - `fallbackCommunityUrl`: text, optional, must be an `https:` URL.

  Confirm the public project API (`apps/web/src/app/api/public/projects/[slug]/route.ts` and `.../projects/route.ts`) doesn't expose `embedPartners`.

- [x] T011 [P] Change `source` in `apps/web/src/collections/Subscribers.ts` from `select` (`chatSourceOptions`) to `type: 'text'`, `required: true`, `defaultValue: 'other'`, with a `validate` that requires `^(vk|wa|fb|tg|other|site:[a-z0-9][a-z0-9-]{1,31})$`. Keep `defaultColumns` as they are. Data model: "Nothing else is stored".
- [x] T012 [P] In `apps/web/src/collections/AnalyticsCounts.ts`:
  - change `source` from `select` to `text` with the same `validate` as T011, and keep the unique index on `(project, issueKey, source, metric)` unchanged;
  - add the `metric` options `{ label: 'Widget view', value: 'widget_view' }` and `{ label: 'Outbound click', value: 'outbound_click' }`.
- [x] T013 Add `partnerKeysOf(project)` and `findEmbedPartner(project, key)` to the new `apps/web/src/lib/embed/partners.ts`. They read `embedPartners` defensively, because generated types may lag.
- [x] T014 Change `apps/web/src/lib/analyticsCounts.ts`:
  - add `widget_view | outbound_click` to `AnalyticsMetric`;
  - take an already-resolved `source: SubscriptionSource` instead of calling `parseChatSource`.

  Update the three callers to resolve the source with `resolveSubscriptionSource(value, partnerKeysOf(project))`:
  - `apps/web/src/app/api/public/projects/[slug]/subscribe/route.ts` (`form_submit`);
  - `apps/web/src/app/[locale]/projects/[slug]/issues/[issueId]/page.tsx` (`page_view`), where `findProjectBySlug` must now also return `embedPartners`, in `apps/web/src/lib/issueQueries.ts`;
  - `apps/web/src/app/[locale]/subscribe/confirm/[token]/page.tsx` (`confirmation`, using the subscriber's stored `source` as is).

- [x] T015 Exclude `embed` from the `matcher` in `apps/web/src/proxy.ts`, alongside `api`, `admin`, `_next` and `_vercel`. This keeps next-intl from redirecting `/embed/ru/...` to `/en/embed/...`, and means the proxy never sets the `src` cookie on embed responses (FR-016). Keep the existing patterns for locale pages.
- [x] T016 Regenerate the Payload types with `pnpm --filter @hht/web generate:types` and push the schema to the **local Docker** database only (`pnpm --filter @hht/web dev` starts the push). Confirm that `subscribers.source` and `analytics_counts.source` are `varchar` locally and existing rows keep their values. Run `pnpm check 2>&1 | tail -50`.
- [x] T017 Extend the seed in `apps/web/src/scripts/seed-public-feed.ts` so `hht-research` gets `embedPartners: [{ name: 'E2E partner', key: 'e2e-partner', origins: [{ origin: 'http://127.0.0.1:4310' }, { origin: 'http://partner.test' }] }]`. It must be idempotent: update the row on re-run, don't duplicate it.

**Checkpoint**: shared rules are tested, the schema accepts `site:<key>`, the e2e partner is seeded, and `/embed/*` bypasses the proxy.

---

## Phase 3: User Story 1 - Latest issue on the partner site (Priority: P1) 🎯 MVP

**Goal**: An allowed partner origin can frame `/embed/{locale}/{slug}/{partner}/{options}` and see the latest visible issue: date, summary, first N items, links, disclaimer and AI label. Other origins can't. Hiding an issue removes it.

**Independent Test**: Load `apps/web/tests/fixtures/partner-host-iframe.html` (plain frame, no loader) via `http://partner.test`. The latest visible issue renders with 3 items and every required element. The same page via `http://blocked.test` renders none of our content. After hiding the latest issue, a reload shows the previous issue (spec US1 Independent Test).

### Tests for User Story 1 ⚠️

- [ ] T018 [P] [US1] Write failing tests in `apps/web/src/lib/embed/renderEmbed.test.ts`, using a pure `EmbedModel` fixture:
  - titles, sentences and the project name contain `<script>`, `"`, `'`, `&` and a `javascript:` item URL, and none survive unescaped;
  - the disclaimer and AI label (`Trust.*`) are present in the issue state **and** in the "no issue" state (FR-003);
  - with 7 items and `items=3`, exactly 3 `<li>` items render plus a `moreItems` link with count 4. With `items=5` and 2 items, 2 render and there is no "more" link;
  - `isFallback` renders the `role="note"` translation note and `lang="en"` on the text;
  - `issueTextStatus` failed / `summary: null` renders titles and links without summary or sentences, and still renders the disclaimer and label;
  - every outbound link is absolute on the site URL, has `target="_blank" rel="noopener"`, and carries `?src=site:<key>`, except privacy;
  - `periodReview: null` renders no review link and no placeholder (FR-007);
  - `<html lang>` equals the locale.
- [ ] T019 [P] [US1] Write failing tests in `apps/web/src/lib/embed/embedHeaders.test.ts`:
  - `buildEmbedHeaders({ origins })` returns `Content-Security-Policy: frame-ancestors <origins space-separated>`;
  - empty or missing origins give `frame-ancestors 'none'`;
  - it always sets `X-Robots-Tag: noindex, nofollow`, `Referrer-Policy: strict-origin-when-cross-origin` and `Content-Type: text/html; charset=utf-8`;
  - it never sets `X-Frame-Options` or `Set-Cookie`.
- [ ] T020 [P] [US1] Write failing Playwright tests in `apps/web/tests/e2e/embed-content.spec.ts`, using `embed-helpers.ts` and `partner-host-iframe.html` content:
  - **US1 #1, #5**: via `http://partner.test`, the frame shows the issue date heading, every summary point, the first 3 items in issue-page order (compare with `GET /api/public/projects/hht-research/issues/{id}?locale=ru`), the "more items" link, "All issues", the disclaimer and the AI label.
  - **US1 #2**: options `auto-5-form` shows 5 items, or all of them if there are fewer.
  - **US1 #3, #4**: `ru` text when the translation is ready; the English text plus the note when it isn't (use `/api/test/issue-translations` as `issue-translation.spec.ts` does).
  - **FR-009**: via `http://blocked.test`, the frame has no widget content.
  - **Routing**: unknown partner and unknown project give 404 with `frame-ancestors 'none'`; `de-99-x` gives a 308 to `auto-3-form`; `/embed/xx/...` gives a 308 to `en`.
  - **FR-016**: no `Set-Cookie` header on any `/embed/*` response.
  - **US1 #6**: hide the latest issue via the T026 test endpoint, reload, and the previous visible issue is shown. Unhide in teardown.
  - **US1 #7**: a project with no visible issue shows `Widget.firstIssueComing` plus the disclaimer.

### Implementation for User Story 1

- [ ] T021 [US1] Extract `translateIssueText(loaded, locale, deadline)` from `apps/web/src/app/api/public/projects/[slug]/issues/[id]/route.ts` into the new `apps/web/src/lib/issueTextTranslation.ts`, and use it from both the issue API route and the embed loader. Behavior must be identical: the ≈8 s wait, then fallback, with background completion via `after()` (spec 005 FR-012/013). The existing tests and `issue-translation.spec.ts` must still pass.
- [ ] T022 [US1] Implement `loadEmbedModel({ slug, partnerKey, locale, options })` in `apps/web/src/lib/embed/loadEmbedModel.ts`. Use `unstable_cache`, tagged `embed:project:<projectId>`, with `revalidate: 3600`.
  - Project and partner come from `findProjectBySlug` and `findEmbedPartner`; return `null` if either is missing.
  - The issue is `listVisibleIssues(projectId, 1)[0]`, then `loadIssueSummary`, `translateIssueText` and `toIssueDetail`.
  - `items = issue.items.slice(0, options.items)` and `moreCount = issue.items.length - items.length`.
  - `periodReview: null` (research R13). `source = partnerSource(key)`.
  - Build links with `embedLinks()` on `getPublicSiteUrl()`, per data-model.md "Widget View model".
- [ ] T023 [P] [US1] Implement `buildEmbedHeaders` in `apps/web/src/lib/embed/embedHeaders.ts` until T019 passes.
- [ ] T024 [US1] Implement `renderEmbed(model, t)` in `apps/web/src/lib/embed/renderEmbed.ts` until T018 passes:
  - an `html` tagged template that escapes every interpolation through `escapeHtml`, and `safeUrl` (an `https?:` allow-list, then `escapeAttr`) for `href`;
  - the document structure from contract `embed-page.md` (head, `<main>`, `<article>`, the summary `<ol>`, the items `<ul>`, the "more" link, "All issues", footer with the `Trust` disclaimer and AI label);
  - the "first issue is coming" state;
  - inline CSS of 4 KB or less, light palette only for now, system font stack, no horizontal scrolling at 320 px (`overflow-wrap: anywhere`);
  - `renderEmbedNotFound()`: a minimal 404 document with no project content and no script.
- [ ] T025 [US1] Implement the ISR route handler `apps/web/src/app/embed/[locale]/[slug]/[partner]/[options]/route.ts` (contract `embed-page.md`):
  - `dynamic = 'force-static'`, `revalidate = 3600`, `dynamicParams = true`, `generateStaticParams = () => []` (or R3's fallback per T001);
  - a 308 to `en` for an unsupported locale;
  - a 308 to the canonical options when `parseEmbedOptions(...).changed`;
  - `loadEmbedModel` returning `null` → `renderEmbedNotFound()` with status 404 and `frame-ancestors 'none'`;
  - otherwise 200 with `renderEmbed` and `buildEmbedHeaders({ origins: partner.origins })`;
  - translations via `getTranslations({ locale, namespace })`.

  Never read cookies or the query string.

- [ ] T026 [P] [US1] Add a test-only endpoint `apps/web/src/app/api/test/issues/[id]/visibility/route.ts` (`POST {"hidden":true|false}`). It uses the same guard as `apps/web/src/app/api/test/subscribers/route.ts` (`isEmailStubEnabled()`, so it's 404 in production), and calls `payload.update({ collection: 'digests', … hiddenFromPublic })`, so the real hooks run.
- [ ] T027 [US1] Implement `revalidateEmbed(projectId)` in `apps/web/src/lib/embed/revalidateEmbed.ts`. It calls `revalidateTag('embed:project:' + projectId, { expire: 0 })` (or the T001 outcome), wrapped in `try/catch` that logs with `console.error('[embed] revalidate failed', …)` and never throws (contract `embed-endpoints.md` "Revalidation hooks").
- [ ] T028 [US1] Call `revalidateEmbed` in `apps/web/src/collections/Digests.ts` `afterChange`:
  - on `create`;
  - on `update` when any of `hiddenFromPublic`, `issueTextStatus`, `issueTextRevision`, `issueSummaryPoints`, `issueItemSentences` or `publications` changed compared with `previousDoc`.

  Keep the existing `invalidateIssueTranslations` and `stampFeedPublishedAt` behavior and their shared-`req` rule. Add cases to `apps/web/src/collections/digestHooks.test.ts`.

- [ ] T029 [P] [US1] In `apps/web/src/lib/issueTranslationStore.ts`, after `finish(id, { status: 'ready' })` updates the row, resolve the digest's project id and call `revalidateEmbed(projectId)` (FR-004, research R3).
- [ ] T030 [P] [US1] In `apps/web/src/collections/ResearchProjects.ts`, add an `afterChange` that calls `revalidateEmbed(doc.id)` when `embedPartners`, `name` or `slug` changed. Removing an origin must take effect on the next request (research R2).
- [ ] T031 [US1] Make T018–T020 pass. Then verify with Playwright MCP against `pnpm --filter @hht/web build && pnpm --filter @hht/web start`:
  - on an allowed origin, the widget renders at 320 px with no horizontal scroll;
  - a blocked origin renders nothing;
  - hide → refresh works with ISR active.

**Checkpoint**: US1 works with a plain frame. It is the MVP content path.

---

## Phase 4: User Story 2 - One-snippet embed that never breaks the partner page (Priority: P1)

**Goal**: A partner pastes the container plus the `/embed/v1.js` script. The frame is inserted, auto-sized and themed. If anything fails, the partner's fallback stays. The partner has instructions, and the first partner's page gets the snippet.

**Independent Test**: Paste the script snippet into the `http://partner.test` host and check:

- 320 and 1280 px in light and dark: no inner scrollbar, and the color scheme is followed;
- plain frame at fixed height;
- `/embed/*` aborted: the fallback is visible within 10 s and no empty frame remains.

(Spec US2 Independent Test.)

### Tests for User Story 2 ⚠️

- [ ] T032 [P] [US2] Write a failing Jest test, `apps/web/src/lib/embed/loaderSize.test.ts`: `zlib.gzipSync(fs.readFileSync('public/embed/v1.js'), { level: 9 }).length <= 3072` (FR-025). The file must also contain no `import`, `require`, `eval`, `document.cookie`, `localStorage` or `sessionStorage`.
- [ ] T033 [P] [US2] Write failing Playwright tests in `apps/web/tests/e2e/embed-snippet.spec.ts`:
  - **US2 #1, #3**: at 320 and 1280 px viewports, frame height equals the inner `documentElement` height within ±2 px, the inner `scrollHeight <= clientHeight`, and there's no horizontal scroll.
  - **US2 #2**: change the inner content height via `frame.evaluate` and the outer height follows.
  - **US2 #4**: `page.emulateMedia({ colorScheme: 'dark' })` with `auto` gives a dark computed background in the frame; `data-theme="light"` forces light.
  - **US2 #6**: abort `**/embed/ru/**` with `page.route` and the fallback stays visible, with no visible frame, at 10.5 s. Abort `**/embed/v1.js` and the fallback is visible and no frame exists.
  - **US2 #7**: an unknown `data-partner` or `data-project` gives the fallback after the timeout.
  - **FR-009 with loader**: on `http://blocked.test`, the fallback is visible after the timeout and no frame remains.
  - **US2 #5**: with `partner-host-iframe.html`, the frame is 900 px high and the last element is reachable by scrolling inside it.
  - **Edge**: two containers on one page each size independently, and a `ready` delayed past 10 s (`page.route` with a 11 s delay) is ignored, so the fallback stays.
  - **FR-013**: a `postMessage` from the host page itself with `digest-widget:size` doesn't change the frame height.

### Implementation for User Story 2

- [ ] T034 [US2] Add the inline ready/size script to `apps/web/src/lib/embed/renderEmbed.ts` (research R6, contract `embed-page.md` "Inline script" step 1). It runs only when `window.parent !== window`, posts `{ type: 'digest-widget:ready', v: 1, height, title: document.title }` on `DOMContentLoaded`, then `digest-widget:size` from a `ResizeObserver` on `document.documentElement` when the rounded height changes, at most once per animation frame, with target origin `'*'`. Keep the inline script at about 1 KB or less. Extend `renderEmbed.test.ts` to assert the script is present and contains no cookie or storage access.
- [ ] T035 [US2] Add theming to `apps/web/src/lib/embed/renderEmbed.ts` (research R9): `<html data-theme="auto|light|dark">` and CSS custom properties for light. Override them under `@media (prefers-color-scheme: dark)` for `auto`, and under `[data-theme=dark]`. Set a matching `color-scheme` and always paint an explicit `background`. Keep the total inline CSS at 4 KB or less and check text contrast against WCAG 2.1 AA for both palettes.
- [ ] T036 [US2] Write the loader `apps/web/public/embed/v1.js`, following contract `embed-snippet.md` "Loader behavior (normative)" steps 1–6 exactly:
  - plain ES2017 in an IIFE;
  - the widget origin comes from `document.currentScript.src`;
  - processed-container marking;
  - normalization of `data-locale`/`data-items`/`data-theme`/`data-subscribe`, with defaults `en`/`3`/`auto`/`form`;
  - the frame is created invisible but laid out, with the exact `sandbox`, `referrerpolicy` and `style` values;
  - a **10 000 ms** timeout that removes the frame and keeps the fallback;
  - one `message` listener that checks `event.origin`, `event.source` and `v === 1`;
  - `ready` swaps the fallback (`hidden`) for the frame and sets `title` and height, and is ignored after a timeout;
  - `size` updates the height;
  - the secondary `data-fallback-text`/`data-fallback-href` path when the container is empty.

  No cookies, storage or `eval`. Make T032 and T033 pass.

- [ ] T037 [P] [US2] Add a `headers()` entry in `apps/web/next.config.ts` for `source: '/embed/v1.js'` with `Cache-Control: public, max-age=3600`. Make no other header changes (contract `embed-endpoints.md`).
- [ ] T038 [P] [US2] Write failing tests, then implement, `packages/shared/src/embedSnippet.ts` and `embedSnippet.test.ts`:
  - `buildScriptSnippet({ siteUrl, project, partner, locale, items, theme, subscribe, fallback: { sentence, communityLabel, communityUrl?, subscribeLabel, subscribeUrl } })`;
  - `buildIframeSnippet({ siteUrl, project, partner, locale, options, title, height })`.

  Output matches contract `embed-snippet.md` byte for byte for a fixture. All text is HTML-escaped, and the subscribe URL carries `?src=site:<key>#subscribe`.

- [ ] T039 [US2] Add the admin UI field `embedSnippets` (`type: 'ui'`) to `apps/web/src/collections/ResearchProjects.ts`, rendered by the new `apps/web/src/components/admin/EmbedSnippets.tsx` in the style of `IssuePostKit`. For each saved partner, it shows the script snippet and the plain-frame snippet in `ru` and `en`, built with `buildScriptSnippet`/`buildIframeSnippet` and the `Widget.fallback*` messages plus `fallbackCommunityUrl`, each with a copy button. Run `pnpm --filter @hht/web generate:importmap`.
- [ ] T040 [P] [US2] Write the partner instructions `docs/embed-widget.md` (FR-031). Cover:
  - what the widget shows;
  - the script snippet, with every attribute and its default and invalid-value behavior, copied from contract `embed-snippet.md`;
  - the plain frame snippet and when to use it;
  - fallback markup examples in Russian and English;
  - "the owner must add your site's origin before the widget renders";
  - behavior when our site is unreachable;
  - privacy: no cookies and no trackers.

  Link it from `README.md`.

- [ ] T041 [US2] Make T032–T033 pass. Then verify with Playwright MCP on the production build using `apps/web/tests/fixtures/partner-host.html`, served by `python3 -m http.server 4310 --bind 127.0.0.1` (quickstart §2):
  - `http://127.0.0.1:4310` renders and resizes;
  - `http://localhost:4310` keeps the fallback;
  - stopping the server leaves the fallback.

**Checkpoint**: US1 + US2 together are a pasteable widget that never breaks the partner page.

---

## Phase 5: User Story 3 - Subscribe from the widget, attributed to the partner (Priority: P1)

**Goal**: The in-frame form, or link-out, subscribes through the existing endpoint with source `site:<key>`. The source is validated per project, the post-submit notice shows inside the frame, and attribution carries over to site visits that start from a widget link.

**Independent Test**: On `http://partner.test`, submit the widget form, confirm via the email stub, and the admin and test API show one confirmed subscriber with source `site:e2e-partner`. Repeat with `data-subscribe="link"` (spec US3 Independent Test).

### Tests for User Story 3 ⚠️

- [ ] T042 [P] [US3] Write failing Jest tests in `apps/web/src/lib/embed/noticeRedirect.test.ts` for `embedNoticeTarget(referer, siteOrigin, notice)`:
  - a same-origin referer whose path matches `^/embed/{locale}/{slug}/{partner}/{options}(/{notice})?$` gives that path with the notice segment set or replaced (`check_inbox` → `check-inbox`, and likewise for the others);
  - a cross-origin referer, or any other path, gives `null`, so the caller keeps today's `?notice=` behavior.
- [ ] T043 [P] [US3] Write a failing Jest test, `apps/web/src/lib/embed/formParity.test.ts`. It renders the embed form with `renderEmbed` (mode `form`) and asserts these field names and types: `email` (email, required), `language` radios `ru|en` with `ru` preset only for locale `ru`, `consent` checkbox (unchecked, `value="yes"`), hidden `src` = `site:<key>`, hidden `issue`, and honeypot `company` (`tabindex=-1`, inside an `aria-hidden` wrapper). The action must be `/api/public/projects/{slug}/subscribe` and the privacy link must open in a new tab with `rel="noopener"`. These must match `apps/web/src/components/SubscribeForm.tsx` (spec 006 FR-001, contract `embed-page.md` "Form").
- [ ] T044 [P] [US3] Write failing Playwright tests in `apps/web/tests/e2e/embed-subscribe.spec.ts`. Use a per-test `x-forwarded-for` from `rateLimitTestIp`, as `subscriptions.spec.ts` does.
  - **US3 #1**: the `ru` widget form shows email, language preset `ru` and an unticked consent; the privacy link has `target=_blank`.
  - **US3 #2**: submit without consent, and the frame shows `Subscribe.need_consent` in `ru` at `…/auto-3-form/need-consent`. Nothing is stored (`/api/test/subscribers`).
  - **US3 #3**: a valid submission shows `check-inbox` and the outer frame height follows. Confirm through `/api/test/emails`, then the subscriber is `confirmed` with source `site:e2e-partner`.
  - **US3 #4**: a context with `javaScriptEnabled: false` loading the embed URL directly can still submit and gets the notice page (FR-018).
  - **US3 #5**: `data-subscribe="link"` opens a new page at `/{locale}/projects/hht-research?src=site:e2e-partner#subscribe`; subscribe there and the source is `site:e2e-partner`.
  - **US3 #6**: from the widget, open an item link (new tab), navigate to the project page, subscribe, and the source is `site:e2e-partner`.
  - **US3 #8**: POST with `src=site:not-configured` and the stored source is `other`.
  - **US3 #7**: the honeypot filled gives `check-inbox` and nothing stored; repeated submissions from one IP hit the same limiter as the site form (`try-later`).

### Implementation for User Story 3

- [ ] T045 [US3] Implement `embedNoticeTarget` in `apps/web/src/lib/embed/noticeRedirect.ts` until T042 passes.
- [ ] T046 [US3] Change `apps/web/src/app/api/public/projects/[slug]/subscribe/route.ts`:
  - compute `src = resolveSubscriptionSource(form.src, partnerKeysOf(project))`, after loading the project and before any write;
  - in `redirectNotice`, use `embedNoticeTarget(referer, site, notice)` when it returns a path, and keep today's behavior otherwise.

  Change nothing else: consent, email syntax, honeypot, the per-IP limiter, the one-confirmation-per-hour rule, identical responses and confirmation email sending stay as they are (FR-022, FR-023).

- [ ] T047 [US3] Add the subscribe section to `apps/web/src/lib/embed/renderEmbed.ts`. Make T043 pass.
  - `<section aria-labelledby="w-subscribe">` with the `Widget.subscribeHeading`.
  - Form mode: the fields from contract `embed-page.md` "Form", with labels from `Subscribe.*` and the consent text naming the project.
  - Link mode: one button-styled link, `Widget.subscribeButton`, to `/{locale}/projects/{slug}?src=site:<key>#subscribe` with `target="_blank" rel="noopener"`.
  - With a notice: `<p role="status" tabindex="-1">` with `Subscribe.<notice>`, plus inline script step 4 (focus the notice).
- [ ] T048 [US3] Add the notice route `apps/web/src/app/embed/[locale]/[slug]/[partner]/[options]/[notice]/route.ts`. It shares the handler logic with T025 through a helper in `apps/web/src/lib/embed/handleEmbedRequest.ts` (refactor T025 to use it). An unknown notice gives a 308 to the path without the notice. The same ISR settings and headers apply.
- [ ] T049 [P] [US3] In `apps/web/src/proxy.ts`, store the `src` visit cookie when `parseSourceToken(incoming)` is not `other`, instead of `parseChatSource`. This accepts any syntactically valid `site:<key>`, and membership is checked at subscribe time (contract `embed-endpoints.md` "proxy.ts"). Cookie attributes are unchanged.
- [ ] T050 [US3] Change `apps/web/src/components/SubscribeForm.tsx` to take a `src: string` prop and stop calling `cookies()`. In `apps/web/src/app/[locale]/projects/[slug]/page.tsx` and `apps/web/src/app/[locale]/projects/[slug]/issues/[issueId]/page.tsx`, read the cookie with `parseSourceToken(cookies().get('src')?.value)` and pass it in. The existing `subscriptions.spec.ts` must still pass.
- [ ] T051 [P] [US3] In `apps/web/src/components/admin/SubscriberCounts.tsx` (and `apps/web/src/app/api/admin/projects/[id]/subscriber-counts/route.ts` if it needs the names), show the partner `name` next to each `site:<key>` bucket, so the owner can read the partner's confirmed subscribers directly (SC-008).
- [ ] T052 [US3] Make T042–T044 pass, then verify with Playwright MCP: an in-frame subscribe on the two-origin fixture, a confirmation in the email stub, and the admin showing `site:e2e-partner (E2E partner)`.

**Checkpoint**: All P1 stories are done, and the widget is launchable.

---

## Phase 6: User Story 4 - Link to the latest period review (Priority: P2)

**Goal**: The widget doesn't block on spec 013. When 013 provides data, one link appears.

**Independent Test**: With no period review (always the case now), no review link and no placeholder render (spec US4 #1). This is covered by the T018 assertion.

- [ ] T053 [US4] Confirm `EmbedModel.periodReview` is typed `{ title: string; url: string } | null` in `apps/web/src/lib/embed/loadEmbedModel.ts`, and that `renderEmbed` outputs one localized link only when it is non-null (add a non-null fixture case to `renderEmbed.test.ts`, using a `Widget.periodReview` message added to all five `messages/*.json`). Add a "For spec 013" note in `docs/embed-widget.md` (maintainer section): 013's tasks set `periodReview` in `loadEmbedModel` and call `revalidateEmbed` when a review is published or hidden. Build no 013 query now (research R13, Constitution II).

**Checkpoint**: The 013 integration point is explicit and tested.

---

## Phase 7: User Story 5 - Embed analytics per partner (Priority: P3)

**Goal**: Cookie-less counts of widget views and outbound clicks per partner, shown in the admin next to the existing counts. Form submissions and confirmations per partner already work through `site:<key>` (T014).

**Independent Test**: Load the widget twice on `http://partner.test`, click one item link and "All issues", and submit once. The admin shows 2 views, 2 clicks and 1 form submission for `site:e2e-partner`, and there are no cookies or storage in the frame (spec US5 Independent Test).

### Tests for User Story 5 ⚠️

- [ ] T054 [P] [US5] Write failing Jest tests in `apps/web/src/lib/embed/embedEvents.test.ts` for `parseEmbedEvent(bodyText, project)`:
  - it accepts `{"partner","issue","metric"}` with a `metric` of `widget_view` or `outbound_click`, and a partner in `partnerKeysOf(project)`;
  - it rejects a body over 1024 bytes, invalid JSON, an unknown metric or an unknown partner (returns `null`);
  - an issue id that isn't a visible issue of the project becomes `'none'`.
- [ ] T055 [P] [US5] Write failing Playwright tests in `apps/web/tests/e2e/embed-analytics.spec.ts`:
  - **US5 #1**: two loads plus two clicks increment `widget_view` by 2 and `outbound_click` by 2 for `site:e2e-partner`. Read through the admin metrics API, or a test-only read guarded like `/api/test/subscribers`. A notice view (after submit) doesn't add a `widget_view`.
  - **US5 #2**: `context.cookies()` is empty for the site origin after using the widget; the frame's `localStorage.length === 0` and `sessionStorage.length === 0`; and no request leaves the site origin, the test host or fixture origins (`page.on('request')`).
  - **US5 #3**: with `**/embed-events` aborted, clicking an item link still opens the item page.

### Implementation for User Story 5

- [ ] T056 [US5] Implement `parseEmbedEvent` in `apps/web/src/lib/embed/embedEvents.ts` until T054 passes. Then implement `apps/web/src/app/api/public/projects/[slug]/embed-events/route.ts` per contract `embed-endpoints.md`:
  - `POST`, reading `req.text()` as `text/plain` JSON with a 1 KB cap;
  - `incrementAnalyticsCount({ projectId, issueKey, source: partnerSource(key), metric })` when valid;
  - **always** `204` with `Cache-Control: no-store`;
  - never sets a cookie and never echoes input.
- [ ] T057 [US5] Add beacons to the inline script in `apps/web/src/lib/embed/renderEmbed.ts` (research R10):
  - when there is no notice segment, call `navigator.sendBeacon('/api/public/projects/{slug}/embed-events', new Blob([json], { type: 'text/plain' }))` once with `widget_view`;
  - add a delegated `click` listener on `a[data-track]` that sends `outbound_click` and never calls `preventDefault`;
  - put `data-track` on every outbound link.

  Keep the inline script at about 1 KB or less and extend `renderEmbed.test.ts`.

- [ ] T058 [US5] Extend `apps/web/src/app/api/admin/projects/[id]/subscriber-metrics/route.ts` and `apps/web/src/components/admin/SubscriberMetrics.tsx` with a "Widget" block. It shows `widget_view`, `outbound_click`, `form_submit` and `confirmation` per `site:<key>`, labelled with the partner `name`, next to the existing issue-page counts (FR-030, SC-009). Show aggregates only.
- [ ] T059 [US5] Make T054–T055 pass, then verify the admin "Widget" block with Playwright MCP.

**Checkpoint**: All user stories are complete.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [ ] T060 [P] Write the accessibility gate `apps/web/tests/e2e/embed-a11y.spec.ts` with `@axe-core/playwright` (research R14). It runs on the issue page and on the embed page, both directly (`/embed/ru/hht-research/e2e-partner/auto-3-form`) and inside the `http://partner.test` host, in light and dark and in form and notice states. Fail on any `serious` or `critical` violation (FR-028, SC-007). Also assert that the frame has a non-empty localized `title` after `ready`. Fix any findings in `renderEmbed.ts`.
- [ ] T061 [P] Performance check per quickstart §4. Record the numbers in `specs/014-embeddable-widget/quickstart.md` under a dated "Results" note:
  - `gzip -9c apps/web/public/embed/v1.js | wc -c` ≤ 3072;
  - `curl -s http://localhost:3000/embed/ru/hht-research/e2e-partner/auto-3-form | grep -c "_next/static"` = 0 (FR-026);
  - 5 Lighthouse mobile runs on the fixture host with frame LCP < 2.5 s (FR-027, SC-006).
- [ ] T062 [P] Security review of the embed surface:
  - the escaping helpers in `renderEmbed.ts`, with every interpolation going through them;
  - the `sandbox` flags in `public/embed/v1.js`;
  - the CSP builder;
  - the `embed-events` input caps;
  - that `embedPartners` isn't exposed by any public API.

  Run the `security-review` skill on the branch and fix confirmed findings.

- [ ] T063 [P] Add an assertion to `apps/web/tests/e2e/embed-content.spec.ts`: `/embed/*` responses never contain `X-Frame-Options`, and their `Content-Security-Policy` never contains `frame-ancestors 'none'` for a valid partner. This guards against the separate "Harden framing on non-widget routes" task breaking the widget (research R2).
- [ ] T064 Run the full gates: `pnpm check 2>&1 | tail -50`, `pnpm format:check 2>&1 | tail -20`, `pnpm --filter @hht/web test:e2e 2>&1 | tail -50`, and `pnpm --filter @hht/web build 2>&1 | tail -30`. Fix any failures. Then do the quickstart §1–§3 walkthrough.

---

## Phase 9: Launch (owner actions; production)

**Purpose**: The spec's production acceptance items. Each step touches production or a third party, so **ask the owner before each one** (`CLAUDE.md`: "`pnpm db:migrate` … ask first"; outward-facing actions need confirmation).

- [ ] T065 With the owner's go-ahead, rehearse the schema change on a **Neon branch** of production, not production itself (research R8):
  1. Run `ensure-schema` with the branch URL and confirm `subscribers.source` and `analytics_counts.source` become `varchar` with every row kept.
  2. If push prompts or skips, apply the SQL from research R8 to the branch, re-run, and confirm there is no diff.
  3. Write the result into `specs/014-embeddable-widget/research.md` R8.
  4. Before deploying, the owner applies the same SQL to production (if it was needed).
  5. After deploying, check the Vercel build log for "ensure-schema: Payload schema push complete".
- [ ] T066 [P] The owner runs the Russian reachability check (FR-034, research R12) for `https://hht.rarediseasedigest.org/embed/v1.js` and one embed URL, from Russian residential and mobile networks without a VPN. Record the date, networks, method and result in `docs/launch/2026-11-embed-reachability.md`. If the domain is blocked, the follow-up is a separate snapshot spec, not a change to this one.
- [ ] T067 After deploy, the owner adds partner `curehht-ru` to the production project in the admin with origin `https://curehht-ru.org` (plus the GitHub Pages preview origin for testing). Verify with `curl -sI https://hht.rarediseasedigest.org/embed/ru/<slug>/curehht-ru/auto-3-form`: the CSP lists the origins, `X-Robots-Tag: noindex, nofollow` is present and there's no `Set-Cookie` (quickstart §5.4).
- [ ] T068 **Confirm with the owner before opening it.** Open a pull request in `curehht/curehht.github.io` that adds the script snippet, copied from the admin `embedSnippets` field (locale `ru`, Russian fallback), to the Russian news page. Confirm on its GitHub Pages preview that the widget renders the latest Russian issue (FR-032, acceptance criterion 4).
- [ ] T069 After the partner PR merges, remove the preview origin from the partner. Check the live partner page at 320 px in light and dark mode, and confirm the fallback shows when `/embed/` is blocked in DevTools.
- [ ] T070 One week after launch, confirm the admin "Widget" block shows views, clicks, form submissions and confirmations under `site:curehht-ru` (SC-009). Note the numbers in `docs/launch/2026-11-embed-reachability.md`.

---

## Dependencies & Execution Order

### Phase dependencies

- **Setup (Phase 1)**: none. **T001 gates T025, T027 and T048**: its outcome picks ISR or the fallback.
- **Foundational (Phase 2)**: needs Phase 1 (T003 for messages). **Blocks every story.** Order inside: T006/T007 → T008/T009 → T010–T013 → T014 → T015 → T016 → T017.
- **US1 (Phase 3)**: needs Phase 2.
- **US2 (Phase 4)**: needs US1's route and renderer (T024, T025), because the loader frames them.
- **US3 (Phase 5)**: needs US1's route and renderer (T024, T025). It is independent of US2: it can be tested with the plain frame or directly, although the T044 height check uses the loader.
- **US4 (Phase 6)**: needs T022 and T024.
- **US5 (Phase 7)**: needs T024, T025 and T014. It is independent of US2 and US3.
- **Polish (Phase 8)**: after the desired stories. **Launch (Phase 9)**: after Polish. T065 must finish before the production deploy.

### Same-file sequencing (not parallel)

- `apps/web/src/lib/embed/renderEmbed.ts`: T024 → T034 → T035 → T047 → T053 → T057.
- `apps/web/src/collections/ResearchProjects.ts`: T010 → T030 → T039.
- `apps/web/src/proxy.ts`: T015 → T049.
- `apps/web/src/app/api/public/projects/[slug]/subscribe/route.ts`: T014 → T046.
- `apps/web/src/app/[locale]/projects/[slug]/issues/[issueId]/page.tsx`: T014 → T050.

### Parallel opportunities

- Phase 1: T002, T003, T004 and T005 in parallel, after or alongside T001.
- Phase 2: T006 ∥ T007, then T011 ∥ T012 (T010 and T013 can follow in parallel with them).
- US1: tests T018 ∥ T019 ∥ T020. Then T023 ∥ T026 alongside T021 → T022 → T024 → T025, and T029 ∥ T030 after T027.
- US2: T032 ∥ T033, then T037 ∥ T038 ∥ T040 alongside T034 → T035 → T036.
- US3: T042 ∥ T043 ∥ T044, then T049 ∥ T051 alongside T045 → T046 → T047 → T048 → T050.
- US5: T054 ∥ T055.
- After US1, US3 and US5 can proceed in parallel with US2. Only `renderEmbed.ts` edits must be serialized, in the order above.
- Polish: T060 ∥ T061 ∥ T062 ∥ T063.

## Parallel Example: User Story 1

```text
Task: "T018 renderEmbed tests in apps/web/src/lib/embed/renderEmbed.test.ts"
Task: "T019 embedHeaders tests in apps/web/src/lib/embed/embedHeaders.test.ts"
Task: "T020 Playwright content tests in apps/web/tests/e2e/embed-content.spec.ts"

# then, while T021 → T022 → T024 → T025 run in sequence:
Task: "T023 buildEmbedHeaders in apps/web/src/lib/embed/embedHeaders.ts"
Task: "T026 test-only visibility endpoint in apps/web/src/app/api/test/issues/[id]/visibility/route.ts"
```

## Parallel Example: User Story 3

```text
Task: "T042 notice redirect tests in apps/web/src/lib/embed/noticeRedirect.test.ts"
Task: "T043 form parity test in apps/web/src/lib/embed/formParity.test.ts"
Task: "T044 Playwright subscribe tests in apps/web/tests/e2e/embed-subscribe.spec.ts"
Task: "T049 proxy cookie accepts site:<key> in apps/web/src/proxy.ts"
Task: "T051 partner names in apps/web/src/components/admin/SubscriberCounts.tsx"
```

---

## Implementation Strategy

### MVP first

1. Phase 1, then Phase 2.
2. **US1 (Phase 3)**: the content is visible to allowed partners through a plain frame, hidden issues disappear, and other origins are refused. **STOP and validate** with T031.
3. **US2 + US3 (Phases 4–5)**: these complete the P1 set. The spec's first partner launch needs all three P1 stories, because the plain frame alone has no fallback and no attributed subscriptions, which quarter criterion 2 needs.
4. **Launch** (Phase 9) after Polish. US4 is a small, tested slot, and US5 can ship in the same release or right after.

### Incremental delivery

- Each phase ends with a checkpoint that a Playwright run can verify on its own.
- Commit after each task or tight group: small, focused commits in English (Constitution).

## Notes

- Total: **70 tasks**. Setup 5 · Foundational 12 · US1 14 · US2 10 · US3 11 · US4 1 · US5 6 · Polish 5 · Launch 6.
- The e2e suite is split per story (`embed-content`, `embed-snippet`, `embed-subscribe`, `embed-analytics`, `embed-a11y`) instead of the single `embed.spec.ts` named in plan.md and quickstart. This lets stories be verified independently. The quickstart's `test:e2e -- embed` filter still matches all of them.
- Data-model constraints are quoted in T010–T012, so implementation-time discretion is limited to wording and layout.
