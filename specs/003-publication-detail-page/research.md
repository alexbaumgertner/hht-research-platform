# Research: Publication Detail Page

**Branch**: `003-publication-detail-page` | **Date**: 2026-09-01 | **Spec**: [`spec.md`](./spec.md)

This feature has no unresolved `[NEEDS CLARIFICATION]` markers — the `/speckit-clarify` session
closed product-level ambiguity. What remains here are **technical** decisions the spec left to
planning (or that implementation must choose). Each decision states what was chosen, why, and
what was rejected.

---

## R1 — Feed title is an in-app link to the existing detail URL

**Decision**: `MaterialCard` title becomes a next-intl `Link` to
`/projects/{slug}/publications/{id}` in the same tab. Remove visible `Materials.opensInNewTab`
from the card. Stop using `material.url` (original address) as the title `href`. Pass `slug` from
the project page through `MaterialsFeed` into each card.

**Rationale**: FR-001 and FR-002. The card already has `material.id`. The route already exists;
002’s R12 left it in place for direct URLs but stopped linking from the feed — this feature
reverses only that linking choice.

**Alternatives considered**:

- _Make the whole card clickable._ Rejected — spec Out of Scope.
- _Add a separate “Read more” control._ Rejected — same; the title is the entry.
- _Keep `target="_blank"` on the in-app link._ Rejected — FR-002 forbids a new tab from the title.

---

## R2 — Replace unscoped `GET /api/public/publications/:id` with a project-scoped materials detail GET

**Decision**: Add `GET /api/public/projects/:slug/materials/:id?locale=`. Delete
`GET /api/public/publications/:id`. The detail page is the only consumer of the old route
(verified by repo search). The new route returns the Material Detail shape in
[`contracts/material-detail-api.md`](./contracts/material-detail-api.md).

**Rationale**: The list endpoint is already `/api/public/projects/:slug/materials`. Detail must
use the same project + `feedPublishedAt` eligibility (R3). An ID-only route cannot prove the
reader is asking under the right project without a second lookup, and leaving it would keep a
second, easier-to-get-wrong public surface (Principle V).

**Alternatives considered**:

- _Extend the existing `/api/public/publications/:id` in place._ Rejected — it has no slug, today
  it does not check `feedPublishedAt`, and it 404s when summary is missing (conflicts with
  FR-012). Patching it still leaves an unscoped URL that can be guessed by ID.
- _Have the RSC read Payload directly and skip a public HTTP GET._ Rejected — the project page
  already goes through `/api/public/...` so Playwright and the browser see one contract; keep
  that pattern (002 R1).

---

## R3 — Same publishing gate as the feed; unpublished ≡ unknown

**Decision**: The detail GET returns 404 when any of these hold:

- no publication with that id
- publication’s project slug ≠ `:slug`
- `feedPublishedAt` is missing (not carried by a published digest)

Response body for all three is the same `{ "error": "Not found" }`. Never 403. Never return
fields for ineligible rows.

**Rationale**: FR-004, FR-030, SC-009. Today’s unscoped publication GET uses `findByID` with
`overrideAccess: true` and no `feedPublishedAt` check, so unpublished summaries are reachable by
ID. This feature adds `abstractOrBody` to the public surface; shipping that without the gate
would widen leaked content. Closing the hole is in-scope, not a separate security project.

**Follow-on**: The page maps HTTP 404 → `notFound()` (R5). Do not render a different message for
“unpublished” vs “unknown”.

---

## R4 — `abstractOrBody` only on the detail GET

**Decision**: Map `publications.abstractOrBody` into the detail response as `abstractOrBody`
(string or `null`). Do **not** add it to `GET .../materials` (the feed). Leave
`Publications.defaultPopulate` as-is so relationship/list payloads stay light.

**Rationale**: FR-008 / Out of Scope (feed truncation unchanged). The field is already stored by
the worker; this is display only. `findByID` / a targeted `find` returns the field even when it
is omitted from `defaultPopulate`.

**Rejected**: Live-fetching publisher HTML or PDFs at read time — spec Out of Scope, cost and
fragility.

---

## R5 — HTTP 404 → `notFound()`; 5xx/network → `error.tsx` with retry

**Decision**:

- Nested `not-found.tsx` under `publications/[publicationId]` for unknown/unpublished (FR-030):
  distinct copy + back-to-feed. Call `notFound()` when the detail GET returns 404.
- Nested `error.tsx` for thrown load failures (FR-031): inline error + retry, header/locale
  switcher remain (they live in the locale layout). Throw when the GET is 5xx or network-fails.
- Successful GET: render in the RSC with `cache: 'no-store'`; no spinner (FR-032). Same pattern
  as `projects/[slug]/page.tsx` (`if (res.status === 404) notFound/null; if (!res.ok) throw`).

**Rationale**: Clarify session Q4. The current detail page treats every `!res.ok` as inline
“Not found”, which would fail SC-012. Nested files keep project-feed `error.tsx` copy from
colliding with detail copy.

**Rejected**: One message for 404 and 5xx (clarify Option B).

---

## R6 — Original link: `target="_blank"` with accessible name only

