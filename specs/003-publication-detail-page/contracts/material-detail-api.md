# Public HTTP & UI Contracts: Publication Detail Page

**Feature**: `003-publication-detail-page`
**Consumers**: Anonymous visitors (public), Playwright E2E
**Supersedes**:

- Feed title behaviour in `specs/002-research-materials-feed/contracts/materials-api.md` (title
  was an outbound new-tab link; it is now an in-app detail link)
- `GET /api/public/publications/:id` from `specs/001-research-monitoring-mvp/contracts/public-api.md`
  (route **removed** — see `research.md` R2)

Locale segment: one of `en` | `de` | `tr` | `ru` | `uk` (next-intl), unchanged.

---

## Pages (UI contract)

| Route                                                    | Auth           | Behavior                                                                                                                                                                                                                                                                                                                                  |
| -------------------------------------------------------- | -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/{locale}/projects/{slug}`                              | Public         | **Changed.** Material title is a same-tab link to the detail page. No visible “opens in a new tab”. No `target="_blank"` on feed titles. Listing, filters, badges otherwise unchanged.                                                                                                                                                    |
| `/{locale}/projects/{slug}/publications/{publicationId}` | Public         | **Changed.** On-site material detail: header (title, source badge, date, high-importance treatment, original-publication link), then structured summary (populated sections only), then full abstract or body when present. Back to `/projects/{slug}`. 404 → nested not-found; 5xx → nested error + retry. Content arrives with the RSC. |
| `/{locale}` , `/admin`                                   | Public / Owner | Unchanged.                                                                                                                                                                                                                                                                                                                                |

### Detail page order (FR-025)

1. Back-to-feed control
2. Header: title, source type, date (if any), high-importance treatment (if high), original-publication link (if usable)
3. Structured summary sections that have content
4. Abstract or body (if stored)

The original-publication link and back-to-feed control MUST NOT sit between summary and abstract.

### Original-publication link (FR-014, FR-026, FR-027)

- Visible label: locale string equivalent of “View original source” (must not contain the word
  “publication”).
- `href` = sanitized http(s) URL.
- `target="_blank"` `rel="noopener noreferrer"`.
- Accessible name includes new-tab meaning; no visible “opens in a new tab” companion text.
- Omitted entirely when URL is missing or fails sanitization.

### Not-found vs load-error

| State                               | UI                                        | HTTP (document)    |
| ----------------------------------- | ----------------------------------------- | ------------------ |
| Unknown, unpublished, wrong slug    | Distinct not-found copy + back to feed    | 404 (`notFound()`) |
| Published material, GET 5xx/network | Distinct load-error copy + retry          | Error boundary     |
| Published, missing abstract/summary | Normal 200 page with those blocks omitted | 200                |

---

## Public REST (read)

### `GET /api/public/projects/:slug/materials/:id`

**New endpoint** replacing `GET /api/public/publications/:id`.

**Query**:

- `locale` (optional): `en` | `de` | `tr` | `ru` | `uk` — default `en`.

**Auth**: public, no authentication.

**Eligibility** (all required; else 404):

- Publication id exists
- Its project’s `slug` equals `:slug`
- `feedPublishedAt` is set

**Response 200**:

```json
{
  "id": "string",
  "source": "pubmed | trials | news | guideline | social",
  "importance": "normal | high",
  "date": "ISO-8601 | null",
  "originalUrl": "string | null",
  "title": "string",
  "summary": {
    "objective": "string",
    "methods": "string",
    "results": "string",
    "limitations": "string",
    "whyItMatters": "string"
  },
  "abstractOrBody": "string | null",
  "displayedLocale": "en | de | tr | ru | uk",
  "isFallback": false,
  "abstractIsFallback": false
}
```

`summary` includes **only keys that have non-empty text**; it may be `{}`.
`source` may be the defensive fallback value `unknown` (same as the list endpoint).
`abstractIsFallback` is `true` only when `abstractOrBody` is non-null and `locale !== "en"`.

**Response 400**: invalid `locale`.

**Response 404**:

```json
{ "error": "Not found" }
```

Used for unknown id, slug mismatch, and unpublished. Same body in all three cases.

**Response 5xx**: existing platform error handling; the page throws into `error.tsx`.

---

### `GET /api/public/projects/:slug/materials`

Unchanged except the **UI** no longer treats `docs[].url` as the title target. Field may remain
in the JSON (research.md R14).

---

### `GET /api/public/publications/:id` — REMOVED

Deleted. The only consumer was the detail page this feature rewrites. Leaving it would keep an
unscoped read of unpublished summaries (and, after this feature, abstracts). Worker/admin Payload
REST (`/api/publications`) is a different, authenticated surface and is untouched.

---

## Auth rules (unchanged)

- All `GET /api/public/*` endpoints MUST NOT require authentication.
- This feature adds zero public write endpoints.
