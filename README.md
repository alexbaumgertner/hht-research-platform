# HHT Research Platform

Topic-agnostic research monitoring: configure sources in Payload Admin, run a Dockerized worker to fetch → dedupe → classify → summarize → publish digests, and read a public locale-prefixed feed.

## Stack

- `apps/web` — Next.js 16 + Payload CMS 3 + Mantine + next-intl (Vercel)
- `apps/worker` — Cloud Run Job monitoring pipeline
- `packages/shared` — Zod types, dedupe, schedule helpers

See `specs/001-research-monitoring-mvp/` for the full Spec Kit plan, data model, and contracts.

## Setup

```bash
pnpm install
cp .env.example .env   # fill DATABASE_URL, PAYLOAD_SECRET, etc.
docker compose up -d   # optional local Postgres
pnpm --filter @hht/shared build
pnpm --filter @hht/web dev
```

Admin: `/admin` · Public: `/en` (also `de`, `tr`, `ru`, `uk`)

Seed a demo public feed:

```bash
pnpm --filter @hht/web seed:public-feed
```

Manual worker run:

```bash
pnpm --filter @hht/worker start
```

Docker worker:

```bash
docker build -t hht-monitor-worker -f apps/worker/Dockerfile .
docker run --env-file .env hht-monitor-worker
```

## Owner setup (SC-001)

1. Open `/admin` and sign in.
2. Create a Research Project (name, slug, description, keywords).
3. Add at least a PubMed monitored source; optionally ClinicalTrials.gov and RSS.
4. Set schedule (`daily` / `weekly` / `monthly`) and leave monitoring active.
5. Optionally enable email notification.
6. Target: complete this under 15 minutes.

Details: [`specs/001-research-monitoring-mvp/quickstart.md`](specs/001-research-monitoring-mvp/quickstart.md).

## Quality gates

```bash
pnpm lint
pnpm format:check
pnpm typecheck
pnpm --filter @hht/web build
pnpm test
pnpm test:e2e
```

## License

MIT
