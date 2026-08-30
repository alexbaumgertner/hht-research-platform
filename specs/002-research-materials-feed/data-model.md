# Data Model: Research Materials Feed

**Branch**: `002-research-materials-feed` | **Date**: 2026-08-30
**Source**: `spec.md` Key Entities + Functional Requirements, `research.md` decisions

This feature adds four fields across three existing Payload collections. It creates no new
collections. Domain stays topic-agnostic — nothing below is HHT-specific.

---

## Schema changes to existing collections

### `monitored-sources` (add one field)

| Field             | Type                                      | Rules                                                                                                                                                                              |
| ----------------- | ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `displayCategory` | select: `news` \| `guideline` \| `social` | Optional. Admin UI shows it only when `type === 'rss'` (journal/trial sources don't need it — their badge is implicit). Unset behaves identically to `news` at read time (FR-015). |

### `publications` (add two fields)

| Field             | Type                                      | Rules                                                                                                                                                                                                                                                                                                                                                |
| ----------------- | ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `monitoredSource` | relationship → `monitored-sources`        | Optional. Set by the worker at creation time from the source that produced the candidate. Legacy rows and non-`rss` rows may leave this empty — resolution logic treats empty the same as "unset category" (defaults to `news` only when `sourceType === 'rss'`; irrelevant for `pubmed`/`clinicaltrials`, whose badge never depends on this field). |
| `feedPublishedAt` | date, system-managed (not owner-editable) | Set by the `Digests` collection's `afterChange` hook (extending the hook that already exists for `hasPublishedDigest`) to the digest's `publishedAt` value, for every publication in that digest. Presence of this field **is** the public-visibility gate (FR-002, FR-003). Never set directly by the worker or the owner.                          |

`publishedOrUpdatedAt` (already existed) becomes the feed's sort/display date (R4) — no schema
change, only a new consumer.

### `content-translations` (add one field)

| Field   | Type | Rules                                                                                                                                                                                                                                                                                               |
| ------- | ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `title` | text | Optional, sibling to the existing `fields` group. Populated by the worker's translation step alongside the existing summary sections, in the same AI Gateway call (R5). Absence means "no cached title translation for this locale" — read-time fallback resolves it (see Localised Content below). |

No other collection changes. `research-projects`, `monitoring-runs`, `users` are untouched.

---

## View-model entities (not stored — computed at read time by the materials endpoint)

These are the entities named in the spec's Key Entities section. None of them is a new Payload
collection; each is derived from the schema above.

### Material

The reader-facing shape returned by `GET /api/public/projects/:slug/materials`. See
[`contracts/materials-api.md`](./contracts/materials-api.md) for the exact JSON shape.

| Field              | Derived from                                                                                      | Notes                                                                  |
| ------------------ | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `id`               | `publications.id`                                                                                 |                                                                        |
| `source`           | `sourceType` + `monitoredSource.displayCategory`                                                  | Resolution table in `research.md` R3                                   |
| `importance`       | `publications.importance`                                                                         | `critical`/`high` → `high`; `medium`/`low`/`null` → `normal`           |
| `date`             | `publishedOrUpdatedAt`                                                                            | `null` if missing — sorts last, no date rendered (R4)                  |
| `url`              | `originalUrl` (sanitized via existing `sanitizeHttpUrl`)                                          | `null`/malformed → title renders as plain text, not a link (edge case) |
| `title`, `summary` | `publications.title`/`summary` (English) or `content-translations.title`/`fields` (target locale) | See Localised Content fallback below                                   |
| `displayedLocale`  | resolution outcome                                                                                | Locale actually shown; drives the fallback note (FR-038)               |
| `isFallback`       | resolution outcome                                                                                | `true` when `displayedLocale !== requested locale`                     |

A Material only exists in the response set when `feedPublishedAt` is present (i.e., it is
eligible — see Publishing Eligibility below). Ineligible publications are invisible to this
endpoint entirely, not filtered client-side.

### Source Category

Fixed, ordered set: `pubmed`, `trials`, `news`, `guideline`, `social`. Each has:

- a stable icon (from `@tabler/icons-react`, see `research.md` R10)
- a text label, translated per locale
- a color, chosen to be distinguishable from the other four under both color schemes

Not stored — it's a presentation-layer classification resolved from `sourceType` +
`monitoredSource.displayCategory` per the table in `research.md` R3. A `sourceType` outside the
three known values (defensive — schema constrains this today) resolves to a sixth, neutral
fallback badge (FR-018), which is not one of the five selectable filter chips but remains visible
under "all categories."

### Importance Level

Two values: `normal` | `high`. Derived by collapsing the platform's four internal levels:

| Internal (`publications.importance`) | Display  |
| ------------------------------------ | -------- |
| `critical`, `high`                   | `high`   |
| `medium`, `low`, `null`/unset        | `normal` |

The internal four-level scale is unchanged; this mapping exists only in the materials endpoint's
response construction.

### Localised Content (title + summary resolution)

Generalizes the fallback logic already implemented for summaries in
`/api/public/publications/[id]/route.ts` to also cover title, per locale requested:

1. `locale === 'en'` → use `publications.title` / `publications.summary` directly. Always
   available (English is canonical at write time). `isFallback: false`.
2. `locale !== 'en'` → look up `content-translations` for `(publication, locale)`.
   - Both `title` and every summary section present → use them. `isFallback: false`,
     `displayedLocale: locale`.
   - Missing or partial → fall back to English title/summary. `isFallback: true`,
     `displayedLocale: 'en'`.
3. The spec's third tier ("any locale that has content" when even English is missing) is
   unreachable today because English is always populated at write time — documented, not branched
   in code, per R5.

A material whose resolved title is empty in every available locale (defensive — `title` is a
required field on `publications`, so this should not occur in practice) renders a neutral
placeholder built from `source` + `date` instead of an empty string (FR-039), and is still counted
and still linked.

### Configured Source

Not a new entity — this is `monitored-sources` with its new `displayCategory` field, described
above. Referenced here only because the spec's Key Entities section names it explicitly.

### Feed View State

Client-only, never persisted: `{ query: string; sources: SourceCategory[]; highImportanceOnly: boolean }`.
Lives in the URL query string (`?q=&sources=&important=`) per `research.md` R7, not in a database
or session store.

---

## Publishing eligibility (the gate)

```text
publication is visible in the feed
  ⟺ publication.feedPublishedAt is set
  ⟺ publication was included in the `publications` array of a `digests` document
       at the time that digest was created (Digests.afterChange hook stamps it)
```

This is unaffected by `relevance` or `importance` directly — those already gate whether a
publication _could_ end up in a digest in the first place (existing pipeline behavior, unchanged
by this feature). `feedPublishedAt` is the single, sufficient condition the materials endpoint
checks.

**Migration**: publications created before this feature has no `feedPublishedAt`. A one-time
backfill script sets it for every publication already present in an existing digest's
`publications` array, using that digest's `publishedAt`. See `quickstart.md`. Without this step,
the feed would show zero materials for every already-published project immediately after deploy.

---

## Entity relationship summary

```text
ResearchProject 1──* MonitoredSource (+ displayCategory)
ResearchProject 1──* Publication (+ monitoredSource, + feedPublishedAt)
ResearchProject 1──* Digest ──* Publication            (existing hasMany relationship)
Publication 1──* ContentTranslation (+ title)
MonitoredSource 1──* Publication   (new: via `monitoredSource`)
```

No cardinality on existing relationships changes. All four new fields are additive and optional
(or system-managed), so this migration requires no destructive change and no downtime.
