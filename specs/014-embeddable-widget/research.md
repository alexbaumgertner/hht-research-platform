# Research: Embeddable Widget

**Feature**: [`spec.md`](./spec.md) | **Plan**: [`plan.md`](./plan.md) | **Date**: 2026-10-27

Each entry records a decision, why it was chosen, and what else was considered. Facts about the
current code were checked in this repository on 2026-10-27. Facts about the live site come from
`curl -I` on the same day.

## R1. How the widget page is rendered

**Decision**: Serve the widget from a **Next.js route handler** that returns a complete HTML document
built by small, pure render functions. These are tagged-template helpers that escape every
interpolated value. The handler lives under a new top-level `/embed/…` path with no layout. No
Mantine and no React on the client. The only client code is one inline script of about 1 KB (R6, R10).

**Rationale**:

- **Per-project response headers.** The framing policy (R2) depends on project data, so it has
  to be set per response. An App Router page can't set response headers. That leaves
  `next.config` `headers()`, which is fixed at build time, or `proxy.ts`. `proxy.ts` runs on
  every page request, so it would need a database or HTTP lookup on each widget view, and it
  would pull Payload into the proxy bundle. A route handler sets headers itself, and those
  headers are cached with the response (R3).
- **Performance.** A page under `[locale]` inherits the site layout: header, locale switcher, the
  Mantine provider and its CSS, and the IBM Plex font. A sibling root layout would still ship the
  React and Next client runtime to hydrate. FR-027 needs LCP under 2.5 s on a mid-range phone, and
  a server-rendered HTML document with inline CSS and no client framework is the most direct way
  to get there. This also meets FR-026, because the handler imports no admin code.
- **React SSR is not used.** React server rendering (`react-dom/server`) inside an App Router
  route handler runs in the `react-server` layer, where Next.js doesn't support it. The widget is
  one small document: a heading, a list, links and a form. String templates with one tested
  escaping helper are simpler to keep correct than working around the bundler.

**Alternatives considered**:

- _Page at `[locale]/projects/[slug]/embed` with the site layout_: brings the site chrome and
  Mantine into the frame, and can't set the framing header. Rejected.
- _Separate root layout `app/embed/[locale]/layout.tsx` plus `proxy.ts` for the header_: the proxy
  would look up allowed origins on every widget request, and the client runtime still hydrates.
  Rejected.
- _Static JSON API plus client-side rendering in the loader_: the loader would grow far past
  3 KB, the partner page would have to style it, and the subscribe form would run in the partner's
  origin and CSP. Rejected.

**Safety**: Issue titles come from PubMed, ClinicalTrials.gov and RSS. Every value is passed
through `escapeHtml` for text, or through `escapeAttr` plus an `https?:` allow-list for URLs.
Unit tests render a fixture whose titles contain `<script>`, quotes and `javascript:` URLs, and
assert that none of them survive (plan, Testing).

## R2. Framing policy and allowed origins

**Decision**: Every `/embed/…` response sends
`Content-Security-Policy: frame-ancestors <origins of the partner named in the URL>`. If the
project, the partner or its origins are missing, it sends `frame-ancestors 'none'`. It does **not**
send `X-Frame-Options`. Origins are stored exactly, as `scheme://host[:port]`, and are validated
on save. Wildcards and paths are rejected. `http:` is allowed only for `localhost`, `127.0.0.1`
and `*.test` hosts, which are used in development and E2E.

**Rationale**:

- `frame-ancestors` is the standard mechanism, and all current browsers support it.
  `X-Frame-Options: ALLOW-FROM` is obsolete and ignored by modern browsers. Browsers give
  `frame-ancestors` precedence when both are present, so adding XFO would only risk a conflict.
- **Partner-scoped, not project-scoped.** The partner key in the URL decides which origins may
  frame that URL. So a framed widget's attribution (`site:<key>`) is enforced by the browser:
  partner A's origin can't display a URL that says partner B. This costs nothing extra, because
  the handler already loads the partner to build the links.
- A blocked frame renders nothing from us. That satisfies FR-009 and acceptance criterion 2, and
  the loader shows the fallback content after its timeout (R5).
- `frame-ancestors` can't be set in a `<meta>` tag, so it has to be a response header (R1).

