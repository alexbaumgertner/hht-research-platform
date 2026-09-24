# Implementation Plan: Weekly Digest Issue

**Branch**: `005-digest-issue` | **Date**: 2026-09-24 | **Spec**: [`spec.md`](./spec.md)

**Input**: Feature specification from `/specs/005-digest-issue/spec.md`

## Summary

Make each published digest a public, shareable **issue page** with plain-language, patient-facing
text, and move the project to an anchored weekly cadence. The work is split by service boundary:

- **Worker (`apps/worker`)**: an end-of-job **issue-text sweep** generates the English summary
  (3–5 points, each citing the items it is based on) and one sentence per item. It covers new
  digests, the one-time backfill of historical digests, retries, and owner-requested
  regeneration. Failures go to the existing ERROR-log alert. The due-check becomes
  **anchor-aware** through per-project `publishWeekday` / `publishHourUtc`, keeping the single
  hourly Cloud Scheduler job.
- **Web (`apps/web`)**:
  - New issue and archive pages, plus a latest-issue card on the project page. The flat feed is
    unchanged.
  - **On-request translation** of issue text. It waits up to 8 s inside the route handler,
    continues via `after()`, and is kept to one translation per issue+locale by a **unique
    `(digest, locale)` index** in Postgres.
  - Localized metadata, with `TelegramBot` added to `htmlLimitedBots`.
  - `next/og` share images per issue, with a default project image.
  - A trust notice (disclaimer + AI label) on issue and material pages, and patient-facing
    chrome copy.
- **Schema**: additive only. New fields on `digests` and `research-projects`, and a new
  `issue-translations` collection.
- **Hiding** an issue hides only the issue. Its materials stay in the feed.

## Technical Context

**Language/Version**: TypeScript 5.8 on Node.js ≥ 24 (root `engines`); Next.js 16.3.3 (App Router);
Payload CMS 3.88.0 with `@payloadcms/db-postgres` 3.88.0; next-intl 4.13.

**Primary Dependencies**: Mantine 7.17, next-intl, `ai` 7 + `@ai-sdk/gateway` (already in both
apps; newly **used** in web for translation), `next/og` (bundled with Next), `zod` 3. **No new npm
packages.** New static assets: IBM Plex Sans TTF fonts (OFL) for share images.

**Storage**: Postgres on Neon (Frankfurt), unchanged provider. Additive schema pushed by
`ensure-schema` on the Vercel build; preview builds push into their `preview/<branch>` Neon branch.
Details in [`data-model.md`](./data-model.md).

**Testing**: Jest in `packages/shared` (anchored schedule, issue order), `apps/worker` (issue-text
validation, sweep), and `apps/web` (DTO mapping, translation claim/wait state machine, digest
hooks). Playwright in `apps/web` (issue/archive flows, 360 px without JavaScript, trust notice in
5 locales, share metadata for crawler user agents, **8-way concurrent single-flight** against real
Postgres; CI proves it in one process, the cross-instance check is manual). CI gains a seed step
so the seeded specs run (research R16); that step is the first task, because it also un-skips
existing seeded specs.

**Target Platform**: Vercel Hobby, `fra1` (web: pages, route handlers, `after()`, OG images); GCP
Cloud Run Job + one hourly Cloud Scheduler job (worker, unchanged infra).

**Project Type**: Existing pnpm monorepo web application (`apps/web`, `apps/worker`,
`packages/shared`). No new deployable.

**Performance Goals**:

- An issue page is served immediately when English or cached.
- The first request for an untranslated locale waits ≤ ~8 s, then falls back.
- The OG image is under 300 KB and does not depend on translation.
- The sweep is capped at 20 digests per tick.

**Constraints**:

- Single-flight translation must hold **across instances**, enforced in the database (R7).
- The schedule anchor comes from project data, not code.
- Schema changes are additive only.
- Materials of hidden issues stay public.
- No disease names in `apps/*/src`.
- No new vendors or paid tiers.
- The issue page works without JavaScript at 360 px.

