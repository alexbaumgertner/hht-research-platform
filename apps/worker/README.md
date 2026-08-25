## Monitoring worker

Dockerized Node.js job for GCP Cloud Run Jobs, triggered by a single Cloud Scheduler job (e.g. hourly).

### Local

```bash
pnpm --filter @hht/shared build
pnpm --filter @hht/worker start
```

Required env: `PUBLIC_SITE_URL`, `PAYLOAD_API_KEY`, `AI_GATEWAY_API_KEY`. Optional: `RESEND_API_KEY`, `BOOTSTRAP_LOOKBACK_DAYS`, `BATCH_SIZE_PER_SOURCE`.

### Docker

```bash
docker build -t hht-monitor-worker -f apps/worker/Dockerfile .
docker run --env-file .env hht-monitor-worker
```

### GCP deploy notes

1. Build and push the image to Artifact Registry.
2. Create a Cloud Run Job pointing at the image with the env vars above.
3. Create **one** Cloud Scheduler job that invokes the Cloud Run Job on an hourly cadence.
4. Per-project `daily` / `weekly` / `monthly` schedules are enforced in application logic (`isProjectDue`), not as separate Scheduler jobs (free-tier: ≤3 Scheduler jobs).
