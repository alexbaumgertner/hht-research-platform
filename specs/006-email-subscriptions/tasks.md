---
description: 'Task list for email subscriptions and chat delivery'
---

# Tasks: Email Subscriptions and Chat Delivery

**Input**: Design documents from `/specs/006-email-subscriptions/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: Explicitly requested by the plan (Jest + Playwright are part of the Constitution's
quality gate, Principle IX). Test tasks are included and precede the implementation they cover
where practical. Live mailbox placement and a live VK post stay manual (quickstart.md §8).

**Organization**: Tasks are grouped by user story so each story can be implemented and tested
on its own, in the order from [plan.md](./plan.md) §"Implementation Notes (for `/speckit-tasks`)".

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1–US6)
- Every task includes exact file paths.

## Path Conventions

Existing pnpm monorepo: `apps/web/src/`, `apps/worker/src/`, `packages/shared/src/`. No new
deployable and no new npm packages (per plan.md "Project Structure" and "Constraints").

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Record the new environment names before feature code lands. No packages to add.

- [x] T001 Add `RESEND_WEBHOOK_SECRET`, `VK_COMMUNITY_TOKEN`, and `EMAIL_DELIVERY` to `.env.example`, with comments that `EMAIL_DELIVERY=stub` is honored only when `VERCEL_ENV` is not `production`, that `VK_COMMUNITY_TOKEN` belongs on the worker only, and that `RESEND_FROM_EMAIL` must leave `@resend.dev` before anyone except the owner is mailed (research R12, contract [admin-and-webhooks.md](./contracts/admin-and-webhooks.md) §5). Do not add npm dependencies.

**Checkpoint**: Env names match the contracts. `pnpm install` is unchanged.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared pure rules and the five collections every story reads. No user story work
can begin until this phase is complete.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

### Shared rules (`packages/shared`)

- [x] T002 [P] Implement `normalizeSubscriberEmail` in `packages/shared/src/subscriberEmail.ts` and cover it in `packages/shared/src/subscriberEmail.test.ts`: trim, lowercase, plus-tags kept, so `User@Example.com` and `user@example.com` match and `user+hht@gmail.com` does not (FR-007, research R3).
- [x] T003 [P] Implement `parseChatSource` in `packages/shared/src/chatSource.ts`: allow-list `vk` | `wa` | `fb` | `tg`, anything missing or unknown is `other` (FR-006).
- [x] T004 [P] Implement the delivery state helpers in `packages/shared/src/deliveryDecision.ts` and cover them in `packages/shared/src/deliveryDecision.test.ts`: one claim wins and the loser does not send; a `sent` row is not sent again; a hidden issue moves `pending` to `skipped`; Russian inside 6 hours of `publishedAt` waits; Russian after 6 hours is the English body plus the fixed Russian note; a 429 quota does not increase `attempts`; the failure that sets `attempts` to 4 becomes `failed` (quickstart.md §2, contract [delivery-sweep.md](./contracts/delivery-sweep.md) §3–§4).
- [x] T005 [P] Implement `buildIssueEmail` in `packages/shared/src/issueEmailBody.ts` and cover it in `packages/shared/src/issueEmailBody.test.ts`. Inputs are the issue DTO, language, sender name, and link slots (issue, privacy, unsubscribe). Plain text and HTML carry the same information, in the order in contract [public-subscriptions.md](./contracts/public-subscriptions.md) §7. After every `http` substring is deleted, the plain text still contains the project name, date, every summary point, each item's title, source, date, and sentence, the trial label, the disclaimer, and the AI label (quickstart.md §2). Do not hardcode a disease or product name.
- [x] T006 [P] Implement `buildChatPosts` in `packages/shared/src/chatPost.ts` and cover it in `packages/shared/src/chatPost.test.ts`: eight plain-text posts; VK includes every item (limit 16384); Telegram, WhatsApp, and Facebook include the first 3 in issue order (limits 4096 UTF-16, 65536, 63206) plus a "N more" line; over-limit posts drop the lowest-ranked included items and keep the summary, disclaimer, and both `src` links; omit the "more" line when the count is zero (contract [delivery-sweep.md](./contracts/delivery-sweep.md) §8, quickstart.md §4).
- [x] T007 Re-export the modules from T002–T006 from `packages/shared/src/index.ts`.

### Schema (data-model.md)

- [x] T008 [P] Create `apps/web/src/collections/Subscribers.ts` per data-model.md §1: fields, unique `(project, email)`, unique indexes on `confirmationTokenHash` and `unsubscribeTokenHash`, admin columns `email`, `language`, `source`, `status`, `consentAt`, token fields hidden, owner may set `unsubscribed` or delete, no field that composes an email (FR-028).
- [x] T009 [P] Create `apps/web/src/collections/IssueDeliveries.ts` per data-model.md §2, including unique `(digest, subscriber)` and unique `clickTokenHash`. Omit `clicked` and `clickTokenHash` from every admin list, filter, and default column (FR-039).
- [x] T010 [P] Create `apps/web/src/collections/VkPosts.ts` per data-model.md §3, unique `(digest, vkCommunityId)`. Do not add a token field.
- [x] T011 [P] Create `apps/web/src/collections/AnalyticsCounts.ts` per data-model.md §4, unique `(project, issueKey, source, metric)`.
- [x] T012 [P] Create `apps/web/src/collections/SubscribeRateLimits.ts` per data-model.md §5: `keyHash` indexed, no unique index.
- [x] T013 [P] Add `subscriberFanoutAt`, `subscriberSendBlockedAt`, and `ownerKitSentAt` to `apps/web/src/collections/Digests.ts` (data-model.md §6). An edit or regenerate must not clear `subscriberFanoutAt`.
- [x] T014 [P] Add `emailFromName` and `vkCommunityId` to `apps/web/src/collections/ResearchProjects.ts` (data-model.md §7). Empty `vkCommunityId` means VK is off. Leave `emailNotificationEnabled` unchanged.
- [x] T015 [P] Implement the anonymous upsert in `apps/web/src/lib/analyticsCounts.ts`: `+1` on `(project, issueKey, source, metric)` for `page_view`, `form_submit`, and `confirmation` (research R17). The helper must not read the `src` cookie.
- [x] T016 Register `Subscribers`, `IssueDeliveries`, `VkPosts`, `AnalyticsCounts`, and `SubscribeRateLimits` in `apps/web/src/payload.config.ts`.
- [ ] T017 Verify the additive schema: run `pnpm --filter @hht/shared build && pnpm --filter @hht/web ensure-schema` against local Postgres (`docker compose up -d`) and confirm no rename prompts (data-model.md intro, quickstart.md Prerequisites).

**Checkpoint**: Collections exist, shared tests pass (`pnpm --filter @hht/shared test`), and user-story work can start.

---

## Phase 3: User Story 1 - Subscribe with double opt-in (Priority: P1) 🎯 MVP

**Goal**: A reader on an issue or project page can submit an address with consent, confirm from the email, and show up in the admin with source and language. A new subscriber receives the latest visible issue when it is at most 14 days old.

**Independent Test**: Open an issue page with `?src=tg`, submit an address with consent, follow the confirmation link from the email stub, and confirm the admin shows one confirmed subscriber for that project with source `tg` and the chosen language (spec.md US1, quickstart.md §1).

### Tests for User Story 1

- [x] T018 [P] [US1] Add failing Jest cases in `apps/web/src/lib/subscriptionTokens.test.ts`: a token is 32 random bytes encoded base64url, only the SHA-256 hash is stored, and the token string does not contain the email address (research R6).
- [x] T019 [P] [US1] Add failing Jest cases in `apps/web/src/lib/subscribeRateLimit.test.ts`: more than 5 submissions for one IP hash in an hour are rejected, and the stored key is the SHA-256 of `PAYLOAD_SECRET` plus the IP, not the raw IP (FR-008, research R16).
- [x] T020 [P] [US1] Add failing Playwright coverage in `apps/web/tests/e2e/subscriptions.spec.ts` for quickstart.md §1, with `EMAIL_DELIVERY=stub`: form at 360px with JavaScript disabled, consent required and nothing stored, "check your inbox" plus one confirmation, confirm link sets `confirmed` and sends the welcome issue when the issue is at most 14 days old, a second submit of the same address uses the same sentence and does not add a row, `User@Example.com` matches `user@example.com`, `user+hht@gmail.com` is a second row, `/de` presets English and opens an English privacy body, and `?src=wa` on the issue is still the source when the form is submitted on the project page.

### Implementation for User Story 1

- [x] T021 [P] [US1] Implement `apps/web/src/lib/subscriptionTokens.ts`: random token, SHA-256 hash, lookup by hash (research R6).
- [x] T022 [P] [US1] Implement the IP-hash window in `apps/web/src/lib/subscribeRateLimit.ts` against `subscribe-rate-limits` (data-model.md §5, FR-008).
- [x] T023 [P] [US1] Extend `sendEmail` in `apps/web/src/lib/email.ts` to accept `replyTo`, custom headers, and an idempotency key, to return the Resend email id, and to honor `EMAIL_DELIVERY=stub` only when `VERCEL_ENV` is not `production` (record messages in memory, do not call Resend). Subscriber mail must take its sender name from the caller, not from the `HHT News` constant. Do not route issue mail through the existing link-only owner notice.
- [x] T024 [P] [US1] In `apps/web/src/proxy.ts`, set the `src` cookie when the query `src` is `vk`, `wa`, `fb`, or `tg`. The first value in the browser session wins. Cookie flags: `HttpOnly`, `SameSite=Lax`, `Path=/`, no `Max-Age`, `Secure` on HTTPS (contract [public-subscriptions.md](./contracts/public-subscriptions.md) §2, research R8).
- [x] T025 [P] [US1] Add subscribe, confirm, and privacy strings to `apps/web/messages/en.json`, `apps/web/messages/de.json`, `apps/web/messages/tr.json`, `apps/web/messages/ru.json`, and `apps/web/messages/uk.json`. Email-language labels are only Russian and English. On `de`, `tr`, and `uk` the preset language is English (FR-041).
- [x] T026 [P] [US1] Create the server-rendered form in `apps/web/src/components/SubscribeForm.tsx`: email, language radios (preset `ru` only when the locale is `ru`, otherwise `en`), an unticked consent checkbox whose label names the project and links to `/{locale}/privacy`, a hidden `src` copied from the cookie, and a hidden honeypot `company` (`tabindex="-1"`, `autocomplete="off"`, not displayed). `action` is `POST /api/public/projects/{slug}/subscribe`. No client JavaScript (FR-001, contract [public-subscriptions.md](./contracts/public-subscriptions.md) §2).
- [x] T027 [P] [US1] Create `apps/web/src/app/[locale]/privacy/page.tsx`. `ru` and `en` render the legal note (controller, GDPR Art. 9(2)(a), what is stored, EU storage, retention, the per-issue click flag, unsubscribe including by reply, deletion). `de`, `tr`, and `uk` render the English note with that locale's title and back link. Also state that the chat source is remembered for the browser session and that a hashed rate-limit row is kept for a day and is not attached to the subscription (FR-025, FR-026, research R15, contract [public-subscriptions.md](./contracts/public-subscriptions.md) §6).
- [x] T028 [US1] Implement confirmation sending and `subscriberMailEnabled` in `apps/web/src/lib/subscriberMail.ts`. The gate is open only when `RESEND_API_KEY` is set and `RESEND_FROM_EMAIL` is non-empty and does not end in `@resend.dev`; the project owner's address is the exception and may still be stored and mailed. The confirmation is in the chosen language, contains the project name, one confirm sentence, the confirm link `{PUBLIC_SITE_URL}/{language}/subscribe/confirm/{token}`, and the privacy link. `Reply-To` is the owner. Idempotency key is `confirm/{subscriberId}/{tokenHashPrefix}`. No `List-Unsubscribe` (research R12, contract [public-subscriptions.md](./contracts/public-subscriptions.md) §2).
- [x] T029 [US1] Implement `POST` in `apps/web/src/app/api/public/projects/[slug]/subscribe/route.ts`. Always respond `303` to the `Referer` path on this site, otherwise the project page, with exactly one of `need_consent`, `bad_email`, `try_later`, or `check_inbox` per contract [public-subscriptions.md](./contracts/public-subscriptions.md) §2. `check_inbox` is the same sentence for a new address, a pending address, an already confirmed address, a filled honeypot, the per-address hour, and a sandbox discard. Replace an `unsubscribed` row immediately (delete its `issue-deliveries`, insert a new `pending` row). A `pending` row sends a new confirmation only when `confirmationSentAt` is at least an hour ago, and that send replaces the token hash. Roll back the insert when Resend rejects the confirmation. Call `analyticsCounts` for `form_submit` only when consent was given, the address is syntactically valid, and the honeypot was empty (FR-002–FR-008, FR-024).
- [x] T030 [US1] Implement `apps/web/src/app/[locale]/subscribe/confirm/[token]/page.tsx`. A matching unexpired `pending` row becomes `confirmed`, gains an unsubscribe hash, and increments the `confirmation` count. The success page is in the row's language and links to the latest visible issue. An already used, expired, or unknown token shows that the link is no longer valid and changes nothing (FR-003, contract [public-subscriptions.md](./contracts/public-subscriptions.md) §3).
- [x] T031 [US1] On that same confirm request, in `apps/web/src/lib/subscriberMail.ts`, claim `(digest, subscriber)` and send the welcome issue with `buildIssueEmail` only when the latest visible issue is not hidden, its English text is `ready`, and `publishedAt` is at most 14 days ago. English sends now. Russian sends now only when the Russian text is already `ready`; otherwise leave the row `pending`. A lost claim or no issue inside 14 days sends nothing (FR-010a, contract [public-subscriptions.md](./contracts/public-subscriptions.md) §3).
- [x] T032 [US1] Render `SubscribeForm` and the query-flag message on `apps/web/src/app/[locale]/projects/[slug]/page.tsx` and `apps/web/src/app/[locale]/projects/[slug]/issues/[issueId]/page.tsx`.
- [x] T033 [US1] Show confirmed and pending counts by `source` and by `language` from `apps/web/src/components/admin/SubscriberCounts.tsx` on the project edit view in `apps/web/src/collections/ResearchProjects.ts`. Counts are computed, not stored (FR-028, contract [admin-and-webhooks.md](./contracts/admin-and-webhooks.md) §1).

**Checkpoint**: User Story 1 works against the email stub. Playwright `tests/e2e/subscriptions.spec.ts` covers §1 of the quickstart.

---

## Phase 4: User Story 2 - Receive the full issue by email (Priority: P1)

**Goal**: When an issue is published and not hidden, every confirmed subscriber receives it once, in their language, from the existing hourly worker. Failures retry, quota defers, and a permanent bounce or complaint unsubscribes the address.

**Independent Test**: With one confirmed subscriber per language and issue text `ready`, run the worker against the email stub and confirm two issue emails whose plain text stays complete after every URL is removed, then run it again and confirm no further issue emails (spec.md US2, quickstart.md §2).

### Tests for User Story 2

- [x] T034 [P] [US2] Extend `apps/web/src/scripts/seed-public-feed.ts` so the seed creates one `ready` issue and one confirmed subscriber per language. Tests that need an empty subscriber list still create their own rows (quickstart.md Prerequisites).
- [x] T035 [P] [US2] Add failing cases in `apps/worker/src/pipeline/subscriptionSweep.test.ts`: fan-out inserts one `pending` row per confirmed subscriber and sets `subscriberFanoutAt`; a second run sends nothing more; English does not wait for Russian; Russian inside 6 hours stays `pending` and calls translate; Russian after 6 hours is sent as English plus the Russian note and `logError`s once; a 429 quota sets `nextAttemptAt` to the next 00:10 UTC and does not increase `attempts`; a transient failure retries up to `attempts === 4` then `failed`; a hidden issue skips remaining `pending` rows; `issueTextStatus === failed` sets `subscriberSendBlockedAt` and inserts no rows; `@resend.dev` sends only to the owner and logs one warning (contract [delivery-sweep.md](./contracts/delivery-sweep.md) §2–§4, research R11, R12, R14).

### Implementation for User Story 2

- [x] T036 [US2] Add list and patch helpers on `apps/worker/src/cms/client.ts` for subscribers, issue-deliveries, digests (`subscriberFanoutAt`, `subscriberSendBlockedAt`, `ownerKitSentAt`, `hiddenFromPublic`, `issueTextStatus`, `publishedAt`), and the project sender name. The worker must keep using Payload REST only and must not import `apps/web`.
- [x] T037 [US2] Add `POST` `apps/web/src/app/api/internal/issues/[id]/translate/route.ts`. A missing or wrong `X-Payload-API-Key` is `401`. The body is `{ "locale": "ru" }`. Call the existing `resolveIssueTranslation` with a 50-second deadline and no `after()`, and return `{ "status": "ready" | "unavailable" | "failed" }`. Set `maxDuration` to 60. Do not open `issue-translations` to REST (contract [delivery-sweep.md](./contracts/delivery-sweep.md) §3, research R13).
- [x] T038 [US2] Implement fan-out and due sends in `apps/worker/src/pipeline/subscriptionSweep.ts` using `buildIssueEmail` and the helpers from `deliveryDecision.ts`. Eligibility, the blocked-text path, the Russian wait, Resend outcomes (accepted, quota, rate limit, retry, failed), the sandbox gate, and the per-issue hide re-read are contract [delivery-sweep.md](./contracts/delivery-sweep.md) §1–§4. Idempotency key is `issue/{digestId}/subscriber/{subscriberId}`. One HTTP call per recipient. On insert, set `clickTokenHash` from 32 random bytes (the redirect itself is User Story 6). Clearing `subscriberSendBlockedAt` is the admin action in T041, not this file.
- [x] T039 [US2] In the same sweep, delete `pending` subscribers whose `confirmationExpiresAt` is more than 24 hours ago, `unsubscribed` subscribers whose `unsubscribedAt` is more than 30 days ago together with their `issue-deliveries`, and `subscribe-rate-limits` rows older than 24 hours. Do not delete `analytics-counts` (contract [delivery-sweep.md](./contracts/delivery-sweep.md) §7, FR-004, FR-024).
- [x] T040 [US2] Call `sweepSubscriptions` after `sweepIssueText` inside the existing `finally` in `apps/worker/src/index.ts`. Catch a sweep failure, `logError` it, and do not change run status or watermarks. Do not add a cron.
- [x] T041 [US2] Create `apps/web/src/components/admin/IssueDeliveryStatus.tsx` and mount it on the digest edit view from `apps/web/src/collections/Digests.ts`. Show counts of `sent`, `pending`, `failed`, and `skipped`. "Retry failed" sets `failed` rows to `pending` with `attempts = 0` and an empty `nextAttemptAt`. "Send to subscribers" shows when `subscriberSendBlockedAt` is set and clears it. Do not show `clicked` (FR-013, FR-018, FR-028, contract [admin-and-webhooks.md](./contracts/admin-and-webhooks.md) §2).
- [x] T042 [P] [US2] Implement Svix HMAC verification in `apps/web/src/lib/svixVerify.ts` and cover it in `apps/web/src/lib/svixVerify.test.ts`: signed payload `{svix-id}.{svix-timestamp}.{rawBody}`, HMAC-SHA256 of the base64 secret after the `whsec_` prefix of `RESEND_WEBHOOK_SECRET`, reject a timestamp more than 5 minutes from now or a missing `v1` match (research R10, contract [admin-and-webhooks.md](./contracts/admin-and-webhooks.md) §4).
- [x] T043 [US2] Implement `POST` `apps/web/src/app/api/webhooks/resend/route.ts`. Read the body as raw text and verify the signature before trusting JSON. A bad signature is `400` and writes nothing. `email.bounced` and `email.complained` unsubscribe every subscriber with that normalized address (match `resendEmailId` when present, otherwise the event `to` address) and set `unsubscribedAt`. A second event is `200` and sends no mail. Any other event is `200` with no write. A valid signature whose write fails is `500`. Absent `RESEND_WEBHOOK_SECRET` responds `400` (FR-020).

**Checkpoint**: One stub run delivers each language once. A second run does not. Failed rows can be queued again from the digest admin. A signed complaint unsubscribes the address.

---

## Phase 5: User Story 3 - Unsubscribe in one click (Priority: P1)

**Goal**: A subscriber can leave from the mail client's one-click button or from one button on the visible link. Opening the link does not unsubscribe. The owner can unsubscribe or delete from the admin.

**Independent Test**: From a stub issue email, open the visible unsubscribe URL and confirm a GET leaves the row `confirmed`, a button POST sets `unsubscribed`, and the next sweep sends that address nothing. Repeat with `POST /api/unsubscribe/{token}` (spec.md US3, quickstart.md §3).

### Tests for User Story 3

- [x] T044 [P] [US3] Extend `apps/web/tests/e2e/subscriptions.spec.ts` with quickstart.md §3: GET renders one button and stays `confirmed`; the button POST shows "You are unsubscribed" in the subscriber's language; opening the URL again says they are not subscribed and is not an error page; the token path contains no `@`.

### Implementation for User Story 3

- [x] T045 [P] [US3] Implement `GET` and `POST` in `apps/web/src/app/[locale]/unsubscribe/[token]/page.tsx`. GET only renders the button. POST of a `confirmed` hash sets `unsubscribed` and `unsubscribedAt` and confirms in the row's language. A hash that is already `unsubscribed`, or no row, says they are not subscribed in the URL locale, with no mail and no error page (FR-022, FR-023, contract [public-subscriptions.md](./contracts/public-subscriptions.md) §4).
- [x] T046 [P] [US3] Implement `POST` `apps/web/src/app/api/unsubscribe/[token]/route.ts` for `application/x-www-form-urlencoded` body `List-Unsubscribe=One-Click`. Same effect as the button, `200` and an empty body for every token state including unknown, no redirect and no mail. GET on that URL is `405` (FR-021, FR-022).
- [x] T047 [US3] Put `List-Unsubscribe` and `List-Unsubscribe-Post` on every issue email sent from `apps/web/src/lib/subscriberMail.ts` and `apps/worker/src/pipeline/subscriptionSweep.ts`, and pass the visible unsubscribe URL into `buildIssueEmail`. The header URL is `{PUBLIC_SITE_URL}/api/unsubscribe/{token}`. The visible link locale is the subscriber's language. The token is the unsubscribe token, not the click token (FR-021, contract [public-subscriptions.md](./contracts/public-subscriptions.md) §4 and §7).
- [x] T048 [US3] On `apps/web/src/collections/Subscribers.ts`, make the owner unsubscribe action set `unsubscribed` and `unsubscribedAt`, and make delete remove the row and its `issue-deliveries` in the same operation. There is no "email this person" action (FR-009, FR-027, contract [admin-and-webhooks.md](./contracts/admin-and-webhooks.md) §1).

**Checkpoint**: Scanner GET does not unsubscribe. One-click POST and the page button do. The next sweep skips that address.

---

## Phase 6: User Story 4 - Chat post kit (Priority: P2)

**Goal**: For each published issue the owner sees eight ready-to-paste posts in the admin and receives the same kit by email once.

**Independent Test**: Publish an issue, copy the Telegram Russian post from the admin, and confirm it fits one message, includes the disclaimer, and has an issue link ending in `src=tg`. Confirm the stub recorded one owner kit email (spec.md US4, quickstart.md §4).

### Implementation for User Story 4

- [x] T049 [P] [US4] Create `apps/web/src/components/admin/IssuePostKit.tsx` and mount it on the digest edit view from `apps/web/src/collections/Digests.ts`. Build the eight posts with `buildChatPosts` from the issue text that already exists. Each block has a copy button; the text stays selectable if the clipboard call is denied. A hidden issue still shows the kit (FR-029–FR-032, contract [admin-and-webhooks.md](./contracts/admin-and-webhooks.md) §2).
- [x] T050 [US4] Send the owner kit once from `apps/worker/src/pipeline/subscriptionSweep.ts` when `ownerKitSentAt` is empty, the issue is not hidden, fan-out has started or the text is `ready`, and the Russian window has resolved the same way as VK (Russian text ready, or 6 hours have passed). One plain-text and HTML email, eight posts with a heading per chat and language, idempotency key `owner-kit/{digestId}`, no list-unsubscribe. Set `ownerKitSentAt` when Resend accepts. Do not use the link-only digest notice in `apps/worker/src/notify/digestEmail.ts` (FR-033, contract [delivery-sweep.md](./contracts/delivery-sweep.md) §6).

**Checkpoint**: The admin shows eight copyable posts. The stub has one kit email, and a second sweep does not send another.

---

## Phase 7: User Story 5 - Auto-post to the VK community (Priority: P3)

**Goal**: When the project has a community id and the worker has a token, publishing an issue posts the full Russian text to the wall once. A missing translation falls back after about 6 hours. Hiding the issue before the post exists cancels it.

**Independent Test**: With VK configured and Russian text ready, one sweep creates one `published` row and a second sweep does not call `wall.post` again. With no `vkCommunityId`, the sweep creates no row and logs no error (spec.md US5, quickstart.md §4).

### Tests for User Story 5

- [x] T051 [P] [US5] Add failing cases to `apps/worker/src/pipeline/subscriptionSweep.test.ts`: no `vkCommunityId` or no `VK_COMMUNITY_TOKEN` creates no `vk-posts` row and does not log an error; a configured project posts once with `from_group=1` and a negative `owner_id`, stores `vkPostId`, and a second run does not call VK; a failure sets `failed`, `logError`s, and does not change delivery rows; hide before `vkPostId` sets `skipped` and does not call VK; hide after `published` leaves the row `published`; Russian missing and `publishedAt` 7 hours ago posts the English text plus the Russian note once, and a later `ready` translation does not change `vkPostId` (FR-019, FR-034–FR-036, quickstart.md §4).

### Implementation for User Story 5

- [x] T052 [US5] Post due VK rows from `apps/worker/src/pipeline/subscriptionSweep.ts`. Insert one `pending` `vk-posts` row at fan-out only when `vkCommunityId` and `VK_COMMUNITY_TOKEN` are both set. `POST https://api.vk.com/method/wall.post` with `owner_id=-{vkCommunityId}`, `from_group=1`, `v=5.199`, and the VK chat post as `message`. Never write the token to a Payload field, a log line, or an admin response. A `published` row is never replaced. Email delivery does not wait on this call (FR-034–FR-037, contract [delivery-sweep.md](./contracts/delivery-sweep.md) §5).
- [x] T053 [US5] Show the `vk-posts` status for the digest, or "not configured" when the project has no `vkCommunityId`, on `apps/web/src/components/admin/IssueDeliveryStatus.tsx`. A failed row has a retry control that sets `pending`. The component must not request or render `VK_COMMUNITY_TOKEN` (FR-036, FR-037, contract [admin-and-webhooks.md](./contracts/admin-and-webhooks.md) §2).

