# Implementation Plan: Embeddable Widget

**Branch**: `014-embeddable-widget` | **Date**: 2026-10-27 | **Spec**: [`spec.md`](./spec.md)

**Input**: Feature specification from `/specs/014-embeddable-widget/spec.md`

## Summary

A partner page pastes one snippet: a container with its own fallback markup, plus
`<script async src=".../embed/v1.js">`. The loader inserts an invisible frame pointing at
`/embed/{locale}/{slug}/{partner}/{theme}-{items}-{mode}`. It shows the frame only when the frame
reports `ready`, and keeps it at content height. If `ready` never comes, the fallback stays.

The frame is a cached HTML document produced by a route handler, with no client framework. It
shows the latest visible issue, a subscribe form that posts to the existing endpoint with source
`site:<partner>`, the disclaimer and the AI label. Its response tells browsers to allow framing
only by that partner's origins.

Everything stays in `apps/web` and `packages/shared`. The worker is unchanged.

- **Web (`apps/web`)**:
  - the `/embed/…` ISR route handlers and their renderer;
  - `public/embed/v1.js`;
  - `embedPartners` on projects, with a snippet generator in the admin;
  - a beacon endpoint for widget views and clicks;
  - small changes to the subscribe endpoint (source validation, notice redirect), `proxy.ts`
    (exclude `/embed`, accept `site:<key>` in the visit cookie) and `SubscribeForm` (source as a
    prop);
  - tag revalidation from the digest, translation and project hooks.
- **Shared (`packages/shared`)**: source parsing (`parseSourceToken`, `resolveSubscriptionSource`),
  partner key and origin validation, the embed options codec, and snippet text, so that the
  endpoint, proxy, admin and docs agree.
- **Docs**: `docs/embed-widget.md` (partner instructions, both snippets, fallback examples in Russian
  and English) and the launch record of the Russian reachability check.

## Domain events and policies

| Event                    | When                                                            | Policy                                                                                                                                          |
| ------------------------ | --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `EmbedPartnersChanged`   | The owner saves a project's partners                            | Expire `embed:project:<id>`. Framing follows the new origin list on the next request. Removing a partner never rewrites stored sources.         |
| `WidgetRendered`         | Cache miss for an embed path                                    | Render the latest **visible** issue only. Frame only for the partner's origins. Unknown project or partner → 404 with `frame-ancestors 'none'`. |
| `IssueVisibilityChanged` | Digest created, hidden, unhidden, text edited or regenerated    | Expire the project's embed tag immediately (`expire: 0`), so a hidden issue is never served again from a fresh render.                          |
| `IssueTranslationStored` | A background translation is written                             | Expire the project's embed tag, so the English fallback is replaced on the next request.                                                        |
| `WidgetViewed`           | Frame loaded without a notice                                   | Anonymous +1 `widget_view` for (project, issue, `site:<key>`). No cookie, no identifier.                                                        |
| `WidgetLinkClicked`      | Reader clicks any widget link                                   | Anonymous +1 `outbound_click`. Navigation never waits for counting.                                                                             |
| `SubscriptionRequested`  | Form POST from the widget, or from the site after a widget link | As in spec 006. The source is `site:<key>` only if `<key>` is a partner of that project, otherwise `other`.                                     |

There is no new deployable and no Technical Baseline change, so no ADR is needed. The snippet and
URL format are a public contract. They are versioned (`/embed/v1.js`, message `v: 1`) instead of
being frozen by an ADR (research R5).

## Technical Context

**Language/Version**: TypeScript 5.8 on Node.js ≥ 24; Next.js 16.3.3 (App Router); Payload CMS 3
with `@payloadcms/db-postgres`; next-intl 4. Loader: plain ES2017 JavaScript.

**Primary Dependencies**: Existing only at runtime. One new **dev** dependency,
`@axe-core/playwright` (research R14, Complexity Tracking).

**Storage**: Postgres on Neon (Frankfurt).

- **Additive**: the `research_projects` `embedPartners` array, which adds two child tables, and the
  `analytics_counts.metric` values `widget_view` and `outbound_click`.
- **Non-additive**: `subscribers.source` and `analytics_counts.source` change from enum to
  `varchar` (research R8). This needs the owner's go-ahead, a Neon branch rehearsal and an SQL
  fallback.

**Testing**:

- **Jest**, in `packages/shared` and `apps/web`: source parsing, origin and key validation, options
  codec, renderer escaping and states, CSP builder, notice redirect mapping, and the loader gzip
  size.
