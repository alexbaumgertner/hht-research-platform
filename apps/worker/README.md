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
docker build --platform linux/amd64 -t hht-monitor-worker -f apps/worker/Dockerfile .
docker run --env-file .env hht-monitor-worker
```

### GCP deploy

Production updates go through GitHub Actions (`.github/workflows/deploy-worker.yml`) on relevant pushes to `main`. Full guide (one-time GCP setup, WIF for CI, Scheduler, Vercel connect): [`docs/deploy-worker.md`](../../docs/deploy-worker.md).
