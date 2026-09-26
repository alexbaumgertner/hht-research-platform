# Cloud Agent Setup

Cloud Agents auto-discover this setup via `.cursor/environment.json` (`install` runs
`.cursor/install.sh`, `start` runs `.cursor/start.sh`). The steps below are the same
ones for any agent bootstrapping the project manually.

## Bootstrap

```bash
source .cursor/node-env.sh   # Node 24 via nvm (source, so PATH persists)
bash .cursor/install.sh      # PostgreSQL 16 + pnpm install + .env.local + shared build
bash .cursor/start.sh        # start Postgres, ensure payload role/db, push Payload schema
```

## Verify

```bash
pnpm lint && pnpm format:check && pnpm typecheck
pnpm --filter @hht/web build
pnpm test          # Jest unit/integration tests
pnpm test:e2e      # Playwright end-to-end tests
```

## Secrets (add via Cursor dashboard, not committed)

- `AI_GATEWAY_API_KEY` — optional, enables AI summaries
- `RESEND_API_KEY` — optional, enables email notifications

## Notes

- `apps/web/.env.local` is gitignored and recreated by `install.sh`.
- Postgres runs natively (not Docker) in the Cloud Agent VM.
- `start.sh` handles a stale `postmaster.pid` left in disk snapshots.