**Alternatives considered**: a project-wide origin list (the spec's `embedAllowedOrigins`). This
was replaced by a per-partner list inside the project, because the spec's Key Entities already
group origins under a partner. Also considered: checking `Referer` or `ancestorOrigins` in the
page. That isn't enforced by the browser, `ancestorOrigins` is missing in Firefox, and the page
would still render. Rejected.

**Out of scope**: framing headers on non-widget routes, including `/admin`. Tracked as the
separate hardening task "Harden framing on non-widget routes". That task's `frame-ancestors 'none'`
MUST exclude `/embed/`, and this feature's E2E test asserts the exclusion holds.

## R3. Caching and revalidation

**Decision**: The embed route handlers are **ISR route handlers**. They use
`dynamic = 'force-static'`, `revalidate = 3600`, `generateStaticParams` returning `[]`, and
`dynamicParams = true`. All data reads go through one `unstable_cache` loader tagged
`embed:project:<projectId>`. The tag is expired (`revalidateTag(tag, { expire: 0 })`) by:

| Trigger                                                                                     | Where                                                                                          |
| ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| A digest is created (published), or updated (hidden, edited, regenerated, issue text ready) | `Digests.afterChange` (the worker writes through the REST API, so the hook runs in `apps/web`) |
| An issue translation is stored                                                              | `issueTranslationStore` after a successful write                                               |
| The project's partners or name change                                                       | `ResearchProjects.afterChange`                                                                 |

**Rationale**:

- It meets FR-024 (at most 1 h, refreshed on change) and FR-005 (a hidden issue never appears in a
  fresh view) without any vendor API. ISR and `revalidateTag` are Next.js features that also work
  self-hosted, which keeps Constitution VIII.
- `expire: 0` makes the next request regenerate. Next 16's default `revalidateTag(tag, 'max')` is
  stale-while-revalidate, which would serve a hidden issue once more. With low widget traffic,
  that one stale response could be the only view for hours.
- A translation written in the background (spec 005 R8) expires the tag, so readers get the
  translated view on the next request. FR-004's 5-minute bound is met with room to spare.
- A partner removal also expires the cached response, and with it the cached CSP header, so
  revoking an origin takes effect immediately (R2).
- Cached responses keep the handler's headers (CSP, `X-Robots-Tag`). Next sets the
  `Cache-Control` for ISR.

**Verified (T001, 2026-10-30, `next@16.3.3`, `next build && next start`)**: all three checks pass.
The real embed route was used as the spike, so no throwaway route was committed.

- `revalidateTag(tag, { expire: 0 })` is accepted, and the next request is a `MISS` that re-renders
  (hide issue 1 → the widget shows issue 2; unhide → issue 1 again, no waiting).
- A `force-static` route handler with dynamic segments is cached per path (`x-nextjs-cache: HIT`).
- `Content-Security-Policy`, `X-Robots-Tag` and `Referrer-Policy` survive the cache unchanged.
- `next.config.ts` `headers()` must exclude `/embed/{locale}/…`, otherwise its global
  `frame-ancestors 'none'` and `X-Frame-Options: DENY` override the per-partner header.

The fallback below is not needed.

Original note:

Confirm against the installed `next@16.3.3` that:

- `revalidateTag` accepts `{ expire: 0 }`;
- `force-static` route handlers with dynamic segments are cached per path and tag-invalidated;
- headers survive the cache.

If any of these fails, use the fallback: a dynamic route handler with
`Cache-Control: public, s-maxage=300`. In fallback mode, bypass `loadEmbedModel`'s
`unstable_cache` entirely; the five-minute CDN cache is the only cache, so it bounds staleness
and completed translations appear within FR-004's five-minute window. This is still within FR-024
and needs no purge.

**Alternatives considered**: dynamic rendering on every request (no-store), which is what the
site does today. That means a database round trip on every partner page view, slower LCP, and no
benefit. `Cache-Control: s-maxage` plus a Vercel cache-tag purge is vendor-specific. Rejected
(Constitution VIII).

## R4. URL shape and options

**Decision**: Options live in path segments, not in the query string:

```text
/embed/{locale}/{projectSlug}/{partnerKey}/{theme}-{items}-{mode}[/{notice}]
e.g. /embed/ru/hht-research/curehht-ru/auto-3-form
     /embed/ru/hht-research/curehht-ru/auto-3-form/check-inbox
```

- `theme`: `auto`, `light` or `dark`.
- `items`: `1`–`20`.
- `mode`: `form` or `link`.
- `notice` (optional): `check-inbox`, `need-consent`, `bad-email` or `try-later`.

Out-of-range or malformed options get a 308 redirect to the canonical URL with defaults
(`auto-3-form`). An unsupported locale redirects to `en`.

**Rationale**:

- Static (ISR) route handlers can't read the query string, so every input that changes the output
  has to be part of the path.
- Canonicalization keeps the set of cache entries bounded:
  5 locales × 3 themes × 20 counts × 2 modes × 5 notice states per partner.
- The subscribe endpoint already redirects back to the referer with `?notice=`. For referers under
  `/embed/` it appends a notice segment instead (contract `embed-page.md`). That keeps the
  post-submit view static and lets it work without JavaScript inside the frame (FR-018).

**Alternatives considered**: query parameters, which force dynamic rendering. Rejected. Reading
the notice from `location.search` with JavaScript was also considered. It fails FR-018
("without JavaScript inside the frame"), so it was rejected.

## R5. Loader script and fallback-first snippet

**Decision**: The loader is `apps/web/public/embed/v1.js`: hand-written ES2017, no dependencies,
and a CI budget of at most 3 KB gzip. The snippet is a container element that holds the
partner's fallback markup, followed by one `async` script tag (contract `embed-snippet.md`). The
loader:

1. Processes every `[data-digest-widget]` container that hasn't been processed yet, so several
   widgets per page work.
2. Builds the canonical URL (R4) from data attributes. The widget origin comes from the loader's
   own `src`, so preview deployments work and no domain is hard-coded.
3. Inserts the frame **invisible but laid out** (`visibility: hidden`, full width, `height: 0`)
   with `title`, `sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"`,
   `referrerpolicy="strict-origin-when-cross-origin"`, and loads it eagerly.
4. Accepts `message` events only when `event.origin === widgetOrigin` and
   `event.source === frame.contentWindow`. On `ready`, it hides the fallback, shows the frame and
   sets its title and height. On `size`, it sets the height.
5. If `ready` hasn't arrived within **10 s**, it removes the frame and keeps the fallback
   visible. A late `ready` is ignored (spec edge case "slow but reachable").

**Rationale**:

- If our domain is blocked, the loader script is blocked too. The only fallback that always works
  is markup the partner page already contains (spec Assumptions). Fallback-first also covers
  JavaScript being off, a partner CSP that blocks our script, a disallowed origin, an unknown
  project and server errors. All of them end the same way: no `ready` arrives, so the fallback
  stays.
- An invisible but laid-out frame measures its real content height at the partner's width. A
  `display: none` frame has a zero-width viewport and reports the wrong height.
- `sandbox` limits what our frame can do to the partner page. The flags are the minimum the
  widget needs: its own scripts, our origin for the form POST, and new-tab links that are free of
  the sandbox.
- Eager loading: with `loading="lazy"`, a widget below the fold wouldn't start loading until the
  reader scrolls, and the 10 s timer would show the fallback by mistake. Lazy loading combined
  with an IntersectionObserver-started timer costs bytes for little gain at one widget per page.
- Versioned path `/embed/v1.js`: partners paste the snippet once (spec "never touches it again").
  A breaking change ships as `v2.js` while `v1.js` keeps working.

**Alternatives considered**: fallback built from data attributes by the script, as in the
description. It fails when the script itself is blocked. Kept only as a secondary convenience: if
the container is empty, the loader builds a one-line fallback from `data-fallback-text` and
`data-fallback-href`. The partner instructions use inline markup.

## R6. Height and ready protocol

**Decision**: The widget's inline script posts `{ type: 'digest-widget:ready', v: 1, height, title }`
once after load. It then posts `{ type: 'digest-widget:size', v: 1, height }` whenever a
`ResizeObserver` on `<html>` reports a change, at most once per animation frame. The target
origin is `'*'`.

**Rationale**: The frame doesn't reliably know the parent's origin. `ancestorOrigins` is missing in
Firefox, and `document.referrer` depends on the partner's referrer policy. The messages carry
only a number and the localized frame title, both of which are public, so `'*'` leaks nothing.
The loader verifies the sender (R5), which is the direction that matters. `ResizeObserver` covers
font loading, rotation, the notice view and wrapping at any width without polling. The frame
title comes in `ready`, so localized strings stay in `messages/*.json` (FR-029) rather than in the
3 KB loader.

## R7. Subscribing inside a third-party frame

**Decision**: Reuse the existing form POST to `/api/public/projects/{slug}/subscribe` unchanged in
shape, with three changes:

- The source comes from a hidden field rendered into the page (`site:<key>`), not from the cookie.
- The endpoint validates `site:<key>` against the project's partners.
- Redirects back to `/embed/…` referers use the notice path segment (R4).

**Rationale**:

- The flow needs no cookie and no storage, so Safari ITP, Firefox Total Cookie Protection, Chrome
  third-party cookie restrictions and storage partitioning don't affect it (FR-018, spec US3
  scenario 4).
