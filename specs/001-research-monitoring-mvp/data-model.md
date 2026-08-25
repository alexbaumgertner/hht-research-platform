# Data Model: Research Monitoring MVP

**Branch**: `001-research-monitoring-mvp` | **Date**: 2026-08-26  
**Source**: `spec.md` Key Entities + Functional Requirements

Domain remains **topic-agnostic**. HHT is the first deployed project instance, not a schema constraint.

Storage: **Postgres (Neon)** via Payload CMS collections (`@payloadcms/db-postgres`). Field names below are logical; Payload field config maps 1:1 unless noted.

---

## Entities

### ResearchProject

Named research topic area owned by a single admin user for MVP.

| Field | Type | Rules |
| --- | --- | --- |
| `id` | UUID / Payload id | System |
| `slug` | string | Unique; used in public URL `/[locale]/projects/[slug]` |
| `name` | string | Required |
| `description` | rich text / textarea | Optional but recommended |
| `keywords` | string[] | **Required, min 1** to activate monitoring (FR-001) |
| `schedule` | enum: `daily` \| `weekly` \| `monthly` | Required when monitoring active |
| `monitoringStatus` | enum: `active` \| `paused` | Default `active` after first activation; pause freezes watermark (FR-022) |
| `lastSuccessfulRunAt` | datetime \| null | Watermark for “what’s new”; null → first run uses bootstrap lookback |
| `bootstrapLookbackDays` | number | Default **30**; used only when `lastSuccessfulRunAt` is null |
| `emailNotificationEnabled` | boolean | Default `false` (FR-015) |
| `owner` | relationship → User | Payload admin user; email for notifications |
| `hasPublishedDigest` | boolean (derived or denormalized) | Public home/list includes project only when ≥1 published digest (FR-021) |
| `createdAt` / `updatedAt` | datetime | System |

**Relationships**: has many `MonitoredSource`, `MonitoringRun`, `Digest`, `Publication`.

**Validation**:
- Cannot set `monitoringStatus=active` with empty `keywords`.
- Pause does not delete digests or sources; does not advance `lastSuccessfulRunAt`.

---

### MonitoredSource

Configured input attached to one project.

| Field | Type | Rules |
| --- | --- | --- |
| `id` | id | System |
| `project` | relationship → ResearchProject | Required |
| `type` | enum: `pubmed` \| `clinicaltrials` \| `rss` | Only these three (FR-002) |
| `label` | string | Optional display name |
| `rssUrl` | string \| null | Required iff `type=rss`; validated as reachable feed when possible |
| `enabled` | boolean | Default `true`; disabled sources skipped in runs |
| `createdAt` / `updatedAt` | datetime | System |

**Validation**:
- RSS URL rejected at save or marked failed at run if non-feed content.
- PubMed / ClinicalTrials need no extra credentials for public APIs.

---

### MonitoringRun

One execution of the fetch → dedupe → classify → summarize → publish pipeline for a project.

| Field | Type | Rules |
| --- | --- | --- |
| `id` | id | System |
| `project` | relationship → ResearchProject | Required |
| `status` | enum: `running` \| `completed` \| `completed_partial_failure` \| `failed` | |
| `triggeredBy` | enum: `schedule` \| `manual` | Manual optional for owner/test |
| `startedAt` | datetime | Required |
| `finishedAt` | datetime \| null | Set on terminal states |
| `sourceResults` | array of objects | Per-source: `{ sourceId, status: success\|failure, error?, fetchedCount, acceptedCount }` |
| `digest` | relationship → Digest \| null | Set when a non-empty digest was published |
| `stats` | object | e.g. `{ candidates, deduped, irrelevant, summarized, published }` |
| `errorSummary` | string \| null | Top-level failure message when `failed` |

**State transitions**:

```text
(none) → running → completed
                 → completed_partial_failure  // ≥1 source failed; others processed; watermark advances (FR-020)
                 → failed                     // no usable completion; watermark does NOT advance
```

