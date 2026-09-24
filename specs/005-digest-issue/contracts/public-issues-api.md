# Contract: Public Issues API

**Feature**: `005-digest-issue` | **Consumers**: issue page, archive page, project page
(latest-issue card), `generateMetadata`, `opengraph-image`, Playwright.

All endpoints are anonymous `GET`s under `apps/web/src/app/api/public/`, following the 002/003
conventions:

- `?locale=` accepts `en|de|tr|ru|uk` (default `en`). Anything else returns `400 { "error": "Invalid locale" }`.
- Unknown project, unknown issue, wrong project, or hidden issue all return `404 { "error": "Not found" }`
  with the same body, so hidden and unpublished issues are indistinguishable from unknown ones.
- Every response sends `Cache-Control: no-store`.
- Only digests with `hiddenFromPublic !== true` are visible. Only publications with
  `feedPublishedAt` are listed as items. Every digest publication has it; the check is
  defensive.

---

## 1. `GET /api/public/projects/:slug/issues`

Archive list, newest first (FR-002). **Never triggers a translation** (research R8).

**Query**: `locale` (optional), `limit` (optional, 1–100, default 100). The project page calls it
with `limit=1` for the latest-issue card.

**200**:

```json
{
  "docs": [
    {
      "id": "12",
      "date": "2026-09-28T04:00:41.000Z",
      "itemCount": 4,
      "excerpt": "Researchers registered a new study …",
      "displayedLocale": "ru",
      "isFallback": false
    }
  ]
}
```

| Field             | Rule                                                                                                                                                                                                   |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `date`            | The digest's `publishedAt` (ISO 8601). The client formats it per locale.                                                                                                                               |
| `itemCount`       | The number of visible items in the issue.                                                                                                                                                              |
| `excerpt`         | The first summary point. It is translated only if a `ready` `issue-translations` row with a matching `sourceRevision` exists; otherwise English. `null` when the digest has no English summary points. |
| `displayedLocale` | The locale of `excerpt`: `locale`, or `en` on fallback.                                                                                                                                                |
| `isFallback`      | `true` when `locale !== 'en'` and `excerpt` is English.                                                                                                                                                |

Sorted by `publishedAt` descending, then by `id` descending.

---

## 2. `GET /api/public/projects/:slug/issues/:id`

The full issue. **This is the only public surface that starts a translation**, with
wait-then-fallback (FR-012, FR-013; research R7, R8). `export const maxDuration = 60`.

**Query**: `locale` (optional).

**200**:

```json
{
  "id": "12",
  "date": "2026-09-28T04:00:41.000Z",
  "project": { "slug": "hht", "name": "…" },
  "summary": {
    "points": [
      { "text": "…", "itemIds": ["301", "305"] },
      { "text": "…", "itemIds": ["302"] },
      { "text": "…", "itemIds": ["303"] }
    ]
  },
  "items": [
    {
      "id": "301",
      "title": "…",
      "source": "pubmed",
      "importance": "high",
      "date": "2026-09-20T00:00:00.000Z",
      "isTrialRegistration": false,
      "sentence": "…"
    },
    {
      "id": "303",
      "title": "…",
      "source": "trials",
      "importance": "normal",
      "date": null,
      "isTrialRegistration": true,
      "sentence": "…"
    }
  ],
  "displayedLocale": "ru",
  "isFallback": false,
  "translation": { "status": "ready" },
  "meta": {
    "title": "… · 28 сентября 2026",
    "description": "…"
  }
}
```

### Field rules