- The POST is same-origin from the frame's point of view, so the `Referer` is the full embed URL
  under the default `strict-origin-when-cross-origin`. The endpoint's existing same-origin check
  on the referer keeps working.
- The same endpoint means the same honeypot, the same per-IP limiter (`subscribe-rate-limits`) and
  the same one-confirmation-per-hour rule, with shared counters (FR-022). Nothing about running in
  a frame bypasses them.
- Link-out mode (`mode=link`) is a plain link to `/{locale}/projects/{slug}?src=site:<key>#subscribe`
  in a new tab. There, the existing proxy cookie carries the source for the visit (FR-019, FR-020).

## R8. Attribution value and the schema change

**Decision**: A partner source is the string `site:<key>`, where `<key>` matches
`^[a-z0-9][a-z0-9-]{1,31}$` and is unique within the project. `packages/shared/src/chatSource.ts`
gains:

- `parseSourceToken(value)`: syntax only, accepts the chat sources and `site:<key>`. Used by
  `proxy.ts` for the visit cookie.
- `resolveSubscriptionSource(value, partnerKeys)`: returns a chat source, a configured
  `site:<key>`, or `other`. Used by the subscribe endpoint, the page-view counter and the
  embed-events endpoint.

`parseChatSource` stays as it is for existing callers. `Subscribers.source` and
`AnalyticsCounts.source` change from `select`, which is a Postgres enum, to `text`, with a
`validate` that enforces the syntax.

