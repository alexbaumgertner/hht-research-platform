# Feature Specification: Pipeline Health (gap closure)

**Feature Branch**: `004-pipeline-health`

**Created**: 2026-11-21

**Status**: Draft (owner approval pending)

**Input**: Roadmap 2026 Q4 §6 row 004, incident `docs/incidents/2026-09-pipeline-silent-failure.md`, GitHub issue #23.

## Context: what already shipped

Most of the 004 scope landed in PR #1 (2026-09-22) without a Spec Kit spec. This spec records that
behaviour as requirements (so tests and future changes have something to point at) and covers only
the **gaps still open in `main`** (verified against the code on 2026-11-21).

| Area                                          | State in `main`             | Evidence                                                                                                                 |
| --------------------------------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Run/source/project failures logged at `ERROR` | Shipped                     | `apps/worker/src/log.ts`, `runProject.ts` (`logError('source failed', …)`)                                               |
| Failed source keeps its own watermark         | Shipped                     | per-source `lastSuccessfulFetchAt` (`MonitoredSources.ts`); `cms.patchSourceWatermark` runs only after a source succeeds |
| Stale `running` runs reaped                   | Shipped                     | `apps/worker/src/index.ts` `reapStaleRuns`, `isStaleRun` (2 h)                                                           |
| ERROR log alert + `/api/health` uptime check  | Shipped (manual GCP config) | `docs/deploy-worker.md` § Monitoring & alerts                                                                            |
| Anchored weekly cadence                       | Shipped with spec 005       | `publishWeekday` / `publishHourUtc` on `research-projects`, `packages/shared/src/schedule.ts`                            |
| Batch overflow loses items                    | **Open** (G1)               | `clampBatch` cuts to `BATCH_SIZE_PER_SOURCE`, then the watermark advances to `startedAt`                                 |
| Failure drill evidence                        | **Open** (G2)               | Roadmap Stage 0: "done except the failure drill"                                                                         |
| Uptime check host after domain migration      | **Open, manual** (G3)       | `docs/launch/2026-10-domain-migration.md` §"hht-health"                                                                  |
| "Broken" vs "no news" for readers and owner   | **Open** (G4)               | Roadmap §1.1 reason 4–5; weekly cadence makes quiet weeks normal                                                         |

## Clarifications

### Session 2026-11-21

- Q: Is this a new feature or a retro-spec? → A: Both. Shipped behaviour becomes requirements (FR-001–FR-005, already satisfied, regression-tested); the new work is G1–G4 (FR-006–FR-012). **[OWNER TO CONFIRM]**

## User Scenarios & Testing _(mandatory)_

### User Story 1 - No item is silently lost when a source returns more than one batch (Priority: P1)

The owner expects every new paper and trial that matches the keywords to reach the feed eventually,
even in a week with more new items than `BATCH_SIZE_PER_SOURCE`.

**Why this priority**: Today the first batch is processed and the watermark moves past the rest.
This is the same class of loss as the August incident (permanent, invisible), and it grows with the
bootstrap window and with any busy week. Patients most want new-treatment research; losing exactly
those items is the worst failure for the audience.

**Independent Test**: Run a project against a stub adapter that returns `batchSize + 10` candidates; after enough runs, all of them exist as publications; no run advances the watermark past an unprocessed candidate.

**Acceptance Scenarios**:

1. **Given** a source returns more candidates than the batch size, **When** a run completes, **Then** the watermark does not move past the oldest unprocessed candidate, and the remaining candidates are processed by following runs.
2. **Given** the backlog is cleared, **When** the next run happens, **Then** the watermark advances normally and no duplicates are created (dedupe key unchanged).
3. **Given** a backlog exists, **When** the owner checks the run record, **Then** it shows that items remain (a count), not a plain success.

---

### User Story 2 - The owner is told within hours when the pipeline stops producing (Priority: P1)

If a run fails, a source fails repeatedly, or no run succeeds for longer than expected, the owner
gets an email. This was shipped; the story pins it with a drill so it is known to work.

**Why this priority**: The 22-day silent failure is the reason this spec exists. An unverified alert is not an alert.

**Independent Test**: Execute the failure drill from the runbook (one-off Cloud Run execution with an invalid AI key) and record the alert email timestamp in `docs/incidents/` or the runbook.

**Acceptance Scenarios**:

1. **Given** a one-off execution with an invalid AI key, **When** it finishes, **Then** an `ERROR` log entry exists and the owner receives the alert email within 1 hour.
2. **Given** no successful run for longer than the threshold (see Open Question 2), **When** the uptime check evaluates `/api/health`, **Then** the owner receives an alert.
3. **Given** the drill passed, **When** the next quarter's review reads the runbook, **Then** the date, the observed delay and the person who ran it are recorded.

---

### User Story 3 - A quiet week is distinguishable from a broken pipeline (Priority: P2)

Readers and the owner can tell "the pipeline ran and found nothing" from "the pipeline did not run".

**Why this priority**: With weekly issues (spec 005), an empty week is normal (FR-010 of spec 001 forbids empty digests), so a missing issue looks identical to a failure.