**Scale/Scope**: One live project (`hht`). About 3–10 items per weekly issue, with bootstrap
digests up to ~25. Two historical digests to backfill. Five locales, so at most four translations
per issue, and only for locales someone actually opens.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle                                     | Status | Notes                                                                                                                                                                                                                                                                                                                                                                          |
| --------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| I. Spec-First, Event-Driven                   | PASS   | The spec plus a completed clarify session precede this plan. No code is written in this command. Domain events are unchanged (`DigestPublished` now also queues issue text). No ADR is needed: every choice is additive and reversible (new fields, one collection, one index, a worker sweep), and no Technical Baseline row changes.                                         |
| II. Ruthless Scope Discipline                 | PASS   | Still three source types. No RAG/MCP/multi-model/collaboration. Email (006), rubric (007), trials (008), patient layer (009), tags (010) and landing (011) are explicitly excluded (research R17). Publication-level translations are left as they are.                                                                                                                        |
| III. Free-Tier-First                          | PASS   | Keeps one hourly Scheduler job (R5). Translation is lazy per opened locale (R6). Share images come from `next/og`, with no Blob or uploads (R12). The single-flight lock is Postgres, not a new service (R7). LLM spend is a few `gpt-4o-mini` calls per week.                                                                                                                 |
| IV. Public by Default                         | PASS   | Issue, archive and share images are anonymous `GET`s. No public write endpoint. Owner actions (edit, regenerate, hide) stay in the Payload admin.                                                                                                                                                                                                                              |
| V. Maintainability Over Cleverness            | PASS   | Reuses the `digests` collection as the issue (R1). One generation code path serves publish, backfill, retry and regenerate (R2). One shared comparator orders items for both the prompt and the page (R14). Topic-agnostic: audience and topic wording come from `audienceContext`, `name` and `keywords` (R4); roadmap §4 rules 1–3 hold, and the CI grep rule is unaffected. |
| VI. Internationalization Is First-Class       | PASS   | All new pages and strings ship in 5 locales. English is canonical for generated text. Issue text is translated on first request and cached (FR-012). Static chrome goes through next-intl. The header is no longer hardcoded English (R13).                                                                                                                                    |
| VII. Domain Boundaries Are Service Boundaries | PASS   | Generation is pipeline work in the worker, via Payload REST (R2). The web app only reads and translates on request, as FR-012 requires and 001 FR-017 anticipated. The worker still has no DB access.                                                                                                                                                                          |
| VIII. Portable by Design                      | PASS   | `after()`, `next/og`, and a Postgres unique index work the same under `next start` in Docker. The AI Gateway is used through the existing `ai` SDK, as the worker already does. No new vendor-specific API.                                                                                                                                                                    |
| IX. Automated, Enforced Quality Gates         | PASS   | Jest and Playwright cases are enumerated in [`quickstart.md`](./quickstart.md) §6. CI is **strengthened** (seed before Playwright) and nothing is removed.                                                                                                                                                                                                                     |

**Post–Phase 1 re-check**: [`research.md`](./research.md), [`data-model.md`](./data-model.md), the
three [`contracts/`](./contracts/), and [`quickstart.md`](./quickstart.md) stay within the gates.
Specifically:

- The new collection, `issue-translations`, is justified by the database-enforced single-flight
  requirement.
- The additive fields are listed and none of them renames or removes anything.
- The web app's AI use is limited to translating issue text on request.
- There are no new packages or services.

No unjustified violations; Complexity Tracking is empty.

## Project Structure

### Documentation (this feature)

```text
specs/005-digest-issue/
├── plan.md                          # This file
├── research.md                      # Phase 0: decisions R1–R17
├── data-model.md                    # Phase 1: digests/research-projects fields, issue-translations
├── quickstart.md                    # Phase 1: validation and rollout checklist
├── contracts/
│   ├── public-issues-api.md         # list/detail endpoints, translation timing
│   ├── worker-issue-text.md         # sweep, REST writes, anchored schedule rules
│   └── issue-pages.md               # routes, layout, metadata, share images, message keys
├── checklists/
│   └── requirements.md
└── tasks.md                         # Phase 2 (/speckit-tasks, not created here)
```