**Rationale**: This is the owner's clarification (spec, Session 2026-10-27): one source value
names the partner, with no new subscriber field. Per-project values can't be a Postgres enum.

**Risk: schema push.** `ensure-schema` runs Payload's dev push during the Vercel build. Changing
an enum column to `varchar` isn't additive. Drizzle push may ask for interactive confirmation of
warnings, and with no TTY Payload may exit without applying, while the build carries on. This has
not been verified, so:

1. Run `ensure-schema` against a **Neon branch** copied from production and inspect the result.
2. If it prompts or skips, the owner runs this one-off SQL on the branch first, then on production
   before deploying:
   ```sql
   ALTER TABLE subscribers ALTER COLUMN source DROP DEFAULT;
   ALTER TABLE subscribers ALTER COLUMN source TYPE varchar USING source::text;
   ALTER TABLE subscribers ALTER COLUMN source SET DEFAULT 'other'::varchar;
   ALTER TABLE analytics_counts ALTER COLUMN source TYPE varchar USING source::text;
   DROP TYPE IF EXISTS enum_subscribers_source;
   DROP TYPE IF EXISTS enum_analytics_counts_source;
   ```
   After that, push sees no diff. Existing values stay valid.
3. The ensure-schema log for the deploy is checked for "schema push complete".

This is a database change, so it needs the owner's explicit go-ahead (CLAUDE.md "ask first"). It is
a separate task in `tasks.md`, and nothing points a local process at production.

**Alternatives considered**: a generic `site` enum value with the partner only in counts, or a
separate partner field. Both were rejected by the owner on 2026-10-27.