**Rules**:
- Empty qualifying set → no Digest; may still be `completed` / `completed_partial_failure`.
- On `completed` or `completed_partial_failure`, set project `lastSuccessfulRunAt = finishedAt` (FR-020).
- While project `monitoringStatus=paused`, scheduler MUST NOT start runs.

---

### Publication

Distinct research item known to a project (after dedupe).

| Field | Type | Rules |
| --- | --- | --- |
| `id` | id | System |
| `project` | relationship → ResearchProject | Required |
| `externalIds` | object | `{ pmid?, doi?, nctId?, guid? }` — at least one preferred |
| `dedupeKey` | string | Stable unique per project (see rules below) |
| `title` | string | Required |
| `abstractOrBody` | text \| null | May be empty; summarization notes limited text |
| `sourceType` | enum: `pubmed` \| `clinicaltrials` \| `rss` | Origin of first accept |
| `originalUrl` | string | Link to original source (FR-013) |
| `publishedOrUpdatedAt` | datetime \| null | From source |
| `relevance` | enum: `pending` \| `relevant` \| `irrelevant` | Binary gate (FR-007) |
| `importance` | enum: `critical` \| `high` \| `medium` \| `low` \| null | Only when relevant (FR-008) |
| `summary` | object \| null | `{ objective, methods, results, limitations, whyItMatters }` English canonical |
| `firstSeenRun` | relationship → MonitoringRun | Run that first accepted it |
| `createdAt` / `updatedAt` | datetime | System |

**Dedupe key** (FR-006 / assumptions):
1. DOI (normalized) if present  
2. else PMID / NCT ID / RSS GUID  
3. else `normalize(title) + sourceType` (or project-scoped title hash)

Unique constraint: `(project, dedupeKey)`.

---

### Digest

Published bundle of qualifying publications from one monitoring run.

| Field | Type | Rules |
| --- | --- | --- |
| `id` | id | System |
| `project` | relationship → ResearchProject | Required |
| `run` | relationship → MonitoringRun | Required, 1:1 for published digests |
| `publishedAt` | datetime | Chronological feed order |
| `publications` | relationship[] → Publication | Non-empty (FR-010: never publish empty) |
| `createdAt` / `updatedAt` | datetime | System |

**Rules**:
- Exactly one Digest per run when ≥1 qualifying publication (FR-009).
- Public project list requires ≥1 Digest for the project (FR-021).

---

### ContentTranslation

Cached non-English rendering of canonical English AI content.

| Field | Type | Rules |
| --- | --- | --- |
| `id` | id | System |
| `publication` | relationship → Publication | Required (MVP: translate publication summaries) |
| `locale` | enum: `de` \| `tr` \| `ru` \| `uk` | Not `en` (canonical is English) |
| `fields` | object | Mirrored summary sections in target locale |
| `createdAt` / `updatedAt` | datetime | System |

Unique constraint: `(publication, locale)`. Created on first request; reused thereafter (FR-017).

---

### User (Payload)

Existing Payload auth collection; MVP owner is an admin user.

| Field | Usage |
| --- | --- |
| `email` | Login + digest notification recipient |
| `password` | Admin auth |
| `roles` | Include admin/owner capability for write ops |

No public end-user registration (FR-014).

---

## Keyword query semantics

Project `keywords` are combined with **OR** when querying sources (FR-001). Classification remains the noise filter after fetch.

---

## Public visibility rules

| Surface | Rule |
| --- | --- |
| Home / project list | Projects with ≥1 published Digest only |
| Project feed URL | Readable without auth; empty state allowed if slug known |
| Importance filter | Client/server filter on publication `importance` |
| Write / pause / sources / schedule | Admin auth only |

---

## Monitoring pipeline (logical)

```text
due projects (active, schedule due)
  → for each enabled source: fetch candidates since watermark (or bootstrap)
  → batch ≤50 / source
  → dedupe against Publication.dedupeKey
  → classify relevance
  → if relevant: summarize + importance
  → if any qualifying: create Digest, optionally email owner
  → set run status; advance lastSuccessfulRunAt if completed[*]
```
