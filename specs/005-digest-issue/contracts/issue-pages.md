# Contract: Reader Pages, Metadata and Share Images

**Feature**: `005-digest-issue` | **Scope**: `apps/web/src/app/[locale]/…` (public tree)

This contract defines what each reader-facing route renders, what metadata it emits, and which
share image applies. Data comes from [`public-issues-api.md`](./public-issues-api.md). Pages
keep the 002/003 pattern: server components that fetch the public API with `no-store`.

---

## 1. Routes

| Route                                         | Status  | Renders                                                                                                                              |
| --------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `/{locale}`                                   | changed | Patient-facing title and subtitle (FR-018). The project list is otherwise unchanged.                                                 |
| `/{locale}/projects/{slug}`                   | changed | Header → **latest issue card** (date, excerpt, "Read this issue", "All issues") → the flat materials feed, unchanged (FR-019).       |
| `/{locale}/projects/{slug}/issues`            | **new** | Archive: every visible issue, newest first. Each row shows the date, the item count, and the excerpt, linking to the issue (FR-002). |
| `/{locale}/projects/{slug}/issues/{issueId}`  | **new** | The issue page (§2). `not-found.tsx` / `error.tsx` behave as in 003.                                                                 |
| `/{locale}/projects/{slug}/publications/{id}` | changed | Adds `TrustNotice` and `generateMetadata`. Otherwise unchanged (003).                                                                |

Issue and archive URLs are built with next-intl `Link` (locale-prefixed). The `{issueId}` is the
digest id.

---

## 2. Issue page layout (order is normative)

1. Back link to the project page.
2. `<h1>`: `Issue.heading` ("{projectName}: update of {date}"), with the date formatted per locale.
3. **Summary** `<section aria-labelledby>` (heading `Issue.summaryHeading`, "What's new and why it matters"):
   - `<ol>` of the summary points (3–5; fewer only for a 1–2 item issue). Each point ends with "Based on:" and one anchor per item,
     `<a href="#item-{id}">{n}</a>`, where `n` is the item's position in the list below (FR-007).
   - If `summary === null`: one line `Issue.summaryUnavailable` instead of the list (FR-015).
   - If `isFallback`: the note `Issue.translationPending` or `Issue.translationUnavailable`,
     depending on `translation.status` (FR-013).