**Checkpoint**: Mocked `fetch` to `api.vk.com` shows one wall post per issue. An unconfigured project is silent.

---

## Phase 8: User Story 6 - Minimal analytics (Priority: P3)

**Goal**: The owner sees anonymous page views, form submissions, and confirmations by source, plus aggregate click counts, with no analytics cookie and no third-party tracker.

**Independent Test**: Open an issue with `?src=fb` and with no source, submit the form once, open `/r/{clickToken}/issue`, and confirm the admin shows those counts under `fb` and `other` and one clicking subscriber for that issue, with no address beside the "two or more issues" figure (spec.md US6, quickstart.md §5).

### Tests for User Story 6

- [x] T054 [P] [US6] Add failing Jest cases in `apps/web/src/lib/clickRedirect.test.ts`: a known token sets `clicked` once, an unknown token and a thrown flag write both still respond `302`, and `target` values `issue`, `privacy`, and `subscribe` match contract [public-subscriptions.md](./contracts/public-subscriptions.md) §5.

### Implementation for User Story 6

- [x] T055 [P] [US6] Count one `page_view` on `apps/web/src/app/[locale]/projects/[slug]/issues/[issueId]/page.tsx` from that request's query `src` (missing or unknown → `other`), via `apps/web/src/lib/analyticsCounts.ts`. Do not count on the project page. Do not read the `src` cookie (FR-038, research R8).
- [x] T056 [US6] Implement the redirect decision in `apps/web/src/lib/clickRedirect.ts` and call it from `GET` `apps/web/src/app/r/[token]/[target]/route.ts`. On a known `clickTokenHash`, set `clicked` when it is still false, then `302`. If the write throws, `302` anyway. Unknown token or any other `target` redirects to `PUBLIC_SITE_URL`. `issue`, `privacy`, and `subscribe` targets are contract [public-subscriptions.md](./contracts/public-subscriptions.md) §5. External item URLs are not wrapped. A well-formed path must not respond `500` (FR-039).
- [x] T057 [US6] Create `apps/web/src/components/admin/SubscriberMetrics.tsx` and mount it on the project edit view in `apps/web/src/collections/ResearchProjects.ts`. The loader returns only: page views, form submissions, and confirmations per `issueKey` and `source`; clicking subscribers per issue; and one count of confirmed subscribers who clicked in two or more issues. It must not return subscriber ids, addresses, or which issue a named person clicked (FR-039, FR-040, contract [admin-and-webhooks.md](./contracts/admin-and-webhooks.md) §3).