## R9. Light and dark appearance in a frame

**Decision**: `<html data-theme="auto|light|dark">`. The CSS defines custom properties for light,
overrides them under `@media (prefers-color-scheme: dark)` when the theme is `auto`, and under
`[data-theme=dark]`. It sets `color-scheme` to match, and always paints its own `background`.

**Rationale**: Inside a frame, `prefers-color-scheme` reflects the reader's browser or OS setting,
which is what the spec defines as "auto". When the frame's `color-scheme` differs from the
embedding element's, browsers paint an opaque backdrop to keep text readable. Painting our own
background makes the result the same everywhere. A partner that wants to match a site theme
toggle sets `light` or `dark` explicitly.

## R10. Embed analytics without cookies

**Decision**:

- The inline script sends `navigator.sendBeacon('/api/public/projects/{slug}/embed-events', …)`
  with a `text/plain` JSON body `{ partner, issue, metric }`.
- `widget_view` is sent once per load, except on notice views.
- `outbound_click` is sent on `click` of any widget link. The link's `href` is the direct target,
  so counting can never delay or break navigation (FR-030).
- The endpoint validates the partner against the project, then increments `analytics-counts`
  with source `site:<key>` and the new metric. It always answers `204`.
- Form submissions and confirmations are already counted per source by spec 006. With the
  partner source they become per partner with no extra work.

**Rationale**: The beacon is same-origin from the frame, sets no cookie and sends none (there are
none in the frame), and loads no third-party tracker (FR-016). It is counted client-side because
ISR responses don't execute per view. Rows are anonymous aggregates, the same as spec 006 FR-038.

**Accepted risk**: Anyone can inflate the counts with scripted posts, as they can with today's
page-view counter. The counts are a signal, not a gate. Criterion 2 is measured by confirmed
subscribers.

## R11. Performance budget

**Decision**:

- **Widget document**: inline CSS of 4 KB or less, the system font stack (no web font), no
  images, and the inline script of about 1 KB.
- **Loader**: 3 KB gzip or less, enforced by a Jest test that gzips
  `public/embed/v1.js` and asserts `≤ 3072` bytes.
- **LCP**: measured with Lighthouse mobile (Moto G Power profile, simulated slow 4G) on a test host
  page. The pass mark is under 2.5 s at the 75th percentile of 5 runs (quickstart).

**Rationale**: The ISR response is served from the CDN, and HTML with inline CSS paints on first
response. The LCP element is the issue heading or the first summary point (text), so no font,
image or JavaScript blocks it.

## R12. Reachability from Russian networks (FR-034)

**Decision**: This is not a build task. It is a launch prerequisite owned by the owner. Suggested
method: request `/embed/v1.js` and one embed URL from Russian residential and mobile ASNs without
a VPN. Use RIPE Atlas probes filtered to RU access networks, or two or three volunteer readers on
home Wi-Fi and on a mobile carrier. Record the date, networks and result in
`docs/launch/2026-11-embed-reachability.md`.

**Rationale**: The owner chose "frame widget plus fallback only" (spec clarification). The result
decides whether a later snapshot spec is needed, not what this spec builds. The fallback content
(R5) is designed for the blocked case.

## R13. Period-review link (User Story 4)

**Decision**: Nothing is built for it now. The widget model has an optional `periodReview` field
that is always `null` in this feature, and the renderer outputs nothing for `null`. Spec 013's
tasks add the query that fills it.

**Rationale**: Constitution II (no speculative code). The spec only requires that the widget not
block on 013 and render no placeholder. A typed optional field is the whole integration point.

## R14. Accessibility checks

**Decision**: Add `@axe-core/playwright` as a **dev dependency**. Run it on the issue page and on
the embed page, rendered directly and inside the test host. The pass condition is no `serious`
or `critical` violations. Manual keyboard and screen-reader checks are listed in the quickstart.

**Rationale**: FR-028 and SC-007 require "the same accessibility checks as the issue page", and
the issue page has none today (spec Assumptions). axe-core is the standard engine, is dev-only,
and has no runtime or cost impact. Justified under Constitution IX (enforced quality gates) in the
plan's Complexity Tracking.