| Field                          | Rule                                                                                                                                                                                                                                                      |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `summary`                      | `null` only when there are no English points (FR-015). Shown in any `issueTextStatus` when points exist, so a failed or pending regeneration keeps the last good text visible. The page then shows the item list with a "summary not available yet" line. |
| `summary.points[].itemIds`     | The English row's `items`, filtered to visible items. The page renders them as `#item-{id}` anchor links (FR-007).                                                                                                                                        |
| `items`                        | Ordered by `compareIssueItems` (raw importance, then newest, then id; FR-008). `title`, `source`, `importance` (display, 2-level), and `date` come from `toMaterial` (002/003), including localized titles from `content-translations`.                   |
| `items[].isTrialRegistration`  | `sourceType === 'clinicaltrials'`.                                                                                                                                                                                                                        |
| `items[].sentence`             | The localized per-item sentence, or English on fallback. `null` if none exists for that item.                                                                                                                                                             |
| `displayedLocale`/`isFallback` | Describe the **issue text** (points and sentences). Item titles follow the existing material fallback rules independently.                                                                                                                                |
| `translation.status`           | `not-needed` (`en`), `ready`, `pending` (wait deadline passed, still running), `failed` (in cooldown), or `unavailable` (no English text to translate).                                                                                                   |
| `meta.title`                   | The localized template `Issue.metaTitle` with `{projectName}` and `{date}` (formatted for `locale`).                                                                                                                                                      |
| `meta.description`             | The first displayed summary point, cut at a word boundary to ≤ 160 characters. If there is no summary, the localized `Issue.metaDescriptionFallback` with `{count}` and `{projectName}`.                                                                  |

### Translation timing (normative)

| Situation at request time                                  | Behaviour                                                                                                        | Response time |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------- |
| `locale = en`                                              | English, `not-needed`.                                                                                           | fast          |
| Row `ready`, revision matches                              | Translated, `ready`.                                                                                             | fast          |
| No row / reclaimable row                                   | Claim (unique insert). Translation starts, registered with `after()`. Waits until done or 8 s.                   | ≤ ~8 s        |
| Row `pending`, lease live (another request is translating) | Polls every 400 ms until `ready`, `failed`, or 8 s.                                                              | ≤ ~8 s        |
| Row `failed`, `retryAfter` in the future                   | English, `failed`. No new attempt.                                                                               | fast          |
| Translation finishes after 8 s                             | This response is English with `pending`. The row becomes `ready` in the background, so the next request is fast. | ≤ ~8 s        |

The 8 s budget is measured from the start of the route handler. The behaviour is identical for
browsers and link-preview crawlers.

**Invariant (tested)**: for any `(issue, locale)` and any number of concurrent requests from any
number of instances, at most one translator invocation runs until that row's text revision
changes or its failure cooldown expires.

---

## 3. Changed endpoints

| Endpoint                                       | Change                                                                                                |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `GET /api/public/projects/:slug`               | **Unchanged**. The latest-issue card uses `GET …/issues?limit=1`.                                     |
| `GET /api/public/projects/:slug/materials`     | **Unchanged** (FR-019). Materials of hidden issues are still listed.                                  |
| `GET /api/public/projects/:slug/materials/:id` | **Unchanged** shape. The page adds the trust notice and metadata.                                     |
| `GET /api/health`                              | Unchanged shape. Staleness is anchor-aware (see [`worker-issue-text.md`](./worker-issue-text.md) §3). |

---

## 4. Environment (web)

| Variable                         | Required           | Purpose                                                                                        |
| -------------------------------- | ------------------ | ---------------------------------------------------------------------------------------------- |
| `AI_GATEWAY_API_KEY`             | Yes (for non-`en`) | Translator. Without it, non-English issue text falls back to English + note.                   |
| `AI_GATEWAY_MODEL`               | No                 | Default `openai/gpt-4o-mini` (same as the worker).                                             |
| `ISSUE_TRANSLATOR`               | No                 | `gateway` (default) or `stub` for tests. `stub` is ignored when `VERCEL_ENV === 'production'`. |
| `ISSUE_TRANSLATOR_STUB_DELAY_MS` | No                 | Stub latency (for example `3000` or `12000`) to exercise the wait and fallback paths.          |
