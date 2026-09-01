# Data Model: Publication Detail Page

**Branch**: `003-publication-detail-page` | **Date**: 2026-09-01
**Source**: `spec.md` Key Entities + Functional Requirements, `research.md` decisions

This feature creates **no new Payload collections and no new fields**. It adds a read-time view
model on top of schema delivered by `002-research-materials-feed` and `001-research-monitoring-mvp`.
Domain stays topic-agnostic.

---

## Stored collections (unchanged)

### `publications` (read; no schema edit)

| Field                  | Role on the detail page                                                                      |
| ---------------------- | -------------------------------------------------------------------------------------------- |
| `id`                   | Detail identity; URL segment `{publicationId}`                                               |
| `project`              | Must resolve to the URL `{slug}` or the GET is 404 (research.md R3)                          |
| `feedPublishedAt`      | Public-visibility gate — must be set (same as the feed)                                      |
| `title`                | Canonical English title                                                                      |
| `abstractOrBody`       | Optional original source text; `null`/empty → omit block (FR-009)                            |
| `sourceType`           | Ingestion type; combined with `monitoredSource.displayCategory` → feed source badge (FR-007) |
| `monitoredSource`      | Optional; RSS display category for badge resolution                                          |
| `importance`           | Four internal levels; collapsed to `high` \| `normal` like the feed (FR-029)                 |
| `publishedOrUpdatedAt` | Display date; missing → omit (FR-028)                                                        |
| `originalUrl`          | Original-publication link; sanitize; missing/malformed → no link (FR-016)                    |
| `summary`              | Canonical English structured summary; individual empty sections omitted (FR-011)             |

`defaultPopulate` continues to omit `abstractOrBody` so list/relationship payloads stay small.
The detail GET loads the document (or an explicit select) including `abstractOrBody`.

### `content-translations` (read; no schema edit)

Used only for structured summary (+ title) in non-English locales, same completeness rule as the
feed (`title` + all five summary fields present → use translation; otherwise English +
`isFallback`). **Not** used for `abstractOrBody` (research.md R8).

### `research-projects`, `monitored-sources`, `digests`

Unchanged. Project slug is the scoping key for the detail GET. `monitored-sources.displayCategory`
is already the RSS badge input.

---

## View-model entities (not stored)

Computed by `toMaterialDetail()` / the detail GET. See
[`contracts/material-detail-api.md`](./contracts/material-detail-api.md) for JSON.

### Material Detail

Reader-facing shape for one published material. Exists in the response only when eligible
(Publishing eligibility below).

| Field                | Derived from                                             | Notes                                                                  |
| -------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------- |
| `id`                 | `publications.id`                                        |                                                                        |
| `source`             | `sourceType` + `monitoredSource.displayCategory`         | Same table as feed (`research.md` R3 in 002); unrecognised → `unknown` |
| `importance`         | `publications.importance`                                | `critical`/`high` → `high`; else `normal`                              |
| `date`               | `publishedOrUpdatedAt`                                   | `null` if missing                                                      |
| `originalUrl`        | `originalUrl` via `sanitizeHttpUrl`                      | `null` if missing/malformed                                            |
| `title`              | localised title or placeholder                           | Same placeholder as feed (source + date) when empty                    |
| `summary`            | localised or English sections                            | Object of **only non-empty** keys among the five section ids           |
| `abstractOrBody`     | `publications.abstractOrBody`                            | Trimmed; empty → `null`. Not translated.                               |
| `displayedLocale`    | summary/title resolution                                 | Locale actually used for title + summary                               |
| `isFallback`         | summary/title resolution                                 | `true` when title/summary are not in the requested locale              |
| `abstractIsFallback` | requested locale ≠ `en` and `abstractOrBody` is non-null | Drives the abstract language note (FR-020)                             |

### Source Category

Identical to the feed: `pubmed` \| `trials` \| `news` \| `guideline` \| `social`, plus defensive
`unknown`. Same icon, label, and colour via `SourceBadge`.

### Importance Level

Identical collapse as the feed (`normal` \| `high`). Header treatment (accent, tint, muted label)
applies only when `high`, and only on the header region.

### Structured Summary

Five optional strings: `objective`, `methods`, `results`, `limitations`, `whyItMatters`. A key is
absent when blank. An empty object means “no summary”, not “not found”.

### Abstract or Body

Optional string. Original collected text. Language is canonical English for note purposes; no
separate stored language field.

### Original Publication Link

Not an entity in storage — the sanitized `originalUrl` plus UI rules (`target="_blank"`, no
visible “opens in a new tab”, accessible name still announces new tab).

---

## Publishing eligibility (the gate)

Same predicate as the materials list:

```text
material is visible on the public detail page
  ⟺ publication.feedPublishedAt is set
  ⟺ publication.project.slug === URL slug
```

Ineligible, unknown, and slug-mismatched requests are the same 404. Eligibility is enforced in
the GET handler, never by hiding fields on a 200.

---

## Localised content

1. **Title + structured summary** — reuse the feed’s resolution (English canonical; non-English
   uses a complete cached translation or falls back to English with `isFallback`).
2. **Abstract or body** — always the stored string. If the requested locale is not `en` and the
   string is present, `abstractIsFallback: true`.
3. Third-tier “any locale” fallback from the feed spec remains unreachable because English is
   populated at write time.

---

## Entity relationship summary

```text
ResearchProject 1──* Publication
Publication 1──* ContentTranslation
MonitoredSource 1──* Publication
```

No cardinality change. No migration. No backfill.

---

## Feed list vs detail

| Concern      | List (`GET .../materials`)    | Detail (`GET .../materials/:id`)   |
| ------------ | ----------------------------- | ---------------------------------- |
| Eligibility  | `feedPublishedAt` + project   | Same + id + slug match             |
| Summary      | Truncated preview (objective) | Full sections, empty keys omitted  |
| Abstract     | Not returned                  | `abstractOrBody`                   |
| Original URL | `url` (unused by the card)    | `originalUrl` for the labeled link |
| Title action | In-app detail path            | N/A (already on the page)          |
