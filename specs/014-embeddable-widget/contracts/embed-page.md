# Contract: Embed Page (`GET /embed/…`)

The route handlers are `apps/web/src/app/embed/[locale]/[slug]/[partner]/[options]/route.ts` and
`…/[options]/[notice]/route.ts`. Both are ISR (research R3) and share one renderer.

## Request

```text
GET /embed/{locale}/{slug}/{partner}/{theme}-{items}-{mode}
GET /embed/{locale}/{slug}/{partner}/{theme}-{items}-{mode}/{notice}
```

| Segment   | Accepted                                                 | Otherwise                                                                 |
| --------- | -------------------------------------------------------- | ------------------------------------------------------------------------- |
| `locale`  | `en` `de` `tr` `ru` `uk`                                 | 308 → same path with `en`                                                 |
| `slug`    | existing project slug                                    | 404 (below)                                                               |
| `partner` | key in that project's `embedPartners`                    | 404 (below)                                                               |
| options   | `^(auto\|light\|dark)-([1-9]\|1[0-9]\|20)-(form\|link)$` | 308 → canonical with defaults for the invalid parts (`auto`, `3`, `form`) |
| `notice`  | `check-inbox` `need-consent` `bad-email` `try-later`     | 308 → path without the notice                                             |

## Response headers (every status)

| Header                    | Value                                                                                    |
| ------------------------- | ---------------------------------------------------------------------------------------- |
| `Content-Type`            | `text/html; charset=utf-8`                                                               |
| `Content-Security-Policy` | `frame-ancestors {partner origins, space-separated}`, or `frame-ancestors 'none'` on 404 |
| `X-Robots-Tag`            | `noindex, nofollow`                                                                      |
| `Referrer-Policy`         | `strict-origin-when-cross-origin`                                                        |
| `Cache-Control`           | set by Next ISR (`s-maxage=3600, stale-while-revalidate…`); tag `embed:project:<id>`     |
| `Set-Cookie`              | **never** (spec FR-016); asserted by E2E                                                 |

The response sends no `X-Frame-Options` (research R2). `/embed/` is excluded from `proxy.ts`, so
neither next-intl nor the `src` cookie touches it.

**404 body**: a minimal document with no project content and no ready message. The loader keeps
the fallback.

## Document structure (200)

```html
<!doctype html>
<html lang="{locale}" data-theme="{theme}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex" />
    <title>{Widget.frameTitle}</title>
    <style>
      /* inline, ≤ 4 KB, research R9/R11 */
    </style>
  </head>
  <body>
    <main>
      <article aria-labelledby="w-heading">
        <h2 id="w-heading"><a …issue link>{Widget.heading: project name, date}</a></h2>
        <!-- when isFallback: <p role="note">{Issue.translationPending|translationUnavailable}</p> -->
        <ol lang="{displayedLocale if fallback}">
          summary points…
        </ol>
        <!-- omitted if no summary -->
        <ul>
          <li>
            <a …item link>{title}</a> <span>{trial label?}</span>
            <p>{sentence}</p>
          </li>
          …
        </ul>
        <p><a …issue link>{Widget.moreItems: count}</a></p>
        <!-- when moreCount > 0 -->
        <p><a …archive link>{Widget.allIssues}</a></p>
        <!-- periodReview: nothing in this feature (research R13) -->
      </article>
      <!-- no issue: <p>{Widget.firstIssueComing}</p> instead of <article> -->
      <section aria-labelledby="w-subscribe">
        <h2 id="w-subscribe">{Widget.subscribeHeading}</h2>
        <!-- notice: <p role="status" tabindex="-1">{Subscribe.<notice>}</p> -->
        <!-- mode=form: the form below; mode=link: <a …subscribe link class=button>{Widget.subscribeButton}</a> -->
      </section>
      <footer>
        <p>{Trust disclaimer line}</p>
        <p>{Trust AI-generated label}</p>
      </footer>
    </main>
    <script>
      /* inline, research R6/R10 */
    </script>
  </body>
</html>
```

- The disclaimer and the AI label reuse the existing `Trust` strings used by `TrustNotice`, and
  they are rendered whenever the document renders, including the "no issue" state (spec FR-003).
- Every `<a>` that leaves the widget has `target="_blank" rel="noopener"` and an absolute
  `https:` URL on `getPublicSiteUrl()` (spec FR-017). Item, issue, archive and subscribe links
  carry `?src=site:<key>`. Privacy doesn't.
  - Item: `/{locale}/projects/{slug}/publications/{id}`
  - Issue: `/{locale}/projects/{slug}/issues/{issueId}`
  - Archive: `/{locale}/projects/{slug}/issues`
  - Subscribe (link mode): `/{locale}/projects/{slug}?src=site:<key>#subscribe`
- Item order, the trial label and the translation fallback are identical to the issue page
  (`IssueDetail` from spec 005).

## Form (mode = form)

The same fields and order as `SubscribeForm` (spec 006 FR-001):

```html
<form method="post" action="/api/public/projects/{slug}/subscribe">
  email (type=email, required, autocomplete=email, labelled)
  language radio ru|en (preset ru for locale ru, en otherwise)
  consent checkbox (unticked, names the project, privacy link target=_blank rel=noopener)
  <input type="hidden" name="src" value="site:{key}">
  <input type="hidden" name="issue" value="{issueId|''}">
  honeypot `company` (visually hidden, aria-hidden, tabindex=-1)
  <button type="submit">
</form>
```

The form works with JavaScript disabled inside the frame. After submission, the frame shows
`…/{options}/{notice}` (see `embed-endpoints.md`).

## Inline script (≈ 1 KB, no dependencies)

1. If `window.parent !== window`: post `digest-widget:ready { v:1, height, title: document.title }`
   to `'*'` on `DOMContentLoaded`. Then a `ResizeObserver` on `document.documentElement` posts
   `digest-widget:size { v:1, height }` when the rounded height changes, at most once per frame
   (research R6). `height = Math.ceil(document.documentElement.getBoundingClientRect().height)`.
2. If there is no notice segment: `sendBeacon` a `widget_view` (research R10).
3. Delegated `click` on `a[data-track]`: `sendBeacon` an `outbound_click`. It never calls
   `preventDefault`.
4. If a notice is shown: focus the `role=status` element so screen readers announce it.

## Messages (`messages/*.json`, new namespace `Widget`, all five locales)

`frameTitle`, `heading`, `summaryHeading`, `moreItems` (ICU plural), `allIssues`,
`firstIssueComing`, `subscribeHeading`, `subscribeButton`, `trialLabel` (if not reused from
`Issue`), `fallbackSentence`, `fallbackCommunity`, `fallbackSubscribe`.

The last three are used only by the snippet generator and the docs. Existing `Subscribe.*`,
`Issue.*` and `Trust.*` keys are reused, not duplicated.
