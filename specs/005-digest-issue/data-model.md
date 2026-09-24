# Data Model: Weekly Digest Issue

**Branch**: `005-digest-issue` | **Date**: 2026-09-24 | **Spec**: [`spec.md`](./spec.md)

All changes are **additive** (research R15): new nullable columns, new array sub-tables, one new
collection, and one new unique index. Nothing is renamed or removed, and no option is added to
an existing select enum. Field names below are Payload field names. Postgres table and column
names are whatever Payload/Drizzle generate from them.

---

## 1. `digests`: extended (the Issue)

An **Issue** is a published digest (R1). The existing fields `project`, `run`, `publishedAt` and
`publications` are unchanged. `publishedAt` is the **issue date**.

### New fields

| Field                  | Type                                                              | Default   | Access (write)           | Notes                                                                                         |
| ---------------------- | ----------------------------------------------------------------- | --------- | ------------------------ | --------------------------------------------------------------------------------------------- |
| `issueSummaryPoints`   | array (`maxRows: 5`)                                              | —         | admin, worker            | English canonical summary. Each row is `{ text, items }`.                                     |
| ↳ `text`               | textarea, required                                                | —         |                          | One plain-language point.                                                                     |
| ↳ `items`              | relationship → `publications`, `hasMany`, required, `maxDepth: 0` | —         |                          | The item(s) this point is based on (FR-007). Must be a subset of the digest's `publications`. |
| `issueItemSentences`   | array                                                             | —         | admin, worker            | One row per item: `{ publication, sentence }`.                                                |
| ↳ `publication`        | relationship → `publications`, required, `maxDepth: 0`            | —         |                          | Must be one of the digest's `publications`.                                                   |
| ↳ `sentence`           | textarea, required                                                | —         |                          | One plain-language sentence (FR-004).                                                         |
| `issueTextStatus`      | select `pending` \| `ready` \| `failed`                           | `pending` | admin, worker            | Admin label for `pending`: "Queued for (re)generation (runs at the next hourly check)".       |
| `issueTextAttempts`    | number, `min: 0`                                                  | `0`       | worker (admin read-only) | Failed generation attempts since the last queueing. The sweep stops at 3.                     |
| `issueTextError`       | text                                                              | —         | worker (admin read-only) | Short last-failure message for the owner. It is also logged at ERROR.                         |
| `issueTextGeneratedAt` | date                                                              | —         | worker (admin read-only) | When the current generated text was written.                                                  |
| `issueTextSource`      | select `generated` \| `edited`                                    | —         | system (hook)            | `edited` after an owner changes the English text by hand.                                     |
| `issueTextRevision`    | number, `min: 0`                                                  | `0`       | system (hook), read-only | Bumped whenever the English text changes. Translations are bound to it.                       |
| `hiddenFromPublic`     | checkbox                                                          | `false`   | admin                    | Hides the issue page, archive entry and OG image only. Materials stay in the feed (R10).      |

Admin placement: an "Issue" tab (or collapsible) on the digest edit view. `hiddenFromPublic`
goes in the sidebar.

### Validation and invariants

- Every `issueSummaryPoints[].items[]` and `issueItemSentences[].publication` must be in the
  digest's `publications` (field `validate`). References to other publications are rejected.
- When `issueTextStatus` is `ready`: 3–5 summary points, and at most one sentence per
  publication. The generator produces exactly one sentence per item. The owner may delete a
  sentence, and the page then shows the item without one.
- Soft limits enforced by the **generator**, not by field validation, so the owner can still
  save an edit that goes slightly over: ≤ 120 words across points and ≤ 35 words per sentence
  (the prompt asks for 30).
- The existing `beforeValidate` "Cannot publish an empty digest" check runs on `create`, or when
  `publications` is present in the incoming data. Partial PATCHes of issue fields must pass.

### Hook behaviour (`digestHooks.ts`)

| Hook           | Condition                                                                                          | Effect                                                                                                                                                                                  |
| -------------- | -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `beforeChange` | `update` and English text (`issueSummaryPoints` / `issueItemSentences`) differs from `originalDoc` | `issueTextRevision = (originalDoc.issueTextRevision ?? 0) + 1`.                                                                                                                         |
| `beforeChange` | same as above **and** the write is an owner write (see below)                                      | `issueTextSource = 'edited'`, `issueTextStatus = 'ready'`, `issueTextAttempts = 0`, `issueTextError = null` — unless the same save sets status to `pending` (explicit regenerate wins). |
| `beforeChange` | `update` and `issueTextStatus` changes to `pending`                                                | `issueTextAttempts = 0`, `issueTextError = null`.                                                                                                                                       |
| `afterChange`  | `update` and revision changed                                                                      | `req.payload.db.deleteMany({ collection: 'issue-translations', where: { digest: { equals: id } }, req })`, sharing `req` (504 lesson).                                                  |
| `afterChange`  | `create`                                                                                           | Unchanged (`hasPublishedDigest`, `stampFeedPublishedAt`).                                                                                                                               |

