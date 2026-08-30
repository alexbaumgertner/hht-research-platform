# Quickstart: Research Materials Feed

**Branch**: `002-research-materials-feed` | **Spec**: [`spec.md`](./spec.md)

Validates the feed end-to-end against the acceptance scenarios in `spec.md`. Run after
implementation, before `/speckit-tasks` marks the feature complete.

## Prerequisites

- Local Postgres reachable via `DATABASE_URL` (see `.env.example`), Payload schema pushed
  (`pnpm --filter @hht/web ensure-schema`).
- The schema changes in `data-model.md` applied (four new fields; run `generate:types` after
  editing collections: `pnpm --filter @hht/web generate:types`).
- `pnpm install` at the repo root (pulls in the new `@tabler/icons-react` dependency).

## 1. One-time data migration (required before this feature is usable)

Before this deploys, any project with existing published digests will show an **empty** feed
until `feedPublishedAt` is backfilled (see `research.md` R2). Run the backfill once:

```bash
pnpm --filter @hht/web exec tsx src/scripts/backfill-feed-published-at.ts
```

Expected output: one line per project with a count of publications updated. Re-running is
harmless (idempotent — only sets the field when unset).

## 2. Seed a representative dataset

Extend (or run alongside) the existing seed script so a manual check can exercise every
acceptance scenario in one pass:

```bash
pnpm --filter @hht/web seed:public-feed
```

The seeded project (`hht-research`) should end up with:

- At least one material per source category (`pubmed`, `trials`, `news`, `guideline`, `social`) —
  this requires at least one `monitored-sources` row of `type: rss` tagged `guideline` and one
  tagged `social`, each producing ≥1 published material.
- At least one `importance: high` and one `importance: normal` material.
- One material with no `summary`.
- One material with a `title`/`summary` translated into at least one non-English locale, and one
  left untranslated (to exercise the fallback note).
- One material with `publishedOrUpdatedAt` unset (to exercise "sorts last, no date shown").

## 3. Manual verification against acceptance scenarios

Start the dev server:

```bash
pnpm dev
```

Then, in a browser, for each locale (`en`, `de`, `tr`, `ru`, `uk`) at
`http://localhost:3000/{locale}/projects/hht-research`:

| Check                  | Expected (spec reference)                                                                                                                     |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Initial load           | Single column, newest-first, no loading flash (FR-004, FR-032)                                                                                |
| Badges                 | 5 distinct badges, icon + label, legible in light **and** dark (toggle OS scheme) (FR-016, FR-017)                                            |
| High-importance items  | Soft left accent + faint tint + muted label — not a loud/red badge (FR-020, FR-021)                                                           |
| Click a title          | Opens `url` in a new tab; page underneath unchanged (FR-006, FR-007)                                                                          |
| Search                 | Typing filters by title/summary in the active locale, case-insensitive (FR-023)                                                               |
| Source chips           | Deselecting all ⇒ shows all, not empty (FR-025); selecting a subset filters correctly (FR-024)                                                |
| High-importance switch | Restricts to `high` only; toggling off restores the rest (FR-026)                                                                             |
| Combined filters       | Search + chips + switch narrow together (FR-027)                                                                                              |
| Visible count          | Updates with every filter change (FR-028)                                                                                                     |
| No-materials-at-all    | Seed a project with zero published digests → distinct empty message, no "clear filters" prompt (FR-030)                                       |
| No-matches             | Filter to something with no results → distinct message + working "clear filters" (FR-031)                                                     |
| Load failure           | Temporarily break `DATABASE_URL` or stop Postgres → inline error with retry; header and language switcher still usable (FR-033, FR-034)       |
| Language switch        | Chrome and material content both change; search/chips/switch survive the switch (FR-040)                                                      |
| Fallback note          | An untranslated material shows English content with a small "shown in English" (or equivalent) note (FR-038)                                  |
| Untitled material      | (Hard to seed naturally — verify via unit test instead, see below) placeholder built from source + date, still linked, still counted (FR-039) |
| Keyboard only          | Tab through search, chips, switch, language control — every stop has a visible focus ring (FR-046)                                            |
| Narrow viewport        | Resize to 320px — header/controls stack, no horizontal scroll (FR-044)                                                                        |

## 4. Automated checks

```bash
pnpm test          # Jest: badge resolution, importance mapping, locale fallback, eligibility gate
pnpm test:e2e       # Playwright: full feed flow, replacing tests/e2e/public-feed.spec.ts's
                     # digest-grouped assertions with flat-feed assertions
```

Existing tests requiring updates (not new files, listed for visibility — actual work items belong
in `tasks.md`):

- `apps/web/tests/e2e/public-feed.spec.ts` — currently asserts digest-grouped structure and the
  four-level `ImportanceFilter`; must assert the new flat feed and its controls instead.
- `apps/web/tests/e2e/monitoring-digest.spec.ts` — check it doesn't assert against the removed
  `/api/public/projects/:slug/digests` route.

New unit test coverage expected (Jest, pure logic — no DB needed):

- Source badge resolution table (R3) — all five outcomes plus the unrecognised-source fallback.
- Importance collapse (`critical`/`high` → `high`, `medium`/`low`/`null` → `normal`).
- Locale/title/summary fallback resolution (R5) — hit, miss, partial-miss cases.
- Client-side filter combination logic (search ∧ sources ∧ importance), including the
  empty-selection-means-all rule (FR-025).
- Empty-project vs. no-matches state selection logic.

## 5. Definition of done for this quickstart

- [ ] Backfill script run successfully against a database with pre-existing published digests
- [ ] All rows in the manual verification table checked in all 5 locales
- [ ] `pnpm test` and `pnpm test:e2e` green
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm build` green (Constitution Principle IX, Layer 1/3 gates)
