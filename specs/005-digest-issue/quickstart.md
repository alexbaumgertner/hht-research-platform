# Quickstart: Weekly Digest Issue

**Branch**: `005-digest-issue` | **Spec**: [`spec.md`](./spec.md)

Runnable checks that prove the feature end-to-end. Contracts:
[`public-issues-api.md`](./contracts/public-issues-api.md),
[`worker-issue-text.md`](./contracts/worker-issue-text.md),
[`issue-pages.md`](./contracts/issue-pages.md). Schema: [`data-model.md`](./data-model.md).

## Prerequisites

- Local Postgres via `DATABASE_URL` (`docker compose up -d`), then
  `pnpm --filter @hht/shared build && pnpm --filter @hht/web ensure-schema`. The new fields and the
  `issue-translations` table are created by the same push. There is no migration script.
- `pnpm install` at the repo root. No new npm packages are expected (`next/og` ships with Next;
  `ai` and `@ai-sdk/gateway` are already web dependencies).
- The fonts `apps/web/assets/fonts/IBMPlexSans-{Regular,SemiBold}.ttf` are committed, along with
  their OFL license.
- Seed: `pnpm --filter @hht/web seed:public-feed`. For this feature the seed also creates:
  - a digest with `issueTextStatus: ready`, 3 summary points (with item refs), and one sentence
    per item, including one ClinicalTrials.gov item;
  - a digest with `issueTextStatus: pending` and no text (the "summary unavailable" path);
  - a digest with `hiddenFromPublic: true`, whose materials are still in the feed.
- For translation checks without spending on an LLM, start the web app with
  `ISSUE_TRANSLATOR=stub ISSUE_TRANSLATOR_STUB_DELAY_MS=3000`.

## 1. Read an issue (US1, US3)

```bash
ISSUE_TRANSLATOR=stub ISSUE_TRANSLATOR_STUB_DELAY_MS=3000 pnpm dev
```

Open `http://localhost:3000/en/projects/hht-research` → "Read this issue".

| Check                       | Expected                                                                                                       |
| --------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Header                      | Issue date in `<h1>`, then 3–5 summary points (FR-003)                                                         |
| "Based on" links            | Each point jumps to `#item-{id}` in the list below (FR-007)                                                    |
| Item list                   | Title, source badge, date, one sentence each; importance order (FR-004, FR-008)                                |
| Trial item                  | "Registered study, no results yet" label; its sentence claims no results (FR-006)                              |
| Title click                 | Opens the existing material detail page in the same tab                                                        |
| Disclaimer and AI label     | Visible on the issue page **and** on the material detail page (FR-011)                                         |
| Pending-text digest         | Item list and titles render; "summary not available yet" line (FR-015)                                         |
| 360 px, JavaScript disabled | DevTools → 360 px width, disable JavaScript: all content readable, anchors work, no horizontal scroll (FR-016) |

## 2. Archive and project page (US4)

| Check         | Expected                                                                                                                                                                            |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Project page  | Latest issue card (date + excerpt) above the unchanged flat feed (FR-019)                                                                                                           |
| `…/issues`    | Every visible issue, newest first, each linking to its page (FR-002)                                                                                                                |
| Hidden digest | Absent from the archive; its URL → 404 and its `opengraph-image` serves the generic project card (no issue details); its materials still in the feed and detail pages (FR-021, R10) |

## 3. Translation: wait, fallback, single-flight, invalidation (US5)

With the stub delay at 3000 ms, open `/ru/projects/hht-research/issues/{id}` for the first time.
The page takes about 3 s and shows Russian (stub `[ru] …`) text. Reload: it is instant.

Fallback path: restart with `ISSUE_TRANSLATOR_STUB_DELAY_MS=12000`, then open `/uk/…/issues/{id}`.
After about 8 s the page shows English with the "not translated yet" note. About 4 s later the
row is `ready`, and a reload shows Ukrainian.

Single-flight across concurrent requests (the DB guarantee; delete the `de` row first in the
admin, or through the test-only reset route that exists under `ISSUE_TRANSLATOR=stub`):

```bash
seq 8 | xargs -P 8 -I{} curl -s -o /dev/null -w "%{http_code} %{time_total}\n" \
  "http://localhost:3000/api/public/projects/hht-research/issues/<id>?locale=de"
```

Expected: eight `200`s. The admin → Issue translations shows **one** `de` row for that issue with
`attempts = 1`, and the dev-server log shows **one** translator invocation. To check that this
holds across instances, run a second server on another port (`PORT=3001 pnpm start` after
`pnpm build`), point half of the requests at each, and expect the same single row.

Invalidation (FR-021): in the admin, edit one English summary point and save. Its `ru`/`de`/`uk`
rows disappear, `issueTextRevision` goes up by 1, and the next `/ru/…` request re-translates the
edited text.

Regeneration: set `issueTextStatus` to "Queued" and save. `issueTextAttempts` resets to 0. The next
worker run (§5) regenerates the text and the translations are invalidated again.

## 4. Share previews (US2)

```bash
curl -s -A 'TelegramBot (like TwitterBot)' "http://localhost:3000/ru/projects/hht-research/issues/<id>" \
  | sed -n '/<head>/,/<\/head>/p' | grep -E 'og:(title|description|image)|twitter:card|<title>'
curl -s -o /tmp/og.png -w "%{http_code} %{content_type} %{size_download}\n" \
  "http://localhost:3000/ru/projects/hht-research/issues/<id>/opengraph-image"
```