"Differs" compares a normalized projection: point text plus sorted item ids, and sentence text
by publication id. Re-saving the same text in the admin is not an edit.

**Owner write vs worker write** is decided by who is writing, not by the payload: the admin
form submits every field (including a stored `issueTextSource: 'generated'`), so "the incoming
data has no `issueTextSource`" cannot identify an edit. A **worker write** is a request
carrying the header-only `X-Payload-API-Key` (`req.user` unset) or a `req.user` with the
`worker` role (both are accepted by `isWorkerOrAdmin` in `access/index.ts`). Every other
authenticated write (an admin session) is an **owner write**. The worker always sends
`issueTextSource: 'generated'` itself.

Why an owner edit forces `ready`: the page shows the summary only in `ready`, and the sweep
selects `pending` and `failed` (attempts < 3). Without this, a hand-written summary on a digest
whose generation failed would stay invisible and be overwritten by the next sweep. Known narrow
race: an owner edit saved while a sweep is generating that same digest is overwritten by the
worker's PATCH. The `issueTextStatus` admin description says so; re-apply the edit if it
happens.

### State transitions: `issueTextStatus`

```text
 (unset: pre-feature digest) ─┐
 create (worker) ─────────────┴─► pending ──sweep ok──► ready
                                    │                     │
                                    │ sweep fails         │ owner edits text → stays ready
                                    ▼                     │   (source=edited, revision+1)
                                  failed (attempts<3) ────┘
                                    │  └──sweep retries hourly──► ready | failed
                                    ▼
                                  failed (attempts=3)  ← stops; ERROR logged each time
 owner sets "Queued" from any state ─► pending (attempts=0)
 owner edits English text in any state ─► ready (source=edited, revision+1, attempts=0)
```

Public rendering by state: `ready` → summary and sentences. Any other state → the item list and
titles, with a "summary not available yet" line (FR-015). The page never blanks.

---

## 2. `issue-translations`: new collection

The cached translation of one issue's English text into one locale. It is also the
single-flight lock for that pair (R7).

| Field            | Type                                                      | Notes                                                                                                              |
| ---------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `digest`         | relationship → `digests`, required, index                 |                                                                                                                    |
| `locale`         | select `de` \| `tr` \| `ru` \| `uk`, required             | English is never stored here.                                                                                      |
| `status`         | select `pending` \| `ready` \| `failed`, required         | See transitions below.                                                                                             |
| `sourceRevision` | number, required                                          | The digest's `issueTextRevision` this row was translated from.                                                     |
| `leaseExpiresAt` | date                                                      | Set on claim (`now + 120 s`). A `pending` row past its lease may be reclaimed.                                     |
| `retryAfter`     | date                                                      | Set on failure (`now + 15 min`). Until then, requests serve English without retrying.                              |
| `attempts`       | number, default `1`                                       | A reclaim after a failure inserts the new row with the old row's `attempts + 1`. Used for observability and tests. |
| `error`          | text                                                      | Last failure message (truncated).                                                                                  |
| `summaryPoints`  | array of `{ text }`                                       | Positional: row _i_ translates English point _i_. Item links come from the English row.                            |
| `itemSentences`  | array of `{ publication (rel → publications), sentence }` | Keyed by publication, independent of order.                                                                        |

**Indexes**: `indexes: [{ fields: ['digest', 'locale'], unique: true }]`. This constraint is
the cross-instance single-flight guarantee.

**Access**: `read: isAuthenticated` (the owner can inspect rows in the admin);
`create`/`update`: `denyWrite` over REST; `delete: isAuthenticated`, so the owner can drop a bad
translation by hand. The web server uses the Local API with `overrideAccess: true`. The worker
never touches this collection.

**Admin**: grouped under "Research", `useAsTitle: 'locale'`, columns
`digest, locale, status, sourceRevision, updatedAt`.

### Validation

- A `ready` row has `summaryPoints.length` equal to the English point count at `sourceRevision`,
  and one `itemSentences` row per English sentence. The translator's structured output schema
  enforces this. A mismatch counts as a failure.

