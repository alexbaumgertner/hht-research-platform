# Implementation Plan: Research Monitoring MVP

**Branch**: `001-research-monitoring-mvp` | **Date**: 2026-08-26 | **Spec**: [`spec.md`](./spec.md)

**Input**: Feature specification from `/specs/001-research-monitoring-mvp/spec.md`

## Summary

Build the first end-to-end research monitoring platform: owner configures a topic-agnostic **Research Project** (keywords, PubMed / ClinicalTrials.gov / RSS sources, schedule, pause/resume) in Payload Admin; a **Dockerized worker** on GCP Cloud Run Jobs (triggered by Cloud Scheduler) fetches new items since the last successful run (30-day bootstrap on first run), dedupes, classifies, summarizes/ranks via a fixed AI Gateway model, and publishes a public digest; anonymous visitors read a locale-prefixed feed with importance filter and on-demand cached translations. Out of scope per FR-019: RAG, MCP, multi-model choice, >3 source types, collaboration, read/unread, dedicated translation APIs.

## Technical Context

**Language/Version**: TypeScript on Node.js 20.9+; Next.js 16.2.6+ (App Router); Payload CMS 3.x

**Primary Dependencies**: Payload CMS 3 (`@payloadcms/db-postgres`), Mantine, next-intl, Vercel AI SDK + AI Gateway, Resend (`@payloadcms/email-resend` / Resend SDK), RSS parser library, NCBI E-utilities + ClinicalTrials.gov API v2 clients

**Storage**: PostgreSQL via Neon (shared by web + worker)

**Testing**: Jest (domain/pipeline), Playwright (public + admin E2E); Cursor hooks + Husky + GitHub Actions (constitution Principle IX)

**Target Platform**: Vercel Hobby (`apps/web`); GCP Cloud Run Jobs + Cloud Scheduler (`apps/worker` container); local Docker Compose optional for Postgres/worker

**Project Type**: Web application + background worker (two deployables, shared DB / REST)

**Performance Goals**: Public feed TTFB suitable for Hobby; monitoring run completes within Cloud Run task timeout for ≤50 candidates/source; translation first-hit acceptable wait, subsequent hits from cache

**Constraints**: Free-tier-first (Vercel Hobby, Neon free, GCP free tier, Resend free, AI Gateway free credits); Cloud Scheduler ≤3 jobs → single frequent Scheduler + due-project logic; no public end-user auth; English canonical AI content; Mantine not Tailwind; portable Docker worker

**Scale/Scope**: Solo owner, multiple projects allowed but success proven with one HHT-focused public project; 5 locales; 3 source types; MVP only

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
| --- | --- | --- |
| I. Spec-First, Event-Driven | PASS | Spec + plan + contracts before implementation; stack choices already in constitution baseline — new product ADRs only if we diverge |
| II. Ruthless Scope Discipline | PASS | FR-019 exclusions honored; ≤3 sources; no RAG/MCP/multi-model/collab |
| III. Free-Tier-First | PASS | Neon, Vercel Hobby, Cloud Run free tier, one Scheduler job, Resend free, AI Gateway free credits; on-demand translation |
| IV. Public by Default | PASS | Public read APIs/pages; write via Payload admin only |
| V. Maintainability / topic-agnostic | PASS | Domain entities have no HHT hardcoding |
| VI. i18n first-class | PASS | en/de/tr/ru/uk via next-intl; on-demand content translation |
| VII. Domain service boundaries | PASS | `apps/web` (project mgmt + public UI) vs `apps/worker` (monitoring run); shared Postgres + REST |
| VIII. Portable by Design | PASS | Worker is Docker; Payload/Postgres portable off Vercel/GCP |
| IX. Quality gates | PASS | Jest + Playwright + ESLint/Prettier/tsc/build in hooks, Husky, CI |

**Post–Phase 1 re-check**: Design artifacts (`research.md`, `data-model.md`, `contracts/*`, `quickstart.md`) stay within the gates above. No unjustified violations. Complexity Tracking left empty.

## Project Structure

### Documentation (this feature)

```text
specs/001-research-monitoring-mvp/
├── plan.md              # This file
├── research.md          # Phase 0
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1
├── contracts/           # Phase 1
│   ├── public-api.md
│   ├── admin-api.md
│   └── monitoring-worker.md
└── tasks.md             # Phase 2 (/speckit-tasks — not created here)
```

### Source Code (repository root)

Greenfield layout (to be created at implement):

```text
apps/
├── web/                          # Next.js 16 + Payload CMS 3
│   ├── src/
│   │   ├── app/
│   │   │   ├── (payload)/        # Admin + Payload routes
│   │   │   └── [locale]/         # Public UI (next-intl)
│   │   ├── collections/          # ResearchProject, sources, runs, digests, …
│   │   ├── components/           # Mantine public UI
│   │   └── i18n/
│   ├── tests/
│   │   └── e2e/                  # Playwright
│   └── package.json
└── worker/                       # Cloud Run Job entrypoint
    ├── src/
    │   ├── index.ts              # Due projects → pipeline
    │   ├── adapters/             # pubmed, clinicaltrials, rss
    │   ├── pipeline/             # dedupe, classify, summarize, publish
    │   └── notify/               # Resend digest email
    ├── Dockerfile
    └── package.json

packages/
└── shared/                       # Types, Zod, pure schedule/dedupe helpers
    ├── src/
    └── package.json

.github/workflows/ci.yml
.cursor/hooks.json
```

**Structure Decision**: Monorepo with separate `apps/web` and `apps/worker` deployables plus `packages/shared`, matching Principle VII (service boundaries) and VIII (containerized worker). No single-process cron on Vercel.

## Complexity Tracking

> No constitution violations requiring justification.
