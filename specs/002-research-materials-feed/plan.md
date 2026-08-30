# Implementation Plan: Research Materials Feed

**Branch**: `002-research-materials-feed` | **Date**: 2026-08-30 | **Spec**: [`spec.md`](./spec.md)

**Input**: Feature specification from `/specs/002-research-materials-feed/spec.md`

## Summary

Replace the digest-grouped public project page (`/[locale]/projects/[slug]`) with a flat,
single-column, read-only feed of published research materials — journal articles, trial-registry
entries, news, guidelines, and social posts — sorted newest-first, with source badges, a subtle
high-importance treatment, free-text search, multi-select source filtering, a high-importance
toggle, and full locale support (en/de/tr/ru/uk) including localized titles with graceful
fallback. Digests keep deciding what's publicly visible but stop being a visual grouping. The
approach is additive: four new optional/system-managed fields on three existing Payload
collections, one new public read endpoint, a small worker change to thread the originating source
into each publication, and no new services, infrastructure, or public write paths.

## Technical Context

**Language/Version**: TypeScript on Node.js ≥24 (per root `package.json` `engines`); Next.js
16.2.6 (App Router); Payload CMS ^3.49.0

**Primary Dependencies**: Mantine 7.17 (`@mantine/core`, `@mantine/hooks`), next-intl 4.1,
`@payloadcms/db-postgres`, and a new dependency — `@tabler/icons-react` (research.md R10) — for
source badge and search-field icons

**Storage**: PostgreSQL via Neon, unchanged. Four additive/optional fields across three existing
Payload collections (`monitored-sources`, `publications`, `content-translations`) — see
`data-model.md`. No new collections, no destructive migration.

**Testing**: Jest (pure logic: badge resolution, importance mapping, locale fallback, filter
combination, eligibility) + Playwright (full feed flow, replacing the digest-grouped assertions in
`tests/e2e/public-feed.spec.ts`) — both already wired into the Cursor hooks / Husky / CI gate
layers per Constitution Principle IX; no new test infrastructure.

**Target Platform**: Vercel Hobby (`apps/web`, unchanged). The worker (`apps/worker` on GCP Cloud
Run Jobs) gets one small, additive change (thread `source.id` through to `createPublication`) and
no new deployment target.

**Project Type**: Web application within the existing monorepo (`apps/web` + `apps/worker` +
`packages/shared`) — this feature does not introduce a new deployable.

**Performance Goals**: Filter/search interactions resolve client-side against an already-fetched,
locale-resolved array (tens of items per project) — sub-300ms by construction (SC-004), no
per-keystroke network round-trip. Initial page render has no loading state; content arrives with
the server-rendered HTML (FR-032).

**Constraints**: Zero new public write endpoints (SC-009); zero new paid infrastructure
(Principle III); worker continues to reach Payload only over its existing REST API, never
Postgres directly (Principle VII); the number of tracked ingestion source types stays at three —
the two additional badges are a presentation-layer resolution, not a fourth/fifth source type
(Principle II, FR-011).

**Scale/Scope**: Tens of materials per project today; no pagination or virtualization required
(explicitly out of scope). Five UI locales, unchanged. One existing project (`hht-research`) is
the only real-world dataset this ships against initially.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle                                     | Status | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| --------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I. Spec-First, Event-Driven                   | PASS   | Spec (with a completed `/speckit-clarify` pass) precedes this plan; no code written yet. This is an evolution of existing domain concepts (`Publication`, `Digest`, `MonitoredSource`), not a new domain — no new domain events required.                                                                                                                                                                                              |
| II. Ruthless Scope Discipline                 | PASS   | Ingestion source types remain exactly three (`pubmed`, `clinicaltrials`, `rss`). The five display badges are a read-time presentation resolution (research.md R3), not new sources. No RAG, no MCP, no multi-model, no collaborative editing — the mockup's write features are explicitly excluded (spec Out of Scope).                                                                                                                |
| III. Free-Tier-First                          | PASS   | No new infrastructure or paid service. New fields are free on the existing Neon plan. Title translation reuses the existing per-locale AI Gateway call rather than adding a second one (research.md R5). `@tabler/icons-react` is a free, tree-shaken npm dependency.                                                                                                                                                                  |
| IV. Public by Default                         | PASS   | Feed stays public, no registration (FR-009). The only new write surface (`displayCategory` on sources) is owner-only, through the existing Payload admin auth — no new public write path (SC-009).                                                                                                                                                                                                                                     |
| V. Maintainability Over Cleverness            | PASS   | Reuses the codebase's own established denormalization pattern (`Digests.afterChange` → `hasPublishedDigest`) for the new publishing gate (research.md R2) instead of inventing a join mechanism. Explicitly retires the now-unused digest-grouped page, `ImportanceFilter.tsx`, and the digests public route rather than leaving them as dead code (research.md R1). Domain remains topic-agnostic — no HHT-specific logic introduced. |
| VI. Internationalization Is First-Class       | PASS   | All five locales (en/de/tr/ru/uk) covered from the start; title localization extends the existing translate-on-publish pipeline rather than a new one (research.md R5); adding a sixth locale requires only translation data (FR-041), unchanged.                                                                                                                                                                                      |
| VII. Domain Boundaries Are Service Boundaries | PASS   | Worker still reaches web/Payload only through the existing `createPublication` REST call — it gains one additional field in the payload, not a new integration point. No direct Postgres access introduced anywhere.                                                                                                                                                                                                                   |
| VIII. Portable by Design                      | PASS   | No new vendor-specific API. `@tabler/icons-react` and the new Payload fields are fully portable off Vercel/GCP if the platform ever moves.                                                                                                                                                                                                                                                                                             |
| IX. Automated, Enforced Quality Gates         | PASS   | Existing Jest/Playwright/ESLint/Prettier/tsc/build gates (Cursor hooks, Husky, CI) apply unchanged; new/updated test files are enumerated in `quickstart.md` and become concrete items in `tasks.md`.                                                                                                                                                                                                                                  |