### Source Code (repository root)

```text
packages/shared/src/
├── index.ts                                   # + PublishWeekdaySchema, IssueText/Translation status enums; re-exports
├── schedule.ts                                # + latestScheduledSlot; anchor-aware isProjectDue / isProjectStale
├── schedule.test.ts                           # + anchored cases (contract worker-issue-text §3.3)
├── issueOrder.ts                              # new: IMPORTANCE_RANK, compareIssueItems
└── issueOrder.test.ts                         # new

apps/worker/src/
├── index.ts                                   # + sweepIssueText() after the project loop
├── cms/client.ts                              # + anchor fields in listDueProjects; listIssueTextWork, getProject,
│                                              #   listPublicationsForIssue, patchDigest; createDigest sends status
├── pipeline/
│   ├── runProject.ts                          # createDigest({ …, issueTextStatus: 'pending' })
│   ├── issueText.ts                           # new: prompts (sentences, summary), validateIssueText, guards
│   ├── issueText.test.ts                      # new
│   ├── issueSweep.ts                          # new: select → generate → PATCH / fail + logError
│   └── issueSweep.test.ts                     # new

apps/web/
├── assets/fonts/                              # new: IBMPlexSans-Regular.ttf, IBMPlexSans-SemiBold.ttf, OFL.txt
├── next.config.ts                             # + htmlLimitedBots (built-in + TelegramBot|Viber),
│                                              #   outputFileTracingIncludes for opengraph-image routes
├── messages/{en,de,tr,ru,uk}.json             # + Site, Issue, Trust; Home/Project rewritten (issue-pages §6)
├── scripts/                                   # (ensure-schema unchanged)
├── src/
│   ├── collections/
│   │   ├── Digests.ts                         # + issue fields, hiddenFromPublic; beforeValidate create-only
│   │   ├── digestHooks.ts                     # + revision bump, attempts reset, translation invalidation
│   │   ├── digestHooks.test.ts                # + cases (owner edit → ready/edited; worker write untouched)
│   │   ├── IssueTranslations.ts               # new: unique (digest, locale) index
│   │   └── ResearchProjects.ts                # + publishWeekday, publishHourUtc, audienceContext
│   ├── payload.config.ts                      # register IssueTranslations
│   ├── lib/
│   │   ├── issues.ts                          # new: DTO mapping (list/detail), meta title/description
│   │   ├── issues.test.ts                     # new
│   │   ├── issueQueries.ts                    # new (server-only): visible digest + items loaders (API + OG image)
│   │   ├── issueTranslation.ts                # new: claim / wait / reclaim state machine (store interface)
│   │   ├── issueTranslation.test.ts           # new: unique-key fake store
│   │   ├── issueTranslator.ts                 # new: gateway translator + test stub (guarded)
│   │   ├── metadata.ts                        # new: shared openGraph/twitter/alternates builder
│   │   └── health.ts                          # pass anchor fields through to isProjectStale
│   ├── components/
│   │   ├── TrustNotice.tsx                    # new
│   │   ├── IssueView.tsx                      # new: summary (ol + anchors) + items (ol, id="item-…")
│   │   ├── IssueArchiveList.tsx               # new
│   │   └── LatestIssueCard.tsx                # new
│   ├── scripts/seed-public-feed.ts            # + ready / pending / hidden issue fixtures
│   └── app/
│       ├── [locale]/
│       │   ├── layout.tsx                     # localized header; generateMetadata (metadataBase, template, alternates)
│       │   ├── page.tsx                       # patient copy; generateMetadata
│       │   ├── opengraph-image.tsx            # new: site card
│       │   └── projects/[slug]/
│       │       ├── page.tsx                   # + LatestIssueCard + archive link; generateMetadata
│       │       ├── opengraph-image.tsx        # new: default project image
│       │       ├── issues/
│       │       │   ├── page.tsx               # new: archive
│       │       │   └── [issueId]/
│       │       │       ├── page.tsx           # new: issue page (cache()-shared fetch with generateMetadata)
│       │       │       ├── opengraph-image.tsx# new: per-issue image, falls back to project card
│       │       │       ├── not-found.tsx      # new
│       │       │       └── error.tsx          # new
│       │       └── publications/[publicationId]/page.tsx  # + TrustNotice, generateMetadata
│       └── api/
│           ├── health/route.ts                # select anchor fields
│           ├── test/issue-translations/route.ts  # new: test-only reset/read; 404 unless ISSUE_TRANSLATOR=stub and not production
│           └── public/projects/[slug]/issues/
│               ├── route.ts                   # new: archive list (never translates)
│               └── [id]/route.ts              # new: detail; claim + after() + 8 s wait; maxDuration 60
└── tests/e2e/
    ├── public-issue.spec.ts                   # new
    ├── issue-translation.spec.ts              # new: concurrency / fallback (stub translator)
    └── share-metadata.spec.ts                 # new: issue, archive and material pages

.github/workflows/ci.yml                       # + seed:public-feed after ensure-schema; ISSUE_TRANSLATOR=stub
docs/deploy-worker.md                          # note: AI_GATEWAY_API_KEY now required on Vercel for translation
```