**Checkpoint**: Counts in the admin match quickstart.md §5. The delivery list still has no clicked column. Document cookies show no analytics cookie.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Locale completeness, the automated gate, and the manual launch checklist.

- [x] T058 [P] Walk `apps/web/messages/en.json`, `de.json`, `tr.json`, `ru.json`, and `uk.json` and confirm the subscribe form, confirmation page, unsubscribe page, and privacy chrome exist in all five locales, while email bodies and chat posts stay `ru` and `en` only (FR-041, Principle VI).
- [x] T059 Run the automated commands in quickstart.md §7 and fix failures in the files those commands cover: `pnpm --filter @hht/shared test`, `pnpm --filter @hht/web test`, `pnpm --filter @hht/worker test`, and `pnpm --filter @hht/web exec playwright test tests/e2e/subscriptions.spec.ts`.
- [ ] T060 Walk the launch checklist in quickstart.md §8 before `RESEND_FROM_EMAIL` leaves `@resend.dev`: SPF/DKIM/DMARC, Resend open and click tracking off, webhook registered for `email.bounced` and `email.complained` only, `VK_COMMUNITY_TOKEN` on the worker only, and one phone read in Gmail, Mail.ru, Yandex Mail, and Apple Mail with links disabled (SC-005). This task is manual and is not CI.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies.
- **Foundational (Phase 2)**: Depends on Setup. Blocks every user story.
- **User Stories (Phase 3+)**: Depend on Foundational. US2 also depends on the welcome claim shape from US1 (`issue-deliveries` insert). US3 depends on the unsubscribe hash created in US1 and on issue sends from US1/US2. US4 depends on `buildChatPosts` (Foundational) and on the sweep from US2 for the owner email. US5 depends on the sweep from US2. US6 depends on `clickTokenHash` issued in US2 and on the form and confirm paths from US1.
- **Polish (Phase 9)**: Depends on the stories you intend to ship.