**Independent Test**: With a successful run that yielded zero publications, `/api/health` reports healthy and the project page shows "last checked <date>"; with no run for longer than the threshold, `/api/health` reports unhealthy.

**Acceptance Scenarios**:

1. **Given** the last successful run finished within the threshold and produced no new items, **When** a reader opens the project page, **Then** they see when the sources were last checked.
2. **Given** the last successful run is older than the threshold, **When** `/api/health` is called, **Then** it is unhealthy regardless of whether items were published.

---

### User Story 4 - Monitoring survives infrastructure changes (Priority: P3)

After a domain or project move, the owner has a checklist that proves the alerts still point at the live host.

**Independent Test**: The runbook has a "verify monitoring" section; running it after the 2026-10 domain change shows `hht-health` hits `hht.rarediseasedigest.org/api/health` with a 2xx.

### Edge Cases

- A source succeeds with 0 items: watermark advances (nothing was lost).
- A source fails after processing some items: watermark stays; already-created publications are deduped on retry (existing behaviour, keep).
- Backlog persists for many runs (e.g. keyword widened): per-run cost is bounded by `BATCH_SIZE_PER_SOURCE` × LLM calls; the run record shows the remaining count. See Open Question 1.
- Adapter ordering is not guaranteed (PubMed ESearch sort, ClinicalTrials.gov default order): the cursor logic must not assume order. See plan §Research.

## Requirements _(mandatory)_

### Functional Requirements

**Already satisfied (regression-tested, do not break):**

- **FR-001**: Every source, project, digest and translation failure MUST be written to stdout as a structured `severity: ERROR` entry with project and source ids.
- **FR-002**: A source that fails MUST NOT advance its own watermark; other sources' watermarks advance independently.
- **FR-003**: Runs stuck in `running` for longer than the stale threshold MUST be marked failed by the next job start, with an `ERROR` log.
- **FR-004**: The job MUST exit 0 only when it completed its own work; per-project failures are alerted via logs, not the exit code (documented in `docs/deploy-worker.md`).
- **FR-005**: `/api/health` MUST report the last successful run per active project and MUST NOT query the database more often than the CDN cache allows (PR #18/#19).

**New:**

- **FR-006**: When a source returns more candidates than the batch size, the system MUST process the rest in later runs and MUST NOT advance the source watermark past an unprocessed candidate.
- **FR-007**: A run record MUST expose, per source, the count of candidates left unprocessed.
- **FR-008**: The failure drill (US2) MUST be executed once, and its date and observed alert delay recorded in `docs/deploy-worker.md` or `docs/incidents/`.
- **FR-009**: The stale-run threshold for "no successful run" MUST be defined per project cadence (weekly vs daily), not as a single constant. **[NEEDS CLARIFICATION: see Open Question 2]**
- **FR-010**: The public project payload and page MUST show the time of the last successful source check, separately from the date of the last issue.
- **FR-011**: The runbook MUST contain a "verify monitoring" checklist (alert policy targets, uptime host, notification channel) executed after any host/domain/project change.
- **FR-012**: Any change in this spec MUST NOT increase the number of paid LLM calls per run beyond the existing per-source batch limit.

### Key Entities

- **Monitoring run** (existing): gains per-source `remainingCount`.
- **Monitored source** (existing): `lastSuccessfulFetchAt` semantics change from "start time of last successful run" to "boundary up to which all candidates are processed"; plus a small `cursorState` (boundary key and ids already processed on the boundary day) so progress is guaranteed when several batches share one day. The cursor uses the source's query key (PubMed EDAT, ClinicalTrials.gov last-update date), never the display date.
- **Project** (existing): last successful check time is exposed publicly (read-only).

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A stubbed source with `batchSize + N` candidates results in all candidates processed within `ceil((batchSize + N) / batchSize)` runs, with zero lost (Jest test in `apps/worker`).
- **SC-002**: The failure drill's alert email arrives within 60 minutes of the failed run.
- **SC-003**: Over the 4-week streak (roadmap criterion 1), the owner performs zero manual runs and zero manual watermark edits.
- **SC-004**: A reader can see the last-checked date on the project page without opening an issue.

## Assumptions

- GCP alert policies and uptime checks are configured by hand (no IaC); this spec adds checklists, not Terraform.
- `BATCH_SIZE_PER_SOURCE` stays an env var; its default is not changed here.
- The Resend sender and owner notification email from spec 006 are used for any new owner email; no new channel.

## Open Questions (for the owner)

1. **Backlog policy.** Process one batch per run indefinitely (slow catch-up, bounded cost), or loop within a run up to a cap (e.g. 3 batches)? Default proposed: one batch per run, plus an ERROR-level log when the remaining count > 0 for 3 consecutive runs.
2. **"No successful run" threshold.** The scheduler is hourly but the weekly project only publishes on Monday. Proposed: alert when the last successful _check_ is older than 26 h (checks stay daily even if issues are weekly). Is a daily check acceptable, or should weekly projects be checked weekly only?
3. **Public "last checked" wording.** Show it to patients (trust signal) or only to the owner? Proposed: patients see it in small text on the project page.
4. **Is `hht-health` already repointed** to `hht.rarediseasedigest.org`? The domain migration doc lists it as a manual item; the code cannot tell.
