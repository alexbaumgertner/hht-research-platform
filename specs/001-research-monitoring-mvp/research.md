# Research: Research Monitoring MVP

**Branch**: `001-research-monitoring-mvp` | **Date**: 2026-08-26

All Technical Context unknowns from `plan.md` are resolved below.

---

## R1. Bootstrap lookback (first monitoring run)

**Decision**: First successful run for a project uses a **30-day** lookback (`datetype=edat` / equivalent “first seen or updated” window per source). Subsequent runs use **since `lastSuccessfulRunAt`** only (no schedule-tied rolling window).

**Rationale**: Spec deferred the exact duration to planning. HHT (and similar rare-disease topics) produce sparse hits; 30 days seeds a useful first digest without flooding AI summarization. Overflow beyond the per-run batch limit is deferred to later runs (FR assumptions).

**Alternatives considered**:

- 7 days — too sparse for rare topics; empty first digest likely.
- 90 days — higher AI/cost and batch overflow on first run.
- Schedule-tied window forever — rejected by clarification (watermark-based “what’s new”).

---

## R2. Per-run batch bound

**Decision**: Process at most **50 new candidates per source per run** (after source fetch, before/at dedupe intake). Remaining candidates stay unprocessed until a later run; watermark still advances only when the run completes successfully or with partial failure per FR-020.

**Rationale**: Keeps Cloud Run Job duration and AI spend predictable on free tiers; matches “bounded batch” assumption in the spec.

**Alternatives considered**:

- 20 — safer but may starve weekly/monthly projects after a pause gap.
- Unbounded — violates free-tier cost and job-timeout risk.

---

## R3. AI provider for classify / summarize / translate

**Decision**: Use the **Vercel AI SDK** with **Vercel AI Gateway** and a **single fixed model** chosen from the Gateway free-tier catalog at implementation time (no owner-facing model picker — FR-019). Same capability path for classification, English summarization, importance ranking, and on-demand translation. If translation quality is insufficient, expose a visitor-facing machine-translation link (e.g. Google Translate) as fallback — not a paid dedicated translation product.

**Rationale**: Aligns with free-tier-first (Principle III), Next.js/Vercel hosting, and “no multi-model choice.” Worker and web both call the Gateway with a shared API key / env config so prompts and schemas stay consistent.

**Alternatives considered**:

- Direct Google Gemini / OpenAI SDKs only — more lock-in and duplicate config across apps.
- Local/open models on Cloud Run — higher ops burden for MVP.
- Dedicated translation API (DeepL, etc.) — explicitly out of scope (FR-019).

---

## R4. Owner digest email

**Decision**: **Resend** (free tier: 3,000/mo, 100/day) for transactional “digest published” emails. Prefer `@payloadcms/email-resend` for CMS-related mail; the monitoring worker sends the short link-only digest notice via Resend (or Payload Local/REST email helper) when `emailNotificationEnabled` is true.

**Rationale**: Free, Payload-friendly, sufficient volume for a solo owner and few projects.

**Alternatives considered**:

- SMTP / Ethereal only — fine for local, not production deliverability.
- SendGrid / SES — more setup; unnecessary at MVP volume.

---

## R5. Scheduling architecture (Cloud Scheduler + Cloud Run Jobs)

**Decision**: One **Cloud Run Job** (Dockerized Node worker) triggered by **one Cloud Scheduler** job on a frequent cadence (e.g. hourly). The job loads active (non-paused) projects whose schedule is due relative to `lastSuccessfulRunAt` / `monitoringStatus`, then runs the pipeline. Per-project cadence (daily / weekly / monthly) is enforced in application logic, not as separate Scheduler jobs.

**Rationale**: Cloud Scheduler free tier is only **3 jobs/month**; one Scheduler + due-project polling stays free-tier viable and portable. Matches constitution: worker is a separate deployable; long runs stay off Vercel request path.

**Alternatives considered**:

- One Scheduler per project — blows free tier immediately.
- In-process cron on Vercel — couples monitoring to request hosting; violates Principle VII.
- Always-on VM — not free-tier-first.

---

## R6. Source adapters

**Decision**:

- **PubMed**: NCBI E-utilities (`esearch` + `efetch`); keyword OR query; date filter via `mindate`/`maxdate` + `datetype=edat` from watermark (or 30-day bootstrap); dedupe key PMID then DOI then normalized title.
- **ClinicalTrials.gov**: API v2 `GET /api/v2/studies` with `query.term` (OR keywords) and `filter.advanced` `AREA[LastUpdatePostDate]RANGE[since,MAX]`; dedupe key NCT ID.
- **RSS**: Fetch feed URL; parse with a maintained RSS/Atom library; filter items by keyword OR against title/description and by `pubDate`/`updated` ≥ watermark; reject non-feed responses at config validate and/or run failure; dedupe by GUID/link then normalized title.

**Rationale**: All three are free public APIs/feeds, well documented, and match FR-002 source types.

**Alternatives considered**:

- Third-party literature aggregators — extra cost/dependency.
- Scraping HTML UIs — fragile and against maintainability (Principle V).

---

## R7. App / service layout

**Decision**: Monorepo with:

- `apps/web` — Next.js 16+ App Router + Payload CMS 3 (admin + public UI + REST)
- `apps/worker` — containerized Node monitoring pipeline
- `packages/shared` — shared types, Zod schemas, pipeline pure functions (dedupe keys, schedule-due logic) used by Jest

Shared **Neon Postgres**; worker reads/writes via Payload REST (and/or direct DB only where justified and documented). Public routes use `next-intl` locale prefix; admin remains Payload auth.

**Rationale**: Principle VII (service boundaries) + VIII (Docker worker) + single schema owned by Payload.

**Alternatives considered**:

- Single Next.js process for cron — rejected by constitution.
- Separate databases — unnecessary complexity for MVP.

---

## R8. UI library and auth

**Decision**: **Mantine** for public UI (constitution). Owner auth = **Payload admin users only**; no public end-user accounts (FR-014 / Principle IV).

**Rationale**: Non-negotiable baseline; keeps MVP write path inside CMS.

**Alternatives considered**: Tailwind/shadcn — constitution forbids Tailwind as the UI library choice. Custom public auth — deferred until multi-user demand.

---

## R9. Testing and quality gates

**Decision**: Jest for domain/pipeline unit tests; Playwright for public feed, locale switch, publication detail, and owner admin flows. Cursor hooks + Husky + GitHub Actions per Principle IX.

**Rationale**: Constitution Technical Baseline.

**Alternatives considered**: Vitest-only or Cypress — would require constitution amendment.
