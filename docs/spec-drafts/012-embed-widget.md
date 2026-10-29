Embeddable Widget — a partner site (first: curehht-ru.org) shows the latest issue and a subscribe form from this platform with one snippet, so patients who visit the partner site find the digest without looking for it.

## Why

- Quarter criterion 2 needs confirmed subscribers with attribution. Today they can only come from the patient chats (`src` = vk / wa / fb / tg).
- curehht-ru.org is the Russian-language HHT patient site. Its "News" section is hand-written and was last updated in March 2026. Its readers are exactly our audience.
- The owner maintains `curehht/curehht.github.io`, so the snippet can be merged there directly.
- curehht-ru.org is a **static export on GitHub Pages** (`output: 'export'`, rebuilt only on deploy). A widget has to fetch fresh content in the browser; build-time rendering would freeze at the last deploy.

## Who

- **Patient on the partner site (primary).** Sees what's new in HHT research in plain Russian, opens an issue, subscribes.
- **Partner site maintainer.** Pastes one snippet, sets the language, and never touches it again.

## User stories

1. **P1 — Latest issue in the widget.**
   - The widget shows the latest public issue of a project: date, summary points, and up to N items (title + plain-language sentence + link to the item page).
   - A "All issues" link goes to the project's issue archive.
   - Medical disclaimer line and AI label are always visible.
   - Content is in the widget's locale; if the issue translation isn't ready, it falls back the same way the issue page does.
2. **P1 — One-snippet embed.**
   - The partner pastes a `<script>` tag with `data-project`, `data-locale` (and optional `data-items`, `data-theme`).
   - The script inserts an iframe from our domain and resizes it to its content height (postMessage), so there are no inner scrollbars.
   - A plain `<iframe>` snippet works too, for sites that don't allow third-party scripts (fixed height).
   - Works at 320 px width; follows the partner's light/dark preference when `data-theme="auto"`.
3. **P1 — Subscribe from the widget.**
   - The widget has the same subscribe form as the issue page (email, language, consent checkbox, honeypot), or a button that opens the subscribe form on our site in a new tab — see open question Q2.
   - Subscriptions from the widget are attributed to the embedding site, not to `other`.
4. **P2 — Latest period review.** When spec 013 ships, the widget also links to the latest monthly/quarterly review. The widget must not block on 013.
5. **P3 — Embed analytics.** Cookie-less counts of widget views and outbound clicks per embedding site, in the same place as the existing issue-page counts.

## Decisions already made (please don't re-ask)

- **First partner: curehht-ru.org, ru only on launch.** The widget itself supports every UI locale.
- **No new content sources.** The widget shows what the platform already publishes.
- **Topic-agnostic.** No disease names in code. Allowed embedding origins, partner name and attribution value come from project data, not code.
- **Subscription stays email + locale + source + consent** (Constitution IV). The widget adds a source value, nothing else.
- **No cookies, no third-party trackers** inside the iframe.

## Requirements

- **Allowed origins.** Embed routes send `Content-Security-Policy: frame-ancestors` with the project's allow-list (a new project field, e.g. `embedAllowedOrigins`). Other origins get a blank frame, not our page. Non-embed routes are unchanged by this spec (see Notes).
- **Attribution.** Extend the chat-source allow-list ([chatSource.ts](../../packages/shared/src/chatSource.ts)) with a value for partner sites (e.g. `site`), and record which allowed origin it came from. Unknown values still map to `other`.
- **Abuse protection** is the same as for the existing subscribe endpoint (rate limit per IP and per address, honeypot, one confirmation per hour). Running in a third-party iframe must not weaken it.
- **Caching.** The embed page is cacheable at the CDN for at most 1 h and is revalidated when an issue is published or hidden. A hidden issue (`hiddenFromPublic`) never appears in the widget.
- **Performance.** Loader script ≤ 3 KB gzipped, no framework. The iframe page ships no Payload admin code. LCP of the widget < 2.5 s on a mid-range phone over 4G.
- **Failure mode.** If our domain is unreachable (see Q1), the loader replaces the iframe after a timeout with a static fallback block: one sentence and links to the VK community / subscribe page, provided in the snippet's attributes. The partner page never shows a broken frame or a spinner forever.
- **Accessibility.** The iframe has a `title`; the content passes the same a11y checks as the issue page; links that leave the widget open in a new tab with `rel="noopener"`.
- **i18n.** Every widget string is in `messages/*.json` for all UI locales.

## Acceptance

- A test page on another origin in the allow-list renders the widget, auto-resizes, and a subscription from it is stored with the partner source.
- The same page on an origin not in the allow-list does not render our content.
- Hiding the latest issue removes it from the widget within the cache window.
- The curehht-ru.org PR adds the snippet to the news page (ru), and it renders on a GitHub Pages preview.

## Open questions

- **Q1 — Reachability from Russia.** Is `hht.rarediseasedigest.org` reachable from Russian residential and mobile networks without VPN? If not, an iframe is empty for most patients. Alternative: a scheduled GitHub Action in the partner repo pulls the latest issue JSON from our public API and rebuilds the static site, so content is served from GitHub Pages. That is fresher-than-never but needs the partner build to work in CI.
- **Q2 — Form in the iframe or link out?** An in-iframe form converts better. A link to our subscribe page is simpler and avoids third-party-context surprises (Safari ITP, partner CSP). Recommendation: in-iframe form; link-out as fallback when `data-subscribe="link"`.
- **Q3 — Items shown.** All items of the latest issue, or top 3 by importance? Until spec 007 ships, importance doesn't discriminate, so "first 3 in issue order" is the honest default.

## Notes

- Neither `next.config` nor `proxy.ts` sets `frame-ancestors` or `X-Frame-Options` (verify the live response headers), so every page, including `/admin`, can probably be framed by anyone. Closing that for non-embed routes is a separate small hardening fix, not part of this spec, but should land before or with it.