### User Story Dependencies

- **User Story 1 (P1)**: Starts after Foundational. No dependency on other stories. This is the MVP.
- **User Story 2 (P1)**: Starts after Foundational. Shares the delivery row with the US1 welcome send, so land US1's claim (T031) before the sweep so the two cannot double-send.
- **User Story 3 (P1)**: Starts after the unsubscribe hash exists (T030). The page and the one-click route do not need the sweep. Header wiring (T047) needs the send paths from T031 and T038.
- **User Story 4 (P2)**: The admin kit (T049) needs only Foundational `buildChatPosts` and a digest with text. The owner email (T050) needs the US2 sweep.
- **User Story 5 (P3)**: Needs the US2 sweep. Does not block email delivery.
- **User Story 6 (P3)**: Page-view and metrics UI need Foundational counts. The click redirect needs tokens issued when US2 inserts a delivery.

### Within Each User Story

- Tests are written to fail before the implementation they cover.
- Shared helpers before routes.
- Models and collections are already done in Phase 2.
- A story is independently testable at its checkpoint.

### Parallel Opportunities

- T002–T006 can run together. T008–T015 can run together after T007 starts only for the re-export; the collection files do not wait on T007.
- US1: T018–T020 together, then T021–T027 together.
- US2: T034 and T035 together; T042 can run beside the sweep once `resendEmailId` is a field (Phase 2).
- US3: T044, T045, and T046 together.
- US4 T049 can run beside US5 tests (T051) and beside US6's page-view task (T055); they touch different files.
- US6: T054 and T055 together.