Expected: every tag is inside `<head>`, the title is "{project} · {localized date}", the
description is the first summary point, `og:image` is an absolute URL, and the image returns
`200 image/png` at well under 300 KB with Cyrillic rendered correctly. Repeat with
`-A 'facebookexternalhit/1.1'`, `-A 'WhatsApp/2.23'`, and `-A 'vkShare'`.

**Production** (after deploy, SC-001): paste an issue URL into Telegram (or use `@WebpageBot` to
refresh the cache), VK, WhatsApp, and the Facebook Sharing Debugger. Each shows the title,
description and image in the chosen locale.

## 5. Worker: sweep and anchored schedule

Unit level:

```bash
pnpm --filter @hht/shared test    # schedule anchor table, compareIssueItems
pnpm --filter @hht/worker test    # validateIssueText, guards, sweep selection/transitions
```

Local end-to-end generation (optional, needs `AI_GATEWAY_API_KEY`): with the web app running,
set a seeded digest to "Queued", then

```bash
PUBLIC_SITE_URL=http://localhost:3000 PAYLOAD_API_KEY=<local key> AI_GATEWAY_API_KEY=<key> \
  pnpm --filter @hht/worker dev
```

Expected logs: `sweep start` → `issue text generated { digestId }`, and the digest is `ready` with
3–5 points and one sentence per item. To force a failure, use an invalid `AI_GATEWAY_API_KEY`.
Expect an ERROR line `issue text generation failed` and `issueTextAttempts` + 1. After 3 runs the
digest is no longer selected.

## 6. Automated checks

```bash
pnpm lint && pnpm format:check && pnpm typecheck
pnpm test
pnpm --filter @hht/web seed:public-feed && pnpm test:e2e
```

Expect these new or updated specs to pass:

- `packages/shared/src/schedule.test.ts`: anchored due and stale cases (contract §3.3).
- `packages/shared/src/issueOrder.test.ts`: importance → date → id ordering.
- `apps/worker/src/pipeline/issueText.test.ts`: mapping, validation limits, guard patterns, retry once.
- `apps/worker/src/pipeline/issueSweep.test.ts`: selection filter, `failed` attempt cap, per-digest isolation.
- `apps/web/src/lib/issues.test.ts`: DTO mapping, fallback flags, and `meta.description` truncation.
- `apps/web/src/lib/issueTranslation.test.ts`: claim, wait and reclaim state machine on a
  unique-key fake store (lost race → waiter; expired lease → reclaim by id; cooldown respected;
  revision mismatch → reclaim).
- `apps/web/src/collections/digestHooks.test.ts`: revision bump on text change only, attempts
  reset on re-queue, and an **owner** edit (admin session) on a `pending`/`failed` digest →
  `ready` + `edited`, while a worker write (header key or `worker` role) keeps
  `generated` and its own status. An owner edit plus re-queue in one save → `pending`.
- `apps/web/tests/e2e/public-issue.spec.ts`: US1–US4 flows, hidden → 404 while materials stay in
  the feed, 360 px with JavaScript disabled, and the trust notice in 5 locales.
- `apps/web/tests/e2e/issue-translation.spec.ts`: 8 concurrent requests → one row with
  `attempts === 1`; slow stub → English + note, then translated on reload. The spec uses a
  seeded digest reserved for it and clears its rows first through the test-only reset route, so
  CI retries (`retries: 2`) start from "no row". It proves the constraint in one process; the
  cross-instance check is manual (§3).
- `apps/web/tests/e2e/share-metadata.spec.ts`: `TelegramBot` user agent → `og:*` with an absolute
  `og:image` in `<head>` on the **issue, archive and material detail** pages, and the image
  route returns PNG.
- `apps/worker/src/pipeline/issueSweep.test.ts` also covers: a 4xx on the selection query →
  WARN and no PATCH; a 5xx → ERROR.

CI adds `seed:public-feed` after `ensure-schema`, so the seeded specs run in the required check
(research R16). This is the first task and is merged or fixed before feature code: it also
turns on the existing seeded tests in `public-feed`, `public-material-detail` and
`monitoring-digest`, which skip in CI today.

## 7. Production rollout checklist

1. Set `AI_GATEWAY_API_KEY` (and optionally `AI_GATEWAY_MODEL`) on Vercel for Production and
   Preview.
2. Merge. The Vercel build pushes the additive schema. The worker image deploys in parallel;
   either order is safe (research R15). If the worker lands first, a WARN
   `sweep skipped: cms rejected query` in that window is expected. An ERROR is not.
3. Within the next hourly tick: both historical digests (2026-08-31, 2026-09-22) are `ready`.
   Review their text by hand (SC-004).
4. In the admin, set project `hht` to `schedule: weekly`, `publishWeekday: monday`,
   `publishHourUtc: 4`, and fill in `audienceContext`.
5. `/api/health` stays `200` through the week (anchor-aware staleness).
6. Monday 04:00 UTC: the first weekly issue publishes without manual action. The second Monday
   confirms SC-003.
7. Share-preview check in Telegram, VK and WhatsApp (§4). The **first** Telegram check uses a
   locale with no cached translation, to see whether the up-to-8 s blocking wait (research R11)
   costs the preview.
8. Weekly routine for the chat admin: before posting a link, open the issue once in the chat's
   locale (for example `/ru/…`) and wait until the page shows translated text. The crawler then
   gets the cached translation immediately. Then post.

## Done when

The US1–US6 acceptance scenarios pass manually and in Playwright; §3's single-flight check shows
exactly one translation per issue+locale; the rollout checklist through step 6 is complete; and
CI (Layer 3) is green on the PR.