- **Playwright**, `tests/e2e/embed.spec.ts`: a cross-origin host page via `page.route`
  (`http://partner.test` allowed, `http://blocked.test` not), plus resize, theme, fallback,
  subscribe and attribution, cookie absence, hide → refresh, beacons, axe, and the plain frame.
- During development, drive a running instance through Playwright MCP (Constitution IX).

The full matrix is in [`quickstart.md`](./quickstart.md).

**Target Platform**: Vercel Hobby `fra1`. ISR route handlers and `revalidateTag` are standard Next
features that also work self-hosted. The partner page runs in the reader's browser: the last two
versions of Chrome, Safari, Firefox and Samsung Internet, with the fallback for anything else.

**Project Type**: Existing pnpm monorepo web application (`apps/web`, `packages/shared`).

**Performance Goals**:

- Widget LCP under 2.5 s on a mid-range phone over 4G (SC-006). Planned: CDN-cached HTML, inline
  CSS of 4 KB or less, system fonts, no images, and about 1 KB of inline JavaScript.
- Loader at most 3 KB gzipped, enforced in CI.
- Fallback within 10 s whenever the widget can't render.

**Constraints**:

- No cookies or storage in the frame.
- No third-party resources in the frame.
- No admin code in the frame.
- Cache of 1 h at most, with event-driven expiry.
- Topic-agnostic code: partner data lives in project records, and the message types are named
  `digest-widget:*`.
- All widget strings in `messages/*.json` for the five locales.

**Scale/Scope**: One partner and one project at launch, with readers in the hundreds per week. The
cache key space per partner is bounded by canonicalization (research R4).

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design (below)._