---

## Parallel Example: User Story 1

```bash
# Tests first, different files:
Task: "T018 subscriptionTokens.test.ts"
Task: "T019 subscribeRateLimit.test.ts"
Task: "T020 tests/e2e/subscriptions.spec.ts (quickstart §1 only)"

# Then implementation, different files:
Task: "T021 subscriptionTokens.ts"
Task: "T022 subscribeRateLimit.ts"
Task: "T023 email.ts stub and headers"
Task: "T024 proxy.ts src cookie"
Task: "T026 SubscribeForm.tsx"
Task: "T027 privacy/page.tsx"
```

## Parallel Example: User Story 2

```bash
Task: "T034 seed-public-feed.ts confirmed subscribers"
Task: "T035 subscriptionSweep.test.ts fan-out and retry cases"
Task: "T042 svixVerify.ts and svixVerify.test.ts"
```

## Parallel Example: User Story 3

```bash
Task: "T044 subscriptions.spec.ts unsubscribe cases"
Task: "T045 unsubscribe/[token]/page.tsx"
Task: "T046 api/unsubscribe/[token]/route.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational.
3. Complete Phase 3: User Story 1.
4. Stop and validate against quickstart.md §1 with `EMAIL_DELIVERY=stub`.
5. Demo a confirmed subscriber with source and language. Do not point `RESEND_FROM_EMAIL` at a real domain yet.

### Incremental Delivery

1. Setup + Foundational → schema and pure rules.
2. User Story 1 → subscribe and confirm (MVP).
3. User Story 2 → weekly issue email, retries, bounce webhook.
4. User Story 3 → one-click and visible unsubscribe.
5. User Story 4 → post kit in the admin and the owner email.
6. User Story 5 → VK wall post when configured.
7. User Story 6 → anonymous counts and the click flag.
8. Polish → five-locale pass, automated commands, launch checklist.

### Parallel Team Strategy

After Foundational:

- Developer A: User Story 1, then User Story 3.
- Developer B: User Story 2 sweep, then User Story 5 on that sweep.
- Developer C: User Story 4 admin kit and User Story 6 counters, joining the sweep only for the owner kit and the click token.

Stories still integrate through the shared delivery row and `buildIssueEmail`. Do not let two tasks edit `subscriptionSweep.ts` at the same time.

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks.
- [Story] maps the task to spec.md for traceability. Setup, Foundational, and Polish have no story label.
- Confirmation, unsubscribe, and click tokens are stored only as SHA-256 hashes.
- `clicked` is never an admin column. The owner sees aggregates only.
- The worker does not open Postgres and does not import `apps/web`.
- No new npm package, vendor, or cron.
- Commit after each task or logical group. Stop at any checkpoint and validate that story on its own.