### State transitions

```text
 (no row) ──claim: INSERT (unique)──► pending ──translate ok──► ready
                 │ conflict → wait         │ translate error
                 ▼                         ▼
             waiter polls              failed (retryAfter = now+15m)
 pending, lease expired ──reclaim: DELETE by id, INSERT──► pending
 failed, retryAfter passed ──reclaim──► pending (attempts+1)
 ready/any, sourceRevision ≠ digest.issueTextRevision ──reclaim──► pending
 digest English text changes ──afterChange deleteMany──► (no row)
```

A reader serves a row only when `status === 'ready'` **and**
`sourceRevision === digest.issueTextRevision`.

---

## 3. `research-projects`: extended

| Field             | Type                                 | Default | Notes                                                                                       |
| ----------------- | ------------------------------------ | ------- | ------------------------------------------------------------------------------------------- |
| `publishWeekday`  | select `monday` … `sunday`           | —       | Used when `schedule === 'weekly'`. Shown in the admin only then (`admin.condition`).        |
| `publishHourUtc`  | number, `min: 0`, `max: 23`, integer | —       | Used when `schedule` is `weekly` (with a weekday) or `daily`. Hidden for `monthly`.         |
| `audienceContext` | textarea                             | —       | Plain description of the readers, used in generation prompts (R4). Never hardcoded in code. |

**Validation**: `publishWeekday` without `publishHourUtc` (or the reverse) on a weekly project is
rejected in `beforeValidate` ("Set both publish weekday and hour, or neither"). With neither set,
the project keeps the legacy interval cadence.

**Worker access**: unchanged. The header-only worker key may still patch only
`lastSuccessfulRunAt` (`canUpdateResearchProject`). The worker only **reads** the new fields.

---

## 4. Shared types (`packages/shared`)

| Export                                                  | Shape / behaviour                                                                       |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `PublishWeekdaySchema`                                  | `z.enum(['monday', …, 'sunday'])`                                                       |
| `ScheduleAnchor`                                        | `{ publishWeekday?: PublishWeekday \| null; publishHourUtc?: number \| null }`          |
| `latestScheduledSlot(schedule, anchor, now)`            | `Date \| null` (research R5). `null` → legacy interval.                                 |
| `ScheduleDueInput`                                      | Existing fields plus optional `anchor?: ScheduleAnchor`. Backward compatible.           |
| `isProjectDue`, `isProjectStale`                        | Anchor-aware when `latestScheduledSlot` is non-null. Otherwise behave exactly as today. |
| `IMPORTANCE_RANK`, `compareIssueItems(a, b)`            | Raw importance rank desc → `publishedOrUpdatedAt` desc (nulls last) → id asc (R14).     |
| `IssueTextStatusSchema`, `IssueTranslationStatusSchema` | `z.enum(['pending', 'ready', 'failed'])`                                                |

---

## 5. Read models (web, not persisted)

These are defined in [`contracts/public-issues-api.md`](./contracts/public-issues-api.md) and
mapped in `apps/web/src/lib/issues.ts`:

- **IssueSummaryListItem**: `id`, `date`, `itemCount`, `excerpt` (first point, localized when a
  cached translation exists), `displayedLocale`, `isFallback`.
- **IssueDetail**: `id`, `date`, `project { slug, name }`, `summary` (`null` or points with
  `itemIds`), `items` (ordered: `Material` fields plus `sentence`, `isTrialRegistration`),
  `displayedLocale`, `isFallback`, `translation.status`, `meta { title, description }`.

Item titles and badges reuse `toMaterial` (002/003). Titles are localized from the existing
`content-translations` when present.

---

## 6. Relationships

```text
research-projects 1 ──< digests (Issue) >── * publications
                           │   ├─ issueSummaryPoints[].items ──> publications (subset)
                           │   └─ issueItemSentences[].publication ──> publications (subset)
                           └──< issue-translations (≤ 1 per locale; unique digest+locale)
```

---

## 7. Rollout data steps (no scripts)

1. Deploy. `ensure-schema` pushes the additive schema; preview branches push into their Neon
   branch.
2. The next hourly worker sweep generates issue text for the two historical digests
   (2026-08-31, 2026-09-22), because their `issueTextStatus` is unset or `pending`.
3. The owner sets `hht`: `schedule: weekly`, `publishWeekday: monday`, `publishHourUtc: 4`, and
   optionally `audienceContext`, in the admin.
4. The first Monday 04:00 UTC run publishes the first weekly issue covering everything since the
   latest existing digest (R5).