**Structure Decision**: No new deployable. Generation stays in the worker and reaches the CMS
only through Payload REST (Principle VII). Everything that serves readers is in `apps/web`. Shared
pure logic (schedule anchor, item order) lives in `packages/shared`, so the prompt's item numbering
and the page's order cannot diverge.

## Implementation Notes (for `/speckit-tasks`)

Suggested dependency order. Each step can be verified on its own.

0. **CI seed first**: add `seed:public-feed` after `ensure-schema` in `ci.yml`, alone, before any
   feature code. Fix whatever the un-skipped existing specs surface in this step.
1. **Schema + hooks**:
   - Add the `digests` fields, make `beforeValidate` create-only, and add the revision/invalidation
     hooks. Owner vs worker writes are distinguished by who is writing (admin session vs header key / `worker` role), not by the payload. An owner
     text edit forces `ready` + `edited` (data-model §1).
   - Add the `IssueTranslations` collection with its unique index.
   - Add the `research-projects` anchor fields and `audienceContext`.

   Verify with `ensure-schema` on a local database and on a Neon preview branch.

2. **Shared**: `latestScheduledSlot`, anchor-aware due/stale, and `compareIssueItems`, with tests.
   Then wire them into `listDueProjects` and `/api/health`.
3. **Worker sweep**: `issueText.ts` (prompts, validation, guards), `issueSweep.ts`, the
   `createDigest` status, and the job order. A 4xx on the selection query → WARN, not ERROR
   (worker contract §2.6).
4. **Web read path**: `issueQueries`, `issues.ts` DTOs, the list and detail routes (English only
   first), then the issue, archive and project-card UI, `TrustNotice`, and messages.
5. **Translation**: the `issueTranslator` (gateway + stub), the `issueTranslation` state machine,
   and the `after()` wiring in the detail route. Then the test-only reset route and the
   concurrency E2E on its own seeded digest.
6. **Metadata + share images**: layout and page `generateMetadata`, `htmlLimitedBots`, fonts,
   and the three `opengraph-image` routes. Prove `og:image` survives on the archive and
   material pages (research R12).
7. **Chrome copy** across 5 locales, seed fixtures, and the docs note.
8. **Rollout**: quickstart §7.

Steps 1–4 deliver US1/US3/US4 in English. Step 5 delivers US5, step 6 delivers US2, and step 7
delivers US6. Per the roadmap's risk note, do not cut the disclaimer or OG work to save time.

## Complexity Tracking

> No constitution violations requiring justification.