4. `TrustNotice` (§4).
5. **Items** `<section>` (heading `Issue.itemsHeading`) with an `<ol>` in API order. Each `<li id="item-{id}">` has:
   - its number `n`;
   - the title as a link to `/projects/{slug}/publications/{id}` (same tab, as in 003);
   - `SourceBadge`, and for `isTrialRegistration` an extra `Issue.trialLabel` ("Registered study, no
     results yet");
   - the date (omitted if `null`);
   - `sentence` (omitted if `null`).
6. A link to the archive.

**Constraints** (FR-016):

- The page is fully server-rendered. Summary, items, anchors and the disclaimer all work with
  JavaScript disabled. Anchor links are plain fragment links.
- At a 360 px viewport: single column, long titles wrap (`overflow-wrap: anywhere`), and there
  is no horizontal scroll.
- `TextLink` visible focus is preserved (003 FR-023).

---

## 3. Metadata (`generateMetadata`)

`[locale]/layout.tsx` sets `metadataBase` (`getPublicSiteUrl()`), `title.template`
(`%s · {Site.name}`), the default `description` (`Site.description`), `openGraph.siteName`,
`openGraph.locale`, and `alternates.languages` (all five locales for the current path).

| Route    | `title`                                  | `description`                                                          | `og:type` | Image source                                              |
| -------- | ---------------------------------------- | ---------------------------------------------------------------------- | --------- | --------------------------------------------------------- |
| home     | `Home.metaTitle`                         | `Site.description`                                                     | website   | `[locale]/opengraph-image`                                |
| project  | `{project.name}`                         | `Project.metaDescription` ({projectName})                              | website   | `projects/[slug]/opengraph-image` (default project image) |
| archive  | `Issue.archiveMetaTitle` ({projectName}) | `Project.metaDescription`                                              | website   | inherited project image                                   |
| issue    | `meta.title` from the API                | `meta.description` from the API                                        | article   | `issues/[issueId]/opengraph-image`                        |
| material | the material title (localized)           | the objective, cut to ≤ 160 characters, else `Project.metaDescription` | article   | inherited project image                                   |

Every page also emits `twitter.card = 'summary_large_image'` with the same title and description.
`opengraph-image` does not emit `twitter:image` (separate convention). None of the target chat
apps needs it, so no `twitter-image` files are added (research R12).

- **Inherited image (archive, material)**: these pages set their own `openGraph`, which replaces
  the parent's object and can drop the inherited `og:image`. The shared builder must keep the
  project image. Either it leaves `openGraph.images` to the file convention and the test below
  proves the image survives, or it sets `images` to the project image URL explicitly (research
  R12).

- The issue page wraps its API call in React `cache()` so `generateMetadata` and the page share
  one request, including one translation wait.
- `next.config.ts` sets `htmlLimitedBots` to Next's built-in pattern plus `TelegramBot|Viber`
  (research R11), so metadata is in `<head>` for those crawlers.

**Acceptance probe** (quickstart §4): `curl -A 'TelegramBot (like TwitterBot)'` on an issue URL,
an archive URL **and** a material detail URL returns `<head>` containing `og:title`,
`og:description`, and an absolute `og:image` URL.

---

## 4. `TrustNotice` component

- Server component with no client JavaScript. It renders two short paragraphs from `Trust.*`
  messages:
  - `Trust.disclaimer`: "This is an automated overview, not medical advice. Talk to your doctor
    before changing any treatment."
  - `Trust.aiLabel`: "Summaries are generated by AI from the linked sources."
- Used on the issue page and the material detail page (FR-011) in all five locales.
- It contains no disease names. Topic wording, if ever needed, comes from project data.

---

## 5. Share images (`opengraph-image.tsx`, `next/og`)

| File                                                            | Content                                                            | Fallback                                                                    |
| --------------------------------------------------------------- | ------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| `[locale]/opengraph-image.tsx`                                  | `Site.name` + `Site.tagline`                                       | —                                                                           |
| `[locale]/projects/[slug]/opengraph-image.tsx`                  | project name + `Project.imageTagline`                              | the site card if the project cannot be loaded                               |
| `[locale]/projects/[slug]/issues/[issueId]/opengraph-image.tsx` | project name + localized issue date + `Issue.imageCount` ({count}) | the project card if the issue is hidden, unknown, or fails to load (FR-010) |

- `size = { width: 1200, height: 630 }`, `contentType = 'image/png'`, Node runtime.
- Fonts: `assets/fonts/IBMPlexSans-{Regular,SemiBold}.ttf`, which cover Latin Extended and
  Cyrillic. They are included via `outputFileTracingIncludes` for these routes.
- Images read issue and project data through the server-side issue query module, which is the
  same code the API route handlers use. They **never** trigger or wait for translation.
- `alt` text is localized (`Issue.imageAlt`, `Project.imageAlt`).

---

## 6. New and changed message keys (all five locale files)

| Namespace | Keys                                                                                                                                                                                                                                                                                                                             |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Site`    | `name`, `description`, `tagline`                                                                                                                                                                                                                                                                                                 |
| `Home`    | `title`, `subtitle`, `latestDigest` → rewritten for patients; `metaTitle`                                                                                                                                                                                                                                                        |
| `Project` | `metaDescription`, `imageTagline`, `imageAlt`, `latestIssueHeading`, `readIssue`, `allIssues`, `noIssuesYet`                                                                                                                                                                                                                     |
| `Issue`   | `heading`, `metaTitle`, `metaDescriptionFallback`, `summaryHeading`, `summaryUnavailable`, `basedOn`, `itemsHeading`, `trialLabel`, `translationPending`, `translationUnavailable`, `archiveTitle`, `archiveMetaTitle`, `archiveEmpty`, `itemCount`, `backToProject`, `imageCount`, `imageAlt`, `notFound`, `loadError`, `retry` |
| `Trust`   | `disclaimer`, `aiLabel`                                                                                                                                                                                                                                                                                                          |

Copy rules (FR-018): addressed to a patient, no internal terms ("monitoring", "configured
research projects", "digest", "publication"), and no disease names.