**Post–Phase 1 re-check**: `research.md`, `data-model.md`, `contracts/materials-api.md`, and
`quickstart.md` stay within the gates above — the only additions are four optional/system-managed
schema fields, one new read endpoint, one removed read endpoint with a confirmed-unused status,
and one new npm dependency. No unjustified violations. Complexity Tracking is empty.

## Project Structure

### Documentation (this feature)

```text
specs/002-research-materials-feed/
├── plan.md                        # This file
├── research.md                    # Phase 0
├── data-model.md                  # Phase 1
├── quickstart.md                  # Phase 1
├── contracts/
│   └── materials-api.md           # Phase 1
├── checklists/
│   └── requirements.md
└── tasks.md                       # Phase 2 (/speckit-tasks — not created here)
```

### Source Code (repository root)

Existing monorepo layout; changes are additive/modifying within `apps/web` and one small change in
`apps/worker`. No new top-level directories.

```text
apps/
├── web/
│   ├── src/
│   │   ├── collections/
│   │   │   ├── MonitoredSources.ts        # + displayCategory field
│   │   │   ├── Publications.ts            # + monitoredSource, + feedPublishedAt fields
│   │   │   ├── ContentTranslations.ts     # + title field
│   │   │   └── Digests.ts                 # afterChange hook extended to stamp feedPublishedAt
│   │   ├── app/
│   │   │   ├── [locale]/
│   │   │   │   ├── layout.tsx             # + ColorSchemeScript / defaultColorScheme="auto"
│   │   │   │   └── projects/[slug]/
│   │   │   │       ├── page.tsx           # rewritten: flat feed, calls /materials endpoint
│   │   │   │       └── error.tsx          # new: load-failure UI with retry (FR-033)
│   │   │   └── api/public/projects/[slug]/
│   │   │       ├── materials/route.ts     # new (replaces digests/route.ts)
│   │   │       └── digests/route.ts       # removed
│   │   ├── components/
│   │   │   ├── LocaleSwitcher.tsx         # extended: carries current query string
│   │   │   ├── ImportanceFilter.tsx       # removed (superseded by feed's own controls)
│   │   │   ├── MaterialCard.tsx           # new
│   │   │   ├── SourceBadge.tsx            # new
│   │   │   ├── MaterialSearchInput.tsx    # new
│   │   │   ├── SourceCategoryFilter.tsx   # new (Chip.Group)
│   │   │   ├── HighImportanceSwitch.tsx   # new
│   │   │   └── MaterialsFeed.tsx          # new (client component owning filter state)
│   │   ├── lib/
│   │   │   ├── materials.ts               # new: toMaterial() mapping fn (research.md R11),
│   │   │   │                              #      badge resolution, importance collapse
│   │   │   └── materials.test.ts          # new
│   │   └── scripts/
│   │       └── backfill-feed-published-at.ts   # new, one-time migration (research.md R2)
│   ├── messages/{en,de,tr,ru,uk}.json     # updated: new feed strings, retire stale Project keys
│   └── tests/e2e/
│       ├── public-feed.spec.ts            # updated: flat-feed assertions
│       └── monitoring-digest.spec.ts      # checked for reliance on removed route
└── worker/
    └── src/pipeline/
        ├── runProject.ts                  # thread source.id → monitoredSource on both create calls
        └── translate.ts                   # extended: translate title alongside summary sections
```

**Structure Decision**: No new deployable and no new top-level directory. This feature lives
entirely inside the existing `apps/web` (UI, Payload schema, public API) and a minimal, additive
change to `apps/worker` (one extra field threaded through an existing call, one extended
translation call). This matches Principle VII — the service boundary between project-management/
public-read (`apps/web`) and the monitoring pipeline (`apps/worker`) is unchanged; the worker still
only talks to Payload's REST API.

## Complexity Tracking

> No constitution violations requiring justification.
