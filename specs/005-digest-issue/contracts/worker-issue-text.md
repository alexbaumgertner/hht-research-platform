# Contract: Worker — Issue Text Sweep and Anchored Schedule

**Feature**: `005-digest-issue` | **Producer**: `apps/worker` (Cloud Run Job, hourly) |
**Consumer**: Payload REST in `apps/web` (`X-Payload-API-Key`).

This extends the 001 monitoring-worker contract. Everything not listed here is unchanged: runs,
sources, publications, watermarks, owner email, and publication `content-translations`.

---

## 1. Job order

```text
main():
  reapStaleRuns()                 # unchanged (004)
  for project in listDueProjects(): runProject(project)   # due-check is anchor-aware (§3)
  sweepIssueText()                # NEW — always runs, even when no project was due
```

`runProject` sends `issueTextStatus: 'pending'` in `createDigest`, so the sweep in the **same**
job execution generates the text for a digest published minutes earlier (FR-014). A sweep
failure never changes the run's status or watermark. The sweep is a separate concern.

---

## 2. `sweepIssueText()`

### 2.1 Select work

```http
GET /api/digests?depth=0&limit=20&sort=publishedAt
  &where[or][0][issueTextStatus][equals]=pending
  &where[or][1][issueTextStatus][exists]=false
  &where[or][2][and][0][issueTextStatus][equals]=failed
  &where[or][2][and][1][issueTextAttempts][less_than]=3
```

The limit is 20 per tick, oldest first, which bounds one execution's LLM spend and runtime. The
backfill of historical digests finishes within a tick or two. Hidden digests are included (R10).

### 2.2 Load inputs for one digest

- The project: `GET /api/research-projects/{id}?depth=0` → `name`, `keywords`, `audienceContext`.
- The items: `GET /api/publications?depth=0&pagination=false&where[id][in]=…` with
  `select[title]`, `select[sourceType]`, `select[publicationTypes]`, `select[importance]`,
  `select[publishedOrUpdatedAt]`, `select[summary]`, `select[abstractOrBody]`.
  `abstractOrBody` is cut to 1,500 characters before prompting.
- Sort the items with `compareIssueItems` (shared) and number them `1..n`.

### 2.3 Generate and validate

Two steps (research R3): sentences in batches of ≤ 20, then 3–5 summary points (`min(3, n)`–5 for an issue with fewer than 3 items) from the numbered
sentences. Then run `validateIssueText()`, which is pure and Jest-tested:

| Check                                                        | On failure                   |
| ------------------------------------------------------------ | ---------------------------- |
| One sentence per item; ≤ 35 words each                       | retry the sentence step once |
| `min(3, n)`–5 points; ≤ 120 words total                      | retry the summary step once  |
| Every point has ≥ 1 valid item number (invalid ones dropped) | retry the summary step once  |
| No dose pattern in any text                                  | retry the failing step once  |
| No outcome claim in a trial-registration sentence            | retry the sentence step once |

### 2.4 Write the result

**Success**:

```http
PATCH /api/digests/{id}?depth=0
{
  "issueSummaryPoints": [ { "text": "…", "items": [301, 305] } ],
  "issueItemSentences": [ { "publication": 301, "sentence": "…" } ],
  "issueTextStatus": "ready",
  "issueTextSource": "generated",
  "issueTextGeneratedAt": "2026-09-28T04:03:12.000Z",
  "issueTextError": null
}
```

Ids are sent back **exactly as REST returned them** (numeric on Postgres; see the `CmsId` note
and incident 2026-09). The web hook bumps `issueTextRevision` and deletes stale translations
(data-model §1).

**Failure** (after the one retry):

```http
PATCH /api/digests/{id}?depth=0
{ "issueTextStatus": "failed", "issueTextAttempts": <prev + 1>, "issueTextError": "<≤ 300 chars>" }
```

It also calls `logError('issue text generation failed', err, { digestId, projectSlug, attempt })`.
That line reaches Cloud Logging at ERROR, which fires the existing alert policy (FR-015).

**Per-digest isolation**: each digest runs in its own `try`. One failure does not stop the sweep.

### 2.5 Required web-side change

`Digests.beforeValidate` must not throw "Cannot publish an empty digest" on an update that omits
`publications`. Otherwise every PATCH in §2.4 gets a 400.

### 2.6 Selection query rejected (deploy window)

If `GET /api/digests` in §2.1 returns **400** ("path cannot be queried"), the web app has not been upgraded yet (the old
schema has no `issueTextStatus`). The sweep logs WARN `sweep skipped: cms rejected query` and
returns without PATCHing anything. It must not log ERROR here: ERROR fires the alert policy,
and this state is expected for a few minutes when the worker deploys before the web app
(research R15). 401/403 (a bad API key), other 4xx, 5xx and network errors stay ERROR
`sweep list failed`.

### 2.7 Owner edits vs sweep

An owner text edit sets the digest to `ready` (data-model §1), so the sweep no longer selects
it. The sweep never touches a `ready` digest unless the owner re-queues it.

---

## 3. Anchored schedule (`packages/shared/src/schedule.ts`)

### 3.1 Input

`listDueProjects` reads two new fields from `GET /api/research-projects?depth=1&…` and passes
them to `isProjectDue`:

```ts
anchor: { publishWeekday: project.publishWeekday ?? null, publishHourUtc: project.publishHourUtc ?? null }
```

### 3.2 Rules (normative)

Let `T = DUE_TOLERANCE_MS` (30 min) and `G = STALE_GRACE_MS` (6 h).

| Schedule  | Anchor present       | `slot = latestScheduledSlot(schedule, anchor, now + T)` |
| --------- | -------------------- | ------------------------------------------------------- |
| `weekly`  | weekday **and** hour | the latest `{weekday} {hour}:00:00Z` ≤ `now + T`        |
| `daily`   | hour                 | the latest `{hour}:00:00Z` ≤ `now + T`                  |
| any other | —                    | `null` → legacy rule (`last + interval − T`)            |

- **Due**: paused → false. `lastSuccessfulRunAt` null or invalid → true. With a slot:
  `lastSuccessfulRunAt < slot − T`. Otherwise: the legacy rule.
- **Stale** (for `/api/health`): paused → false. With a slot: `now > slot + G` **and**
  `lastSuccessfulRunAt < slot − T`. Otherwise: the legacy rule.

All arithmetic is in UTC milliseconds, so there are no DST cases. The single Cloud Scheduler job
stays hourly and unchanged.

### 3.3 Required test cases (Jest, `schedule.test.ts`)

- The research R5 worked-example table, row by row.
- A weekly anchor with a failed 04:00 run → due at 05:00, 06:00, … until a success.
- An anchor set with `schedule: monthly` → legacy rule.
- A weekly project with no anchor → legacy rule (current behaviour preserved).
- Switching `daily → weekly` on a Thursday after a Thursday run → not due until the next Monday slot.
- Stale on Monday 10:01 if there has been no success since the slot; not stale on Monday 09:59.

---

## 4. Observability

| Event                               | Level | Fields                                       |
| ----------------------------------- | ----- | -------------------------------------------- |
| sweep start / count                 | INFO  | `pending`, `failedRetryable`                 |
| issue text generated                | INFO  | `digestId`, `projectSlug`, `points`, `items` |
| validation retry                    | INFO  | `digestId`, `step`, `reason`                 |
| issue text generation failed        | ERROR | `digestId`, `projectSlug`, `attempt`, `err`  |
| sweep list failed (CMS unreachable) | ERROR | `err`                                        |
| sweep skipped: cms rejected query   | WARN  | `status` (400: web not upgraded yet, R15)    |
