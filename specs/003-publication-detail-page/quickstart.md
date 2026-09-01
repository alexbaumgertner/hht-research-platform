# Quickstart: Publication Detail Page

**Branch**: `003-publication-detail-page` | **Spec**: [`spec.md`](./spec.md)

Validates the detail page and feed-title change end-to-end. Run after implementation, before
`/speckit-tasks` marks the feature complete. No schema migration and no backfill.

## Prerequisites

- Local Postgres via `DATABASE_URL`; Payload schema already from 001/002
  (`pnpm --filter @hht/web ensure-schema`).
- Seeded public feed (`pnpm --filter @hht/web seed:public-feed`) so `hht-research` has published
  materials with mixed sources, at least one high-importance item, and at least one abstract.
- `pnpm install` at the repo root (no new packages for this feature).

## 1. Seed (reuse existing)

```bash
pnpm --filter @hht/web seed:public-feed
```

For a thorough pass, the seed (or a one-off admin edit) should include:

- A published material with `abstractOrBody`, a full structured summary, `originalUrl`, date, and
  high importance.
- A published material with summary but **no** `abstractOrBody`.
- A published material with abstract but **empty** summary sections.
- An unpublished publication (no `feedPublishedAt`) whose id you can paste into the detail URL.
- One non-English translation of title + summary (to see the fallback note vs abstract note).

## 2. Manual verification

```bash
pnpm dev
```

Open `http://localhost:3000/en/projects/hht-research`.

| Check                       | Expected (spec)                                                                                                   |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Feed title                  | Same-tab navigation to `/en/projects/hht-research/publications/{id}` (FR-001)                                     |
| No new-tab chrome           | Zero visible “opens in a new tab” on the feed (FR-002, FR-027)                                                    |
| Feed titles                 | Not `target="_blank"`; not the publisher URL (FR-017)                                                             |
| Detail order                | Header (title, source, date, importance) → summary sections → abstract (FR-025)                                   |
| Abstract                    | Full stored text after summary; omitted if empty (FR-008, FR-009)                                                 |
| Empty summary sections      | No blank headings (FR-011)                                                                                        |
| Missing summary             | Page still renders title/source/abstract/link (FR-012)                                                            |
| Original link               | Labeled, `target="_blank"`, detail tab remains (FR-014, FR-026)                                                   |
| Missing original URL        | No broken link (FR-016)                                                                                           |
| High importance             | Header accent + tint + muted label, not a full-page wash (FR-029)                                                 |
| Date missing                | Date omitted, rest of header intact (FR-028)                                                                      |
| Back to feed                | `/en/projects/hht-research` (filters not required) (FR-005)                                                       |
| Unpublished / junk id       | Not-found copy, not load-error; no abstract/summary leaked (FR-030)                                               |
| Forced 5xx                  | Distinct load-error + retry; header/locale still there (FR-031)                                                   |
| Locales `de` `tr` `ru` `uk` | Chrome translated; summary follows feed fallback; abstract still visible with note if locale ≠ en (FR-018–FR-020) |
| Narrow 320px                | Single column, wrap, no horizontal scroll (FR-022)                                                                |
| Keyboard                    | Title, back, original link, retry (when shown) have visible focus (FR-023)                                        |
| Copy                        | No reader-visible word “publication” (FR-021)                                                                     |

Wrong-project check: `{id}` from `hht-research` under another slug → not-found.

## 3. Automated checks

From repo root (or `apps/web` as existing scripts expect):

```bash
pnpm --filter @hht/web test
pnpm --filter @hht/web test:e2e
```

Expect:

- `src/lib/materials.test.ts` — `toMaterialDetail` cases (empty sections, null abstract,
  importance collapse, placeholder title).
- `tests/e2e/public-feed.spec.ts` — titles point at `/publications/`; no outbound new-tab on
  cards (this **inverts** 002 assertions).
- `tests/e2e/public-material-detail.spec.ts` — order, original `target="_blank"`, not-found
  wording for a bogus id.

Layer 1 (agent stop hook) and CI still run lint, format, `tsc`, `next build`, Jest, Playwright.

## 4. Contract smoke (optional)

With the dev server up:

```bash
# 200 published
curl -sS "http://localhost:3000/api/public/projects/hht-research/materials/<id>?locale=en"

# 404 unpublished or unknown
curl -sS -o /dev/null -w "%{http_code}\n" \
  "http://localhost:3000/api/public/projects/hht-research/materials/000000000000000000000000"

# old route gone
curl -sS -o /dev/null -w "%{http_code}\n" \
  "http://localhost:3000/api/public/publications/<id>"
```

Last call should be 404, not a JSON publication body.

## 5. Done when

Acceptance scenarios for US1–US3 in `spec.md` pass manually and in Playwright; `quickstart.md`
checks above are green; Constitution Layer 3 CI is green on the PR.
