# Quickstart: Validate the Embeddable Widget

This guide shows how to prove the spec's acceptance criteria end to end. Interfaces are defined in
[`contracts/`](./contracts/), and data in [`data-model.md`](./data-model.md).

## Prerequisites

- Local stack as in `AGENTS.md`: Docker Postgres, `apps/web/.env.local`, and **never** the
  production `DATABASE_URL`.
- Seed data: `pnpm --filter @hht/web seed:public-feed` creates `hht-research` with published
  issues. This feature extends the seed with one partner:
  `{ name: 'E2E partner', key: 'e2e-partner', origins: ['http://127.0.0.1:4310', 'http://partner.test'] }`.
- `pnpm --filter @hht/web dev` on port 3000. The automated checks below run against
  `next start` in CI, because ISR and cache behavior only apply to production builds.

## 1. Automated gates

```bash
pnpm check 2>&1 | tail -50                         # typecheck + lint + Jest
pnpm --filter @hht/web test:e2e -- embed 2>&1 | tail -50
```

Jest must cover:

- **Shared helpers**: `parseSourceToken`, `resolveSubscriptionSource`, `normalizeEmbedOrigin`,
  partner key rules, and `parseEmbedOptions`/`formatEmbedOptions` round-trips.
- **Renderer**: escaping (a fixture with `<script>`, quotes and `javascript:` in titles and URLs),
  the disclaimer and AI label present in every state, `moreCount`, and the "first issue" state.
- **CSP**: built per partner, and `'none'` for unknown values.
- **Loader**: `public/embed/v1.js` is at most 3072 bytes gzipped.
- **Redirect mapping**: subscribe redirects to `/embed/…/{notice}`.

Playwright (`tests/e2e/embed.spec.ts`) must cover the following. The test host page is served by
`page.route('http://partner.test/**')` and `page.route('http://blocked.test/**')`.

| Scenario                                                                                                    | Spec                   |
| ----------------------------------------------------------------------------------------------------------- | ---------------------- |
| On an allowed origin, the widget shows the date, summary, 3 items, all-issues link, disclaimer and AI label | US1 #1, #5; FR-001–003 |
| The frame height equals the content height (±2 px) at 320 and 1280 px, with no inner scrollbar              | US2 #1, #3             |
| The height follows a form notice                                                                            | US2 #2                 |
| `prefers-color-scheme: dark` + `auto` → dark background; `light` forces light                               | US2 #4                 |
| On a disallowed origin, no widget content is visible, and the fallback is visible after ≤ 10 s              | SC-003, FR-009/012     |
| An `/embed/*` request is aborted by a route → fallback within 10 s, no empty frame                          | US2 #6, SC-005         |
| An unknown partner → fallback                                                                               | US2 #7                 |
| Subscribe in the frame (stub email) → confirm → subscriber `source = site:e2e-partner`                      | US3 #3, SC-002         |
| A submission with `src=site:not-configured` → stored as `other`                                             | US3 #8, FR-020         |
| Link mode opens a new tab with `?src=site:e2e-partner`; subscribing there is attributed                     | US3 #5, #6             |
| No `Set-Cookie` on `/embed/*` responses; no cookies or storage in the frame                                 | FR-016, US5 #2         |
| Hide the latest issue via the admin API → the next widget load shows the previous issue                     | US1 #6, FR-005, SC-004 |
| Beacons increment `widget_view` and `outbound_click` for `site:e2e-partner`                                 | US5 #1                 |
| axe: no serious or critical violations on the issue page and the embed page                                 | FR-028, SC-007         |
| A plain `<iframe>` snippet renders at a fixed height with the content reachable                             | US2 #5                 |
| The framing-hardening header (once landed) is absent on `/embed/*`                                          | research R2            |

## 2. Manual check on a second origin

The same file is served from two origins: `127.0.0.1` is allowed and `localhost` is not.

```bash
cd apps/web/tests/fixtures && python3 -m http.server 4310 --bind 127.0.0.1
```

- Open `http://127.0.0.1:4310/partner-host.html`. The fixture contains the script snippet pointing
  at `http://localhost:3000/embed/v1.js` with `data-partner="e2e-partner"`. Expect the widget to
  render, to resize, and to subscribe from the frame. In the admin, the subscriber's source is
  `site:e2e-partner`.
- Open `http://localhost:4310/partner-host.html` (another origin, not in the list). Expect no
  content from us, and the fallback paragraph to stay.
- Stop the dev server and reload the first URL. Expect the fallback, with no blank box and no
  spinner.
- Keyboard only: Tab reaches every link and form control in order, and focus is visible. With
  VoiceOver or NVDA, the frame is announced by its title, and the notice is announced after
  submitting.

## 3. Caching (production build)

```bash
pnpm --filter @hht/web build && pnpm --filter @hht/web start
curl -sI http://localhost:3000/embed/ru/hht-research/e2e-partner/auto-3-form \
  | grep -iE 'content-security-policy|x-robots-tag|cache-control|set-cookie'
```

Expect `frame-ancestors http://127.0.0.1:4310 http://partner.test`, `noindex`, an ISR
`Cache-Control`, and no `Set-Cookie`. Hide the latest issue in the admin, request again, and
expect the previous issue. Remove `http://partner.test` from the partner, request again, and
expect it to be gone from the header.

## 4. Performance

- `gzip -9c apps/web/public/embed/v1.js | wc -c` must be ≤ 3072.
- Lighthouse mobile (default throttling) on `http://127.0.0.1:4310/partner-host.html` against the
  production build, 5 runs. The widget frame's own LCP (Performance panel → frame) must be under
  2.5 s at the 75th percentile across those five runs before launch (FR-027, SC-006).
- `curl -s …/embed/ru/hht-research/e2e-partner/auto-3-form | grep -c "_next/static"` must be `0`.
  No Next client runtime and no admin code (FR-026).

## 5. Launch checklist (production; owner actions)

1. Schema: run `ensure-schema` on a Neon branch of production and confirm that the `source`
   columns are `varchar`. If they aren't, apply the SQL in research R8 with the owner's go-ahead,
   first to the branch, then to production.
2. Russia reachability check recorded in `docs/launch/2026-11-embed-reachability.md` (FR-034,
   research R12).
3. In the admin, add partner `curehht-ru` to the project with origin `https://curehht-ru.org`, and
   the GitHub Pages preview origin while testing.
4. `curl -sI https://hht.rarediseasedigest.org/embed/ru/<slug>/curehht-ru/auto-3-form`: the
   headers are as in section 3.
5. Open a pull request in `curehht/curehht.github.io` that adds the snippet from the admin's
   `embedSnippets` to the Russian news page. Confirm on its GitHub Pages preview that the widget
   renders the latest Russian issue (FR-032). This is an outward-facing action, so confirm with
   the owner before opening it.
6. After merge: remove the preview origin, and check the live partner page at 320 px in light
   and dark mode.
7. A week later: the admin shows widget views, clicks, form submissions and confirmations under
   `site:curehht-ru` (SC-009).