| Principle                             | Status | Notes                                                                                                                                                                                    |
| ------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I. Spec-first, event-driven           | Pass   | Spec clarified 2026-10-27. Domain events above. No irreversible stack choice, so no ADR. The public snippet contract is versioned and documented in `contracts/`.                        |
| II. Ruthless scope                    | Pass   | One partner. Content already published. No snapshot or build-time path (owner's decision). Period review (US4) is only an optional `null` field until spec 013. No partner self-service. |
| III. Free-tier-first                  | Pass   | ISR reduces function and database work compared with today's no-store pages. No paid service. Beacons write to the existing counts table.                                                |
| IV. Public by default                 | Pass   | The widget is read-only public content. Subscribing keeps spec 006's data set: email, language, source and consent. No accounts.                                                         |
| V. Maintainability, topic-agnostic    | Pass   | Partner names, origins and keys are project data. Snippet text is generated from messages. The renderer is a small module with escaping tests (research R1).                             |
| VI. i18n first-class                  | Pass   | New `Widget` namespace in en, de, tr, ru and uk. Issue text follows spec 005 translation and fallback. The email language preset follows spec 006.                                       |
| VII. Service boundaries               | Pass   | Web only. The worker's REST writes trigger revalidation through existing Payload hooks.                                                                                                  |
| VIII. Portable                        | Pass   | No vendor cache APIs. ISR and `revalidateTag` work on `next start` in Docker.                                                                                                            |
| IX. Quality gates                     | Pass   | Jest and Playwright cover every acceptance scenario that can be automated (quickstart §1). axe added as the a11y gate. The loader size budget is a test.                                 |
| Technical Baseline (Mantine)          | Note   | The widget document doesn't use Mantine or React on the client (research R1). This is not a different UI library, just none for one 1-page embed. See Complexity Tracking.               |
| Delivery workflow (English artifacts) | Pass   | All artifacts are in English. The Russian strings exist only in `messages/ru.json` and the partner's fallback example.                                                                   |

**Post-design re-check (after Phase 1)**: still passes. The design added one dev dependency and one
non-additive column change, both recorded below with mitigations. No principle is violated.

## Project Structure

### Documentation (this feature)

```text
specs/014-embeddable-widget/
├── spec.md
├── plan.md              # this file
├── research.md          # Phase 0: R1–R14
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1: validation matrix and launch checklist
├── contracts/
│   ├── embed-snippet.md     # partner snippet + loader behavior (public, versioned)
│   ├── embed-page.md        # GET /embed/… headers, document, form, inline script, messages
│   └── embed-endpoints.md   # beacon endpoint, subscribe/proxy/form changes, revalidation hooks
├── checklists/requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks; not created here)
```

### Source Code (repository root)

```text
packages/shared/src/
├── chatSource.ts                # + parseSourceToken, resolveSubscriptionSource, partnerSource
├── chatSource.test.ts
├── embed.ts                     # new: PartnerKeySchema, normalizeEmbedOrigin, Embed options codec
├── embed.test.ts
├── embedSnippet.ts              # new: script/iframe snippet + fallback markup builders
├── embedSnippet.test.ts
└── index.ts                     # re-exports

apps/web/
├── public/embed/v1.js           # new: loader (≤ 3 KB gzip)
├── messages/{en,de,tr,ru,uk}.json   # + Widget namespace
├── next.config.ts               # + headers() for /embed/v1.js
├── src/proxy.ts                 # matcher excludes embed; cookie accepts site:<key>
├── src/app/embed/[locale]/[slug]/[partner]/[options]/route.ts            # new (ISR)
├── src/app/embed/[locale]/[slug]/[partner]/[options]/[notice]/route.ts   # new (ISR)
├── src/app/api/public/projects/[slug]/embed-events/route.ts              # new
├── src/app/api/public/projects/[slug]/subscribe/route.ts                 # source + notice redirect
├── src/app/[locale]/projects/[slug]/page.tsx                             # pass src to SubscribeForm
├── src/app/[locale]/projects/[slug]/issues/[issueId]/page.tsx            # pass src; resolve page_view source
├── src/collections/ResearchProjects.ts   # + embedPartners, embedSnippets UI, afterChange revalidate
├── src/collections/Subscribers.ts        # source → text + validate
├── src/collections/AnalyticsCounts.ts    # source → text; + metrics
├── src/collections/Digests.ts            # afterChange → revalidateEmbed
├── src/components/SubscribeForm.tsx      # src prop instead of cookies()
├── src/components/admin/EmbedSnippets.tsx       # new (admin UI field)
├── src/components/admin/SubscriberMetrics.tsx   # + widget metrics, partner names
├── src/lib/embed/loadEmbedModel.ts       # new: unstable_cache, tag embed:project:<id>
├── src/lib/embed/renderEmbed.ts          # new: html`` escaping templates, inline CSS + script
├── src/lib/embed/renderEmbed.test.ts
├── src/lib/embed/embedHeaders.ts         # new: CSP builder, X-Robots-Tag
├── src/lib/embed/embedHeaders.test.ts
├── src/lib/embed/revalidateEmbed.ts      # new
├── src/lib/embed/loaderSize.test.ts      # new: gzip budget
├── src/lib/analyticsCounts.ts            # resolved source in; + metrics
├── src/lib/issueTranslationStore.ts      # revalidateEmbed on ready
├── src/scripts/seed-public-feed.ts       # + e2e partner
├── tests/e2e/embed.spec.ts               # new
└── tests/fixtures/partner-host.html      # new: manual two-origin check

docs/
├── embed-widget.md                       # new: partner instructions (both snippets, options, fallback)
└── launch/2026-11-embed-reachability.md  # new at launch: FR-034 result
```

**Structure Decision**: The existing monorepo layout is kept.

- **Embed code** lives in `apps/web/src/lib/embed/`, with a top-level `src/app/embed/` route tree
  so it is outside the `[locale]` root layout and outside `proxy.ts`.
- **Shared helpers** are pure functions in `packages/shared`, because the subscribe endpoint, the
  proxy, the admin and the docs generator must agree on them.
- **The loader** is a static asset in `public/embed/`, so the CDN serves it without a function.

## Complexity Tracking

| Item                                                                        | Why needed                                                                                                                       | Simpler alternative rejected because                                                                                                                                                |
| --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Widget renders HTML strings in a route handler, without Mantine or React    | Per-response `frame-ancestors` from project data; LCP under 2.5 s with no client runtime; no admin code (FR-009, FR-026, FR-027) | A page can't set response headers. `proxy.ts` would need a database lookup on every view. A Mantine page ships its CSS and the React runtime into every partner page (research R1). |
| `subscribers.source` and `analytics_counts.source` change from enum to text | The owner chose "source names the partner" (spec clarification). Per-project values can't be an enum.                            | A generic `site` value or a separate partner field was rejected by the owner. Risk handled by a Neon branch rehearsal and the SQL fallback (research R8).                           |
| Dev dependency `@axe-core/playwright`                                       | FR-028 and SC-007 require an automated a11y check, and none exists yet                                                           | Manual-only checks aren't an enforced gate (Constitution IX). Writing custom a11y assertions duplicates a standard engine.                                                          |
| Path-segment options with 308 canonicalization                              | Static (ISR) route handlers can't read the query string, and the cache key space must stay bounded                               | Query parameters force a dynamic render per view (research R4).                                                                                                                     |
