# Quickstart: Research Monitoring MVP

**Branch**: `001-research-monitoring-mvp`  
**Purpose**: Validate the feature end-to-end after implementation. Not an implementation guide — see `plan.md`, `data-model.md`, and `contracts/`.

---

## Prerequisites

- Node.js 20.9+
- pnpm
- Neon (or local Postgres) connection string
- Vercel project (Hobby) for `apps/web`
- GCP project with Cloud Run Jobs + Cloud Scheduler (or local worker run)
- Resend API key (optional for email story)
- Vercel AI Gateway key for classify/summarize/translate

---

## Setup (expected after implement)

```bash
pnpm install
cp .env.example .env   # fill DATABASE_URL, secrets
pnpm --filter web dev  # Payload admin + public UI
# in another terminal, for manual runs:
pnpm --filter worker start
```

Docker worker (production-shaped):

```bash
docker build -t hht-monitor-worker -f apps/worker/Dockerfile .
docker run --env-file .env hht-monitor-worker
```

---

## Seed / owner configuration (SC-001)

1. Open `/admin`, sign in as owner.
2. Create a Research Project (e.g. HHT-focused name, description, keywords including topic terms).
3. Add at least a **PubMed** source; optionally ClinicalTrials.gov and RSS.
4. Set schedule to `daily` (or weekly/monthly).
5. Leave monitoring **active**; optionally enable email notification.
6. Confirm elapsed time for this setup is under **15 minutes**.

---

## Validation scenarios

### V1 — Public feed without login (SC-003, SC-007)

1. Ensure ≥1 published digest exists (seed or run worker).
2. Open `/{locale}` anonymously → project appears on home list.
3. Open project URL → chronological digests visible.
4. Apply importance filter → only that level’s publications remain.
5. Open a publication → full summary sections + original link.
6. Confirm write/admin actions unavailable without auth.

### V2 — Monitoring run publishes digest (SC-002, SC-005)

1. With active project + PubMed + keywords, run worker (or wait for schedule).
2. Expect either one new digest with new relevant items, or no digest if none qualify.
3. Re-run worker immediately → **0 duplicate** publications/digest entries for already-processed items.
4. First-ever run uses ~30-day bootstrap; later runs use `lastSuccessfulRunAt`.

### V3 — Partial source failure (FR-020)

1. Configure two sources; force one to fail (invalid RSS URL).
2. Ensure the other returns qualifying items.
3. Expect digest published, run `completed_partial_failure`, watermark advanced.

### V4 — Pause / resume (FR-022)

1. Pause monitoring → worker skip; digests still public; watermark unchanged.
2. Resume → next due run uses frozen watermark.

### V5 — Email (SC-006)

1. Enable notification → publish digest → owner receives short link-only email within 10 minutes.
2. Disable → publish again → zero notification emails.

### V6 — i18n + translation cache (SC-004)

1. Switch UI among `en`, `de`, `tr`, `ru`, `uk` → chrome localized.
2. First request for a publication in `de` may wait for generation; second request for same pair is served from cache (no full regenerate delay).

---

## Automated gates (Principle IX)

```bash
pnpm lint
pnpm format:check
pnpm exec tsc --noEmit
pnpm --filter web build
pnpm test          # Jest domain/pipeline
pnpm test:e2e      # Playwright public + admin flows
```

CI on every PR must run the same set as a required status check.

---

## References

- Data model: [`data-model.md`](./data-model.md)
- Public API: [`contracts/public-api.md`](./contracts/public-api.md)
- Admin API: [`contracts/admin-api.md`](./contracts/admin-api.md)
- Worker: [`contracts/monitoring-worker.md`](./contracts/monitoring-worker.md)
- Research decisions: [`research.md`](./research.md)
