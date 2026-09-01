# Implementation Plan: Publication Detail Page

**Branch**: `003-publication-detail-page` | **Date**: 2026-09-01 | **Spec**: [`spec.md`](./spec.md)

**Input**: Feature specification from `/specs/003-publication-detail-page/spec.md`

## Summary

Turn the existing public per-material page into the place a reader actually goes: the feed title
opens that on-site page (same tab, no “opens in a new tab”), and the page shows source type, date,
high-importance treatment, structured summary, then full stored abstract or body, plus a labeled
original-publication link that opens in a new tab. Approach is presentation-plus-contract only:
reuse `resolveSource` / `collapseImportance` / `SourceBadge`, add a project-scoped public read
`GET /api/public/projects/:slug/materials/:id` that enforces the same `feedPublishedAt` gate as
the feed (and closes the current unscoped publication endpoint), no schema changes, no worker
changes, no new services.

## Technical Context

**Language/Version**: TypeScript on Node.js ≥24 (per root `package.json` `engines`); Next.js
16.2.6 (App Router); Payload CMS ^3.49.0

**Primary Dependencies**: Mantine 7.17 (`@mantine/core`), next-intl 4.1, existing
`@tabler/icons-react` (via `SourceBadge`). No new npm dependencies.

**Storage**: PostgreSQL via Neon, unchanged. No new collections or fields. Detail read uses
already-stored `publications` columns (`abstractOrBody`, `sourceType`, `summary`, `originalUrl`,
`importance`, `publishedOrUpdatedAt`, `feedPublishedAt`, `monitoredSource`, `title`) and existing
`content-translations`. See `data-model.md`.

**Testing**: Jest (detail mapping, empty-section omit, unpublished → not eligible) + Playwright
(feed title → detail, original link new-tab, not-found vs load-error, locales) — existing Cursor
hooks / Husky / CI gates (Constitution Principle IX); no new test infrastructure.

**Target Platform**: Vercel Hobby (`apps/web` only). Worker and Cloud Run are untouched.

**Project Type**: Web application within the existing monorepo (`apps/web` + `apps/worker` +
`packages/shared`) — this feature does not introduce a new deployable.

**Performance Goals**: Detail HTML arrives with the page (FR-032); readable within 2 seconds on a
mid-tier mobile connection (SC-010). One public GET per view. No client-side loading spinner on
the happy path.

**Constraints**: Zero new public write endpoints; zero new paid infrastructure (Principle III);
ingestion source types stay at three (Principle II); worker still does not talk to this page
(Principle VII). Unpublished materials must be indistinguishable from unknown IDs (404, no body).
Visible copy must not say “publication” (FR-021).

**Scale/Scope**: One detail page per material; abstracts are stored text (typically a few
paragraphs, occasionally a long RSS body) shown in full after the summary. Five UI locales,
unchanged. One existing project (`hht-research`) is the initial dataset.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle                                     | Status | Notes                                                                                                                                                                                                                     |
| --------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I. Spec-First, Event-Driven                   | PASS   | Spec with a completed `/speckit-clarify` pass precedes this plan; no implementation code in this command. Evolution of existing `Publication` / Material — no new domain events.                                          |
| II. Ruthless Scope Discipline                 | PASS   | No new ingestion source, no RAG/MCP/multi-model/collaboration. No abstract translation pipeline, no live publisher fetch, no schema migration. Feed listing/filter/badge behaviour unchanged except title destination.    |
| III. Free-Tier-First                          | PASS   | No new infrastructure. Surfaces already-stored `abstractOrBody`; no extra AI or translation spend (research.md R8).                                                                                                       |
| IV. Public by Default                         | PASS   | Detail page stays registration-free (FR-003). Zero public write endpoints. Unpublished items stay dark (FR-004, FR-030).                                                                                                  |
| V. Maintainability Over Cleverness            | PASS   | Reuses feed mapping (`resolveSource`, `collapseImportance`, `SourceBadge`) instead of a second taxonomy. Removes the unscoped `GET /api/public/publications/:id` rather than leaving a leakier twin (research.md R2, R3). |
| VI. Internationalization Is First-Class       | PASS   | All five locales from day one; summary uses the same translation cache + fallback note as the feed; abstract is shown as stored English with a fallback note (FR-018–FR-020, research.md R8).                             |
| VII. Domain Boundaries Are Service Boundaries | PASS   | Web/public-read only. Worker pipeline unchanged. No direct Postgres from a new service.                                                                                                                                   |
| VIII. Portable by Design                      | PASS   | No new vendor-specific API. Standard App Router page + existing Payload REST.                                                                                                                                             |
| IX. Automated, Enforced Quality Gates         | PASS   | Existing Jest/Playwright/ESLint/Prettier/tsc/build gates apply; new/updated tests enumerated in `quickstart.md`.                                                                                                          |

**Post–Phase 1 re-check**: `research.md`, `data-model.md`, `contracts/material-detail-api.md`, and
`quickstart.md` stay within the gates above — no new collections, no new npm packages, one new
project-scoped read endpoint replacing a leakier unscoped one, UI and E2E updates only. No
unjustified violations. Complexity Tracking is empty.

## Project Structure

### Documentation (this feature)

```text
specs/003-publication-detail-page/
├── plan.md                        # This file
├── research.md                    # Phase 0
├── data-model.md                  # Phase 1
├── quickstart.md                  # Phase 1
├── contracts/
│   └── material-detail-api.md     # Phase 1
├── checklists/
│   └── requirements.md
└── tasks.md                       # Phase 2 (/speckit-tasks — not created here)
```

### Source Code (repository root)

Existing monorepo; changes are confined to `apps/web`. No worker or `packages/shared` changes.

```text
apps/web/
├── src/
│   ├── app/
│   │   ├── [locale]/projects/[slug]/
│   │   │   ├── page.tsx                              # pass slug into MaterialsFeed
│   │   │   └── publications/[publicationId]/
│   │   │       ├── page.tsx                          # rewritten: header + summary + abstract
│   │   │       ├── error.tsx                         # new: load-error + retry (FR-031)
│   │   │       └── not-found.tsx                     # new: unpublished/unknown (FR-030)
│   │   └── api/public/
│   │       ├── projects/[slug]/materials/[id]/
│   │       │   └── route.ts                          # new: project-scoped detail GET
│   │       └── publications/[id]/route.ts            # removed (research.md R2)
│   ├── components/
│   │   ├── MaterialCard.tsx                          # title → in-app detail; drop opensInNewTab
│   │   ├── MaterialsFeed.tsx                         # pass slug through to cards
│   │   ├── SourceBadge.tsx                           # reused on detail header
│   │   └── MaterialDetailView.tsx                    # new: ordered detail layout (FR-025)
│   ├── lib/
│   │   ├── materials.ts                              # + MaterialDetail + toMaterialDetail()
│   │   └── materials.test.ts                         # + detail mapping / empty-section tests
│   └── messages/{en,de,tr,ru,uk}.json                # detail strings; retire visible opensInNewTab
└── tests/e2e/
    ├── public-feed.spec.ts                           # title → /publications/; no new-tab on feed
    └── public-material-detail.spec.ts                # new: order, original link, not-found
```

**Structure Decision**: No new deployable. Public read stays in `apps/web`. The page URL remains
`/{locale}/projects/{slug}/publications/{id}` (existing route; research.md R12). The data
contract moves under the materials public API so eligibility and project scope match the feed.

## Complexity Tracking

> No constitution violations requiring justification.
