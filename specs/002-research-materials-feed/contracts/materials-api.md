# Public HTTP & UI Contracts: Research Materials Feed

**Feature**: `002-research-materials-feed`
**Consumers**: Anonymous visitors (public), Playwright E2E
**Supersedes**: the `GET /api/public/projects/:slug/digests` contract from
`specs/001-research-monitoring-mvp/contracts/public-api.md` (that route is removed — see
`research.md` R1)

Locale segment: one of `en` | `de` | `tr` | `ru` | `uk` (next-intl), unchanged.

---

## Pages (UI contract)

| Route                                                    | Auth           | Behavior (changed)                                                                                                                                                                                                                                                                           |
| -------------------------------------------------------- | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/{locale}/projects/{slug}`                              | Public         | **Changed.** Flat, single-column, newest-first feed of published materials. Search, multi-select source filter, high-importance switch. Server-rendered — no loading state. On fetch failure, `error.tsx` renders an inline error with retry, page chrome (title, language switcher) intact. |
| `/{locale}/projects/{slug}/publications/{publicationId}` | Public         | **Unchanged** (kept per `research.md` R12 — the feed no longer links to it, but it still exists and still works by direct URL).                                                                                                                                                              |
| `/{locale}` , `/admin`                                   | Public / Owner | Unchanged.                                                                                                                                                                                                                                                                                   |

---

## Public REST (read)

### `GET /api/public/projects/:slug/materials`

**New endpoint** replacing `GET /api/public/projects/:slug/digests` as this page's data source.

**Query**:

- `locale` (optional): `en` | `de` | `tr` | `ru` | `uk` — default `en`. Resolves each material's
  title/summary for that locale, with English fallback (see `data-model.md` Localised Content).

No other query parameters. Search, source filtering, and the high-importance toggle are applied
client-side against this response (`research.md` R6) — the endpoint always returns every eligible
material for the project, sorted newest-first, so the client has a complete set to filter.

**Response 200**:

```json
{
  "docs": [
    {
      "id": "string",
      "source": "pubmed | trials | news | guideline | social",
      "importance": "normal | high",
      "date": "ISO-8601 | null",
      "url": "string | null",
      "title": "string",
      "summary": "string | null",
      "displayedLocale": "en | de | tr | ru | uk",
      "isFallback": "boolean"
    }
  ]
}
```

Ordering: `date` descending; materials with `date: null` sort last (in arbitrary stable order among
themselves). A material with an unrecognised source resolves `source` to a sixth, non-filterable
neutral value the UI renders as a fallback badge (FR-018) — this value is intentionally not
documented as one of the five enum members above, since it is a defensive fallback, not a normal
outcome.

**Response 404**: unknown `slug` (same as the existing project-metadata route).

**Auth**: public, no authentication — consistent with every other `/api/public/*` route.

**Eligibility**: only publications with `feedPublishedAt` set are included (`data-model.md`
Publishing eligibility). This is enforced server-side; the response never contains an ineligible
publication, under any query parameter combination.

---

### `GET /api/public/projects/:slug/digests` — REMOVED

Deleted. No remaining consumer (verified: the only caller was the page this feature replaces;
the worker's digest _creation_ endpoint, `POST /api/digests`, is a distinct, unrelated route and
is untouched).

---

### `GET /api/public/projects/:slug` , `GET /api/public/projects` , `GET /api/public/publications/:id`

Unchanged. Included here only for completeness of the public surface after this feature ships.

---

## Owner-facing (Payload Admin) contract changes

Not public REST, but part of this feature's data-entry surface:

- `monitored-sources` edit screen gains a `displayCategory` select, visible only when
  `type === 'rss'`. Existing PubMed/ClinicalTrials.gov sources are unaffected.
- `publications` and `content-translations` gain read-only/system fields
  (`monitoredSource`, `feedPublishedAt`, `title`) as described in `data-model.md`. None of these
  are owner-editable in the normal flow — `monitoredSource` and `feedPublishedAt` are worker/hook
  managed, `title` (translation) is worker-managed like the existing summary translations.

## Auth rules (unchanged)

- All `GET /api/public/*` endpoints MUST NOT require authentication.
- Mutations remain owner-only through Payload admin auth or the worker's API-key header; this
  feature adds zero public write endpoints (SC-009).