**Decision**: Detail original-publication `Anchor` uses `target="_blank"` and
`rel="noopener noreferrer"`. Accessible name includes the new-tab meaning (e.g. `aria-label`
built from `originalLink` + a visually unused `opensInNewTab` string). No visible companion text
on the feed or beside the title (FR-027). Place the link in the title/source header, before the
summary (spec assumption).

**Rationale**: Clarify Q2 Option B. Assistive tech still learns the new tab; sighted readers are
not shown the feed’s “(opens in a new tab)” chrome.

**Rejected**: Visible note on the original link (clarify Option C). Same-tab (Option A).

---

## R7 — One mapping module; reuse badges and importance collapse

**Decision**: Add `MaterialDetail` + `toMaterialDetail()` in `apps/web/src/lib/materials.ts`
next to `toMaterial()`. Reuse `resolveSource`, `collapseImportance`, `placeholderTitle`, and
`SourceBadge`. Detail UI is a server-friendly view (`MaterialDetailView`) that takes the mapped
object. High-importance chrome copies the feed card’s header treatment (left accent, faint tint,
muted label) on the header region only, not the whole page (FR-029).

**Rationale**: Principle V — one presentation taxonomy. Feed card and detail header cannot drift
on source labels or importance collapse.

**Rejected**: A second source enum for “raw” `pubmed | clinicaltrials | rss` on the page — spec
says feed classification (FR-007).

---

## R8 — Abstract language: canonical stored text, feed-style fallback note

**Decision**: Do not translate `abstractOrBody` in this feature. Treat stored abstract as English
(canonical, matching write-time). If the requested locale is not `en` and abstract text is
present, set an abstract-level fallback note (same wording as the feed’s “shown in English”).
Structured summary uses existing `content-translations.fields` with the same completeness rule as
`resolveLocalizedContent` / `shouldUseCachedTranslation`. Drop the detail page’s
“Open machine translation” link so summary fallback matches the feed (note, not a third-party
translator URL).

**Rationale**: Spec Out of Scope and FR-019/FR-020. The machine-translation link is 001-era
chrome the feed never adopted; keeping it on detail only would be two fallback UX languages.

**Rejected**: A new worker translation of abstracts (cost, Principle III, out of scope).

---

## R9 — Missing summary is 200; omit empty sections in the view model

**Decision**: Detail GET returns 200 without a summary (FR-012). `summary` in JSON is an object
that includes only non-empty sections among `objective`, `methods`, `results`, `limitations`,
`whyItMatters` (may be `{}`). UI renders no heading for absent keys (FR-011). Missing abstract →
`abstractOrBody: null`; UI omits the block (FR-009). Stop 404-on-missing-summary from the old
route.

**Rationale**: Spec edge cases. Old route’s `if (!englishSummary) 404` would hide title, source,
and abstract.

---

## R10 — No schema, worker, or translation-pipeline changes

**Decision**: Zero Payload field additions. Worker already writes `abstractOrBody`. No backfill
script.

**Rationale**: The data is there. 002 already added `feedPublishedAt` / `monitoredSource` needed
for badge + gate.

---

## R11 — Tests: remap feed E2E; add a detail spec; extend Jest mapping tests

**Decision**:

- Update `tests/e2e/public-feed.spec.ts`: titles are in-app links containing `/publications/`;
  zero `article a[target="_blank"]` on the feed; zero visible “opens in a new tab”.
- Add `tests/e2e/public-material-detail.spec.ts`: order (source/summary before abstract), original
  link `target=_blank`, unpublished/unknown not-found copy ≠ load-error copy.
- Extend `materials.test.ts` for `toMaterialDetail` (empty sections dropped, null abstract,
  importance collapse, unpublished not represented at the mapper — eligibility stays in the
  route).

**Rationale**: Constitution IX; 002 E2E currently **asserts the opposite** of FR-001 (no
`/publications/` links, external new-tab). Those assertions must flip in the same PR.

---

## R12 — Keep the `/publications/` page path

**Decision**: Do not rename the App Router segment to `materials`. Reader-facing copy uses
“material”; the URL keeps `publications` as the existing public address (spec page-identity
assumption). Message namespace may stay `Publication` (not shown to readers).

**Rationale**: Renaming the path is a new public URL and is not required to meet FR-021 (chrome
and link label, not the path). Bookmarks to the current path keep working.

**Rejected**: `/{locale}/projects/{slug}/materials/{id}` — cleaner glossary, extra redirects and
E2E churn for no spec requirement.

---

## R13 — Back-to-feed does not restore filter query

**Decision**: `TextLink` href is `/projects/{slug}` with no `q` / `sources` / `important`.
Browser Back still restores filters when the reader came from the feed.

**Rationale**: Spec assumption: desirable, not required. Passing searchParams through a server
page into the back link is extra surface; skip it (Principle II).

---

## R14 — List contract `url` stays; the card ignores it

**Decision**: `GET .../materials` may keep returning `url`. The card must not use it. No
requirement to remove the field in this feature.

**Rationale**: Avoid an unrelated breaking change to the 002 list contract. FR-017 is about the
primary action, not about JSON leftovers.
