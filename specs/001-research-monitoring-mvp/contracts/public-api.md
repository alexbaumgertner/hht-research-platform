# Public HTTP & UI Contracts

**Feature**: `001-research-monitoring-mvp`  
**Consumers**: Anonymous visitors (public), Playwright E2E

Locale segment: one of `en` | `de` | `tr` | `ru` | `uk` (next-intl).

---

## Pages (UI contract)

| Route                                                    | Auth   | Behavior                                                                        |
| -------------------------------------------------------- | ------ | ------------------------------------------------------------------------------- |
| `/{locale}`                                              | Public | Home: list of projects that have ≥1 published digest; link to each project feed |
| `/{locale}/projects/{slug}`                              | Public | Chronological digest feed; importance filter control; empty state if no digests |
| `/{locale}/projects/{slug}/publications/{publicationId}` | Public | Full AI summary sections + original source link                                 |
| `/admin` (Payload)                                       | Owner  | CRUD projects, sources, schedule, pause/resume, email notification toggle       |

Unsupported locales are not offered in the language switcher.

---

## Public REST (read)

Base: `/api` (Payload REST) or thin App Router handlers that wrap Payload Local API. Responses are JSON.

### `GET /api/public/projects`

List projects with at least one published digest.

**Query**: none required  
**Response 200**:

```json
{
  "docs": [
    {
      "id": "string",
      "slug": "string",
      "name": "string",
      "description": "string | null",
      "latestDigestPublishedAt": "ISO-8601"
    }
  ]
}
```

### `GET /api/public/projects/:slug`

Project metadata for public page.

**Response 200**: project public fields  
**Response 404**: unknown slug

### `GET /api/public/projects/:slug/digests`

**Query**:

- `importance` (optional): `critical` | `high` | `medium` | `low` — when set, only digests that contain ≥1 publication at that level are returned **or** publications within digests are filtered to that level (implementation MUST match FR-012: filtered view shows only that importance; prefer filtering publications in the feed payload).

**Response 200**:

```json
{
  "docs": [
    {
      "id": "string",
      "publishedAt": "ISO-8601",
      "publications": [
        {
          "id": "string",
          "title": "string",
          "importance": "critical | high | medium | low",
          "originalUrl": "string",
          "summaryPreview": "string | null"
        }
      ]
    }
  ]
}
```

### `GET /api/public/publications/:id`

**Query**:

- `locale` (optional): `en` | `de` | `tr` | `ru` | `uk` — default `en`. Non-`en` returns cached translation or generates+caches then returns (FR-017).

**Response 200**:

```json
{
  "id": "string",
  "title": "string",
  "originalUrl": "string",
  "importance": "critical | high | medium | low",
  "locale": "en | de | tr | ru | uk",
  "summary": {
    "objective": "string",
    "methods": "string",
    "results": "string",
    "limitations": "string",
    "whyItMatters": "string"
  },
  "translationFallbackUrl": "string | null"
}
```

`translationFallbackUrl` may be a machine-translation link when AI translation is unavailable/low quality.

---

## Auth rules

- All `GET /api/public/*` endpoints MUST NOT require authentication.
- Mutations for projects/sources/schedules MUST go through Payload admin auth (cookie/JWT); no public write API in MVP.
