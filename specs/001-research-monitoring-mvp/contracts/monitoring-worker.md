# Monitoring Worker Contract

**Feature**: `001-research-monitoring-mvp`  
**Runtime**: Dockerized Node.js on GCP Cloud Run Jobs  
**Trigger**: GCP Cloud Scheduler → Cloud Run Jobs `:run` (single frequent job; app decides due projects)

---

## Entry point

Container command runs once and exits:

```text
node dist/index.js
# or: pnpm --filter worker start
```

**Env (required)**:

- `DATABASE_URL` or CMS base URL + `PAYLOAD_API_KEY` (preferred: talk to Payload REST)
- `AI_GATEWAY_API_KEY` (or equivalent for Vercel AI Gateway)
- `RESEND_API_KEY` (digest email)
- `PUBLIC_SITE_URL` (absolute links in email)
- `BOOTSTRAP_LOOKBACK_DAYS` (default `30`)
- `BATCH_SIZE_PER_SOURCE` (default `50`)

---

## Due-project selection

A project is **due** when all of:

1. `monitoringStatus === active`
2. ≥1 enabled `MonitoredSource`
3. `keywords.length ≥ 1`
4. Schedule elapsed since `lastSuccessfulRunAt` (or never run):
   - `daily`: ≥ 24h since last success (or null)
   - `weekly`: ≥ 7d
   - `monthly`: ≥ 28d (calendar-simple MVP)

Paused projects are skipped; watermark unchanged.

---

## Pipeline steps (per due project)

1. Create `MonitoringRun` (`status=running`, `triggeredBy=schedule|manual`)
2. For each enabled source (isolate failures):
   - Fetch candidates matching **any** keyword (OR)
   - Window: if `lastSuccessfulRunAt` null → bootstrap lookback; else since watermark
   - Cap at `BATCH_SIZE_PER_SOURCE`
   - Record per-source success/failure in `sourceResults`
3. Dedupe → classify → (if relevant) summarize + importance
4. If ≥1 qualifying publication → create `Digest`, send optional email
5. Set run terminal status:
   - all sources ok → `completed`
   - some source failed but run finished others → `completed_partial_failure`
   - catastrophic / no sources processed → `failed` (do not advance watermark)
6. On `completed` | `completed_partial_failure` → set `lastSuccessfulRunAt`

---

## Source adapter interface (logical)

```ts
type FetchCandidatesInput = {
  keywords: string[]; // OR semantics
  since: Date | null; // null → apply bootstrapLookbackDays
  bootstrapLookbackDays: number;
  limit: number;
  rssUrl?: string;
};

type Candidate = {
  externalIds: { pmid?: string; doi?: string; nctId?: string; guid?: string };
  title: string;
  abstractOrBody?: string;
  originalUrl: string;
  publishedOrUpdatedAt?: Date;
  sourceType: 'pubmed' | 'clinicaltrials' | 'rss';
};

interface SourceAdapter {
  fetchCandidates(input: FetchCandidatesInput): Promise<Candidate[]>;
}
```

Adapters MUST throw/return typed errors so the runner can mark that source failed without aborting sibling sources.

---

## Idempotency

- Re-fetch of known `dedupeKey` → skip classify/summarize
- Re-run of job must not create duplicate digests for the same logical run identity; use run record as authority

---

## Exit codes

| Code     | Meaning                                                                    |
| -------- | -------------------------------------------------------------------------- |
| `0`      | Job finished; individual project/run failures recorded in DB               |
| non-zero | Infrastructure failure (DB unreachable, missing env) — Scheduler may retry |
