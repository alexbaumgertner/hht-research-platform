<!--
Sync Impact Report
- Version change: 1.0.0 → 1.0.1
- Modified principles:
  - IX. Automated, Enforced Quality Gates — agent Layer 1 retargeted from
    Claude Code (`.claude/settings.json`, PostToolUse/Stop) to Cursor agent
    (`.cursor/hooks.json`, afterFileEdit/stop)
- Added sections: none
- Removed sections: none
- Technical Baseline: "Agent enforcement" row updated likewise
- Follow-up TODOs: none
-->

# HHT Research Platform Constitution

HHT Research Platform is an open-source personal research monitoring
platform. Its mission is to automate monitoring of research sources
(PubMed, ClinicalTrials.gov, RSS feeds) for a defined research topic,
use AI to summarize and rank new findings, and surface them as a public,
readable digest feed — reducing the manual burden of tracking a narrow
research area. The first real project on the platform focuses on
Hereditary Hemorrhagic Telangiectasia (HHT), with the Cure HHT community
as an early target audience. The domain model is topic-agnostic: HHT is
the first instance, not a hardcoded assumption.

## Core Principles

### I. Spec-First, Event-Driven Design

No implementation code is written before the relevant domain events,
user stories, and (for irreversible technical choices) an Architecture
Decision Record (ADR) exist. For every new capability the required order
is: Domain Events → Policies → User Stories → Architecture. Specs and
ADRs MUST land before coding begins. Rationale: solo and occasional
contributors cannot recover undocumented intent from chat history;
events and stories are the durable contract.

### II. Ruthless Scope Discipline

"MVP" means MVP. The first release MUST NOT include: RAG, MCP
integrations in the product itself, multi-model selection, more than
three source types, or collaborative/shared-project features. A new
capability is added only after the previous one is proven end-to-end in
production. When in doubt, cut. Rationale: unfinished breadth is worse
than a narrow, working digest pipeline.

### III. Free-Tier-First, Cost-Conscious Infrastructure

Default to free or near-free managed services (Vercel Hobby, GCP free
tier, Neon free tier) until real usage requires paying for more. Prefer
lazy/on-demand computation (for example, translate content on first
request, not eagerly for every language) over upfront cost. Rationale:
the platform must stay operable for a solo maintainer without recurring
spend until usage justifies it.

### IV. Public by Default, Low-Friction Access

All published research content (digests, publications, projects) MUST be
readable without registration. Authentication is required only for write
operations (creating/configuring projects, sources, schedules),
performed by the project owner through the CMS admin panel. A
custom-built public auth flow MUST NOT be added until real multi-user
demand exists. Rationale: the primary audience is readers, not editors.

### V. Maintainability Over Cleverness

This project is solo-maintained with occasional external contributions
expected. Code, specs, and ADRs MUST be understandable by a new
contributor without live context from the original author. Prefer
boring, well-documented solutions over novel ones. The product name may
remain disease-specific for now; the domain model, entities, and code
MUST remain topic-agnostic so the platform can be re-branded or reused
for other research communities without an architecture change.

### VI. Internationalization Is First-Class

The public-facing UI MUST support English, German, Turkish, Russian, and
Ukrainian from day one — not retrofitted later. English is the canonical
source language for AI-generated content; translations are derived and
cached on demand, not manually maintained in parallel. Rationale: early
target communities are multilingual; deferred i18n becomes structural
debt.

### VII. Domain Boundaries Are Service Boundaries

"Research Project Management" (CRUD, public read UI) and "Monitoring
Run" (scheduled fetch → dedupe → classify → summarize → publish
pipeline) are separate deployable services. They communicate through a
shared Postgres database and a REST API — not a single monolith process.
Rationale: scheduling and long-running monitoring workloads must not
block or couple to the public/CMS request path.

### VIII. Portable by Design

Core services MUST run in Docker containers so the platform can move off
any single managed provider (Vercel, GCP) to self-hosted infrastructure
without an architecture rewrite. Avoid deep, hard-to-replace
vendor-specific APIs where a portable alternative exists at comparable
effort. Rationale: free-tier defaults are not permanent lock-in.

### IX. Automated, Enforced Quality Gates

A task is not "done" when the code is written; it is done when it passes
an automated gate, layered from fastest/cheapest to most authoritative:

1. **Layer 1 — Agent hooks** (fastest, in-session). Configured in
   `.cursor/hooks.json` for the Cursor agent: an `afterFileEdit` hook
   runs ESLint + Prettier on every file the agent edits or writes; a
   `stop` hook runs `tsc --noEmit`, `next build`, and the full test
   suite (Jest + Playwright) when the agent believes a task or Spec Kit
   `/tasks` run is complete. Failures mean the task is not done.
2. **Layer 2 — Git pre-commit** (local, bypassable). Husky + lint-staged
   runs lint and format checks before each commit. Because
   `--no-verify` can skip it, this layer is convenience, not a
   guarantee.
3. **Layer 3 — CI** (authoritative, non-bypassable). A GitHub Actions
   workflow is a required status check on every pull request, running:
   ESLint, Prettier format check, TypeScript type-check, production
   build (`next build`), Jest unit tests, and Playwright end-to-end
   tests. No pull request merges unless all of these pass.

Testing is two-tier: Jest covers isolated domain logic (deduplication,
classification, importance scoring, worker pipeline steps); Playwright
covers real user-facing flows in a browser — public digest feed, locale
switching, publication detail view, and (for the owner)
project/source/schedule management. During development, the coding agent
MUST drive a running instance through the Playwright MCP server to
verify behavior against acceptance criteria, not rely on visual
inspection of code alone.

## Non-Negotiable Technical Baseline

The following stack choices MUST NOT be revisited without a new ADR:

| Concern                      | Choice                                                                                                               |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Backend / CMS                | Payload CMS on Next.js (App Router)                                                                                  |
| Public + admin hosting       | Vercel (Hobby tier)                                                                                                  |
| Background monitoring worker | Containerized Node.js on GCP Cloud Run Jobs, triggered by GCP Cloud Scheduler                                        |
| Database                     | Postgres via Neon (free tier)                                                                                        |
| UI library                   | Mantine (explicitly not Tailwind CSS)                                                                                |
| i18n                         | next-intl with locale-prefixed routing (`[locale]` segment)                                                          |
| Lint / format                | ESLint (`eslint-config-next` + typescript-eslint); Prettier as formatting source of truth (`eslint-config-prettier`) |
| Unit tests                   | Jest                                                                                                                 |
| End-to-end tests             | Playwright, including interactive verification via Playwright MCP during development                                 |
| Agent enforcement            | Cursor agent hooks in `.cursor/hooks.json` (`afterFileEdit` lint/format; `stop` build + full test suite)             |
| Local enforcement            | Husky + lint-staged pre-commit hook                                                                                  |
| CI enforcement               | GitHub Actions required status check on every PR (lint, format, type-check, build, unit, E2E)                        |
| License                      | MIT                                                                                                                  |

## Spec & Delivery Workflow

- Spec Kit is the delivery spine: specify → plan (with ADRs for
  irreversible choices) → tasks → implement. Skipping ahead to code
  violates Principle I.
- Capabilities ship only when proven end-to-end in production before the
  next capability starts (Principle II).
- "Done" means Layer 1–3 quality gates pass as applicable; CI is the
  merge authority (Principle IX).
- Domain and code remain topic-agnostic even when branding or the first
  deployed project is HHT-specific (Principle V).

## Governance

This constitution supersedes conflicting informal practice, chat
guidance, and ad-hoc implementation preferences. Amendments MUST:

1. Update `.specify/memory/constitution.md` with a Sync Impact Report
   comment documenting version change, principle/section deltas, and
   deferred TODOs.
2. Bump **Version** using semantic versioning: MAJOR for removed or
   redefined principles; MINOR for new principles/sections or material
   expansions; PATCH for clarifications and non-semantic wording.
3. Set **Last Amended** to the amendment date (ISO `YYYY-MM-DD`).
4. Record irreversible stack or architecture changes in an ADR; the
   Technical Baseline table MUST stay aligned with accepted ADRs.

Compliance review expectations:

- Pull requests and Spec Kit plans MUST be checked against these
  principles (especially scope, service boundaries, i18n, and quality
  gates).
- Complexity, new dependencies, paid infrastructure, and product auth
  expansions MUST be justified against Principles II, III, IV, V, and
  VIII.
- Required CI status checks MUST remain enabled; weakening Layer 3
  without a documented amendment is a governance violation.

**Version**: 1.0.1 | **Ratified**: 2026-08-26 | **Last Amended**: 2026-08-26
