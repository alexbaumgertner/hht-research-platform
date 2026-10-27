# Contract: Events Endpoint, Subscribe Changes, Proxy and Revalidation

## `POST /api/public/projects/{slug}/embed-events` (new)

The inline script sends this with `navigator.sendBeacon`, and it is same-origin from the frame.

```text
Content-Type: text/plain;charset=UTF-8      (avoids a CORS preflight; parsed as JSON)
Body: {"partner":"curehht-ru","issue":"123","metric":"widget_view"|"outbound_click"}
```

| Case                                                              | Effect                                                               | Response |
| ----------------------------------------------------------------- | -------------------------------------------------------------------- | -------- |
| Valid project, configured partner, known metric                   | `analytics-counts +1 (project, issue or 'none', site:<key>, metric)` | `204`    |
| Unknown project or partner, bad JSON, unknown metric, body > 1 KB | nothing                                                              | `204`    |

- `Cache-Control: no-store`. Never sets a cookie. Never echoes input.
- `issue` is accepted only if it is a visible issue of that project. Otherwise it is recorded as
  `none`.
- No rate limit, by accepted design (research R10).

## `POST /api/public/projects/{slug}/subscribe` (changed)

Unchanged: fields, honeypot, per-IP limiter, the one-confirmation-per-hour rule, identical
responses, and the confirmation email (spec 006).

Changed:

1. **Source.** `src = resolveSubscriptionSource(form.src, partnerKeys(project))`, where
   `partnerKeys` comes from `project.embedPartners`. The result is `vk|wa|fb|tg`, a configured
   `site:<key>`, or `other`. It is used for both the subscriber row and the `form_submit` count.
2. **Redirect target.** If the `Referer` is same-origin and its path matches
   `^/embed/{locale}/{slug}/{partner}/{options}(/{notice})?$`, redirect `303` to that path with
   the notice segment replaced: `check_inbox` → `check-inbox`, and likewise for the others.
   Otherwise, behave as today (`?notice=` on the referer or the project page).

`issueKey` handling is unchanged: the widget form posts the shown issue id.

## Confirmation counting (changed)

The `confirmation` metric is counted with the subscriber's stored `source`, which may be
`site:<key>`. No other change.

## Page-view counting on the site (changed)

The issue page's `page_view` count resolves `?src=` with `resolveSubscriptionSource(src, partnerKeys)`,
so a reader arriving from a widget link is counted under the partner.

## `proxy.ts` (changed)

1. **Matcher**: exclude `embed` alongside `api`, `admin`, `_next` and `_vercel`. Paths with a dot
   (`/embed/v1.js`) are already excluded.
2. **Visit cookie**: store the `src` cookie when `parseSourceToken(src)` returns a non-`other`
   value. That is a chat source or any syntactically valid `site:<key>`. Membership is checked
   later, at subscribe time. `SubscribeForm` reads the cookie through the same function.

## `SubscribeForm` (changed)

The cookie read moves to the callers (issue page, project page), which pass `src` as a prop. The
component no longer calls `cookies()`. The embed renderer doesn't use this React component. It
renders the same fields with the same `Subscribe.*` messages (contract `embed-page.md`). A shared
test fixture asserts that both forms post the same field names.

## Revalidation hooks (new)

`revalidateEmbed(projectId)` calls `revalidateTag('embed:project:' + projectId, { expire: 0 })`
and swallows and logs errors, because revalidation must never fail a write. It is called from:

| Hook                                             | Condition                                                                                                                                                    |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `Digests.afterChange`                            | `create`; or `update` where `hiddenFromPublic`, `issueTextStatus`, `issueTextRevision`, `issueSummaryPoints`, `issueItemSentences` or `publications` changed |
| `issueTranslationStore` write (status → `ready`) | always                                                                                                                                                       |
| `ResearchProjects.afterChange`                   | `embedPartners`, `name` or `slug` changed                                                                                                                    |

## `next.config` `headers()` (changed)

`/embed/v1.js` → `Cache-Control: public, max-age=3600`. No other header changes in this feature.
Framing headers for other routes belong to the separate hardening task, and that task MUST exclude
`/embed/` (research R2).
