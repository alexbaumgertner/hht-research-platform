See [AGENTS.md](./AGENTS.md) for environment setup and verification commands.

## Stack

pnpm monorepo: `apps/web` (Next 16 App Router + Payload CMS 3, Postgres/Neon via
`@payloadcms/db-postgres`, Mantine, next-intl), `apps/worker` (ingest/digests),
`packages/shared` (Zod schemas, shared logic). Tests: Jest + Playwright. Deploy: Vercel.

## Commands (truncate output: `2>&1 | tail -50`)

- `pnpm check`: typecheck + lint + unit tests
- `pnpm format:check`, `pnpm test:e2e`
- `pnpm --filter @hht/web generate:types` after changing Payload collections
- `pnpm db:generate` / `pnpm db:migrate`: Payload migrations (ask first)

## Conventions

- Payload collections are the schema source of truth; never hand-edit `payload-types.ts`.
- Shared Zod schemas live in `packages/shared`.
- Features go through Spec Kit: `specs/NNN-*/` (spec → plan → tasks). Decisions recorded in `docs/` are settled.
- Never point a local process at the production database.

## Workflow

- Tests first from the spec's acceptance criteria; small focused commits.
- Ask when a requirement is ambiguous instead of guessing.
