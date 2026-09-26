# Implementation Plan: Email Subscriptions and Chat Delivery

**Branch**: `006-email-subscriptions` | **Date**: 2026-09-26 | **Spec**: [`spec.md`](./spec.md)

**Input**: Feature specification from `/specs/006-email-subscriptions/spec.md`

## Summary

Each published issue reaches confirmed subscribers as a full-text email, and the owner gets a
ready-to-paste post for each patient chat. VK can also post itself when a community is
configured. The work follows the existing service split:

- **Web (`apps/web`)**: the subscribe form (no JavaScript, 360 px), double opt-in, one-click and
  visible unsubscribe, the privacy page, anonymous page/form counters, a first-party redirect
  that sets the per-issue click flag, and the Resend bounce/complaint webhook. Confirmation
  mail and the welcome issue are sent on the request that confirms the subscription.
- **Worker (`apps/worker`)**: one new end-of-job sweep, after issue text, fans out issue
  emails, retries them, waits on the Russian translation, posts to VK, emails the owner the
  post kit, and erases expired rows. Failures go to the existing ERROR-log alert.
- **Shared (`packages/shared`)**: pure rules both sides must not drift on — address matching,
  source allow-list, delivery decisions, the issue email body, and chat-post truncation.

Subscriber rows stay in Neon (Frankfurt). Resend only transports mail. No Resend Contacts, and
no Resend open/click tracking.

## Domain events and policies

These are the contract for the collections in [`data-model.md`](./data-model.md). No new
deployable and no Technical Baseline change, so no ADR.

| Event                    | When                                                                 | Policy                                                                                                                                                          |
| ------------------------ | -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SubscriptionRequested`  | A consented, accepted submission                                     | Store `pending` only. Send one confirmation in the chosen language. Same on-screen response for new, pending, confirmed, honeypot, and per-address suppression. |
| `SubscriptionConfirmed`  | The confirmation link is followed once, within 7 days                | State becomes `confirmed`. Send the latest visible issue if it is at most 14 days old, subject to the delivery rules below.                                     |
| `IssueDeliveryClaimed`   | A confirmed subscriber is due an issue                               | One row per issue and subscriber. The caller that inserts the row is the only sender.                                                                           |
| `IssueDelivered`         | Resend accepts that email                                            | Status `sent`. A later retry does not send again.                                                                                                               |
| `IssueDeliveryFailed`    | The last automatic retry still failed                                | Status `failed`, `logError`. The owner can set it back to `pending`.                                                                                            |
| `IssueDeliverySkipped`   | The issue is hidden, or the subscriber is no longer confirmed        | Status `skipped`. Already-sent mail is not recalled.                                                                                                            |
| `SubscriberUnsubscribed` | One-click POST, the page button, a bounce, a complaint, or the owner | Takes effect before the next send. The address is erased within 30 days. A new submission before then replaces the row immediately.                             |
| `VkPostPublished`        | `wall.post` returns a post id                                        | One post per issue per community. A later retry does not post again.                                                                                            |

Russian subscribers and the VK post wait up to about 6 hours for the Russian issue text, then
fall back to English with a Russian note. English subscribers never wait. A digest whose issue
text failed is not mailed and not posted until the owner starts the send after regenerating it.

## Technical Context

**Language/Version**: TypeScript 5.8 on Node.js ≥ 24 (root `engines`); Next.js 16.3.3 (App Router);
Payload CMS 3.88.0 with `@payloadcms/db-postgres` 3.88.0; next-intl 4.13.

**Primary Dependencies**: Mantine 7.17, next-intl, the existing Resend HTTP call in
`apps/web/src/lib/email.ts`, the existing `resend` SDK in the worker (unchanged, and not used for
this feature's mail). **No new npm packages.** VK is one `POST` with `fetch`. Webhook signatures
are checked with Node `crypto`.

**Storage**: Postgres on Neon (Frankfurt), unchanged provider. Additive schema pushed by
`ensure-schema` on the Vercel build. New collections: `subscribers`, `issue-deliveries`,
`vk-posts`, `analytics-counts`, `subscribe-rate-limits`. Details in [`data-model.md`](./data-model.md).

**Testing**: Jest in `packages/shared` (address matching, delivery decisions, post truncation,
email body still complete with every URL removed) and `apps/web` (confirm/unsubscribe token
rules, rate limit, webhook signature). Playwright in `apps/web` (form at 360 px without
JavaScript, consent, source carried across a second page, confirm with the email stub,
unsubscribe button vs a GET from a scanner). Live mailbox and VK checks stay in the quickstart;
they are not CI.

**Target Platform**: Vercel Hobby, `fra1` (pages, form POST, redirects, webhook); GCP Cloud Run
Job + the existing hourly Cloud Scheduler job (delivery sweep). No new cron. Vercel Hobby cron
cannot run more than once a day, so it cannot meet the 6-hour retry.

**Project Type**: Existing pnpm monorepo (`apps/web`, `apps/worker`, `packages/shared`). No new
deployable.

**Performance Goals**:

- A phone user can subscribe and confirm in under 2 minutes (SC-001). The form POST is a
  redirect, not a client round-trip.
- 95% of confirmed subscribers are sent a published issue within 1 hour of the text being ready
  (the same hourly job that generates the text), and the rest within 24 hours, except daily-quota
  deferrals (SC-003).
- The click redirect answers with a 302 even when the flag write fails.
- Fan-out is one Resend call per recipient. Fifty recipients fit in the existing 30-minute job.

**Constraints**:

- System of record for subscribers is Neon in Frankfurt (FR-026). Resend is transport only.
- Sending to anyone except the project owner stays off until `RESEND_FROM_EMAIL` is not a
  `resend.dev` address (FR-016).
- At most one issue email per subscriber per issue, including the welcome send (FR-014).
- Unsubscribe tokens do not contain the address and do not expire while the row exists (FR-023).
- The public form works without JavaScript at 360 px (FR-001).
- No disease name in `apps/*/src` or `packages/shared`. Sender name comes from the project.
- No new vendors, paid tiers, or npm packages.
- The existing link-only owner notice (`assertLinkOnlyEmail`) stays as it is. Issue mail is a
  separate function and must not go through that check.

**Scale/Scope**: One live project. About 50 confirmed subscribers (Resend free tier, 100
emails/day). Two email languages (`ru`, `en`) and five UI locales. Eight chat posts per issue.
One optional VK community.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle                                     | Status | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| --------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I. Spec-First, Event-Driven                   | PASS   | Spec and two clarify sessions precede this plan. Domain events and policies are listed above. No code is written here. No ADR: Resend, Neon Frankfurt, and the worker/web split are already the baseline; new collections and one sweep are additive and reversible.                                                                                                                                                                                                  |
| II. Ruthless Scope Discipline                 | PASS   | No accounts, topic preferences, SMS, or automation for WhatsApp, Facebook, or Telegram. Chat posts are derived from spec 005 text, with no new model call.                                                                                                                                                                                                                                                                                                            |
| III. Free-Tier-First                          | PASS   | Resend free tier, existing hourly Scheduler job, no second cron (Hobby cannot run a sub-daily cron). Click counts are a boolean on the delivery row, not a new analytics product.                                                                                                                                                                                                                                                                                     |
| IV. Public by Default                         | PASS   | Issues stay readable without an account. The new public POSTs (subscribe, unsubscribe) do not create a user and are not an auth flow. Owner actions stay in the Payload admin.                                                                                                                                                                                                                                                                                        |
| V. Maintainability Over Cleverness            | PASS   | One delivery state machine, shared by the welcome send and the sweep. Chat posts are a pure function, not stored copies. Topic-agnostic: sender name, VK community id, and wording come from project fields or env. The hardcoded `HHT News` sender in `email.ts` is not reused.                                                                                                                                                                                      |
| VI. Internationalization Is First-Class       | PASS   | Form, confirmation page, unsubscribe page, and their messages ship in `en`, `de`, `tr`, `ru`, and `uk`. Email bodies and chat posts are `ru` and `en` only, as the spec requires. The privacy **page** exists in all five locales; the legal text is authoritative in Russian and English, and `de`/`tr`/`uk` show the English text with chrome in that locale (spec assumption, FR-041). A machine translation of the legal note would not be the controller's text. |
| VII. Domain Boundaries Are Service Boundaries | PASS   | Fan-out, retries, VK, and erasure run in the worker, which still has no database access and calls Payload REST plus one internal translate route. The web app owns the request path and the existing translator. The worker does not import `apps/web`.                                                                                                                                                                                                               |
| VIII. Portable by Design                      | PASS   | Mail goes through Resend's HTTP API, which the web app already uses. VK is a single `fetch` to `wall.post` behind one function, off when the community id is empty. Webhook verification uses Node `crypto`, not a vendor SDK. The same path works under `next start` in Docker.                                                                                                                                                                                      |
| IX. Automated, Enforced Quality Gates         | PASS   | Jest and Playwright cases are enumerated in [`quickstart.md`](./quickstart.md). CI gains an email stub the same way it stubs the translator. No existing check is removed. Mailbox placement (SC-005) and a live VK post stay manual launch checks.                                                                                                                                                                                                                   |

**Post–Phase 1 re-check**: [`research.md`](./research.md), [`data-model.md`](./data-model.md), the
three [`contracts/`](./contracts/), and [`quickstart.md`](./quickstart.md) stay within the gates.

- The five new collections are justified in research R3, R4, R5, R16, and R18. None replaces an
  existing collection.
- `clicked` is not shown on any admin document. The owner sees aggregates only (R18, FR-039).
- The functional `src` cookie is not an analytics cookie and is not read by the counters (R8).
- No new package, service, or cron.

No unjustified violations. Complexity Tracking is empty.

## Project Structure

### Documentation (this feature)

```text
specs/006-email-subscriptions/
├── plan.md
├── research.md                      # Phase 0: decisions R1–R18
├── data-model.md                    # Phase 1: collections, states, indexes
├── quickstart.md                    # Phase 1: validation and the launch gate
├── contracts/
│   ├── public-subscriptions.md      # form, confirm, unsubscribe, click, privacy
│   ├── delivery-sweep.md            # worker fan-out, retries, VK, erasure
│   └── admin-and-webhooks.md        # Payload admin, Resend webhook
├── checklists/
│   └── requirements.md
└── tasks.md                         # Phase 2 (/speckit-tasks, not created here)
```

### Source Code (repository root)

```text
packages/shared/src/
├── index.ts                               # re-exports the new modules
├── subscriberEmail.ts                     # normalize; case-insensitive, plus-tags kept
├── subscriberEmail.test.ts
├── chatSource.ts                          # vk | wa | fb | tg | other
├── deliveryDecision.ts                    # claim, fallback window, quota vs retry, welcome dedup
├── deliveryDecision.test.ts
├── issueEmailBody.ts                      # text + html from issue DTO; URL-strippable
├── issueEmailBody.test.ts
├── chatPost.ts                            # 8 posts, length limits, drop lowest-ranked items
└── chatPost.test.ts

apps/worker/src/
├── index.ts                               # sweepIssueText(), then sweepSubscriptions()
├── cms/client.ts                          # list/patch subscribers, deliveries, vk-posts, digests
├── pipeline/
│   ├── subscriptionSweep.ts               # fan-out, retry, VK, owner kit, erasure
│   └── subscriptionSweep.test.ts
└── notify/
    └── digestEmail.ts                     # unchanged link-only owner notice

apps/web/
├── messages/{en,de,tr,ru,uk}.json         # Subscribe, Unsubscribe, Privacy chrome, email-language labels
├── src/
│   ├── proxy.ts                           # set the src cookie on a recognized ?src=
│   ├── collections/
│   │   ├── Subscribers.ts
│   │   ├── IssueDeliveries.ts
│   │   ├── VkPosts.ts
│   │   ├── AnalyticsCounts.ts
│   │   ├── SubscribeRateLimits.ts
│   │   ├── Digests.ts                     # + fan-out fields, post-kit and delivery UI
│   │   └── ResearchProjects.ts            # + emailFromName, vkCommunityId; metrics UI
│   ├── payload.config.ts                  # register the five collections
│   ├── lib/
│   │   ├── email.ts                       # extend the existing fetch sender: replyTo, headers, idempotency key
│   │   ├── subscriberMail.ts              # sandbox gate, confirm + welcome send
│   │   ├── subscriptionTokens.ts          # random token, SHA-256 hash, lookup
│   │   ├── analyticsCounts.ts             # upsert by (project, issueKey, source, metric)
│   │   └── svixVerify.ts                  # Resend webhook signature
│   ├── components/
│   │   ├── SubscribeForm.tsx              # server-rendered form, no client JS
│   │   └── admin/
│   │       ├── IssuePostKit.tsx           # eight posts, copy buttons
│   │       ├── IssueDeliveryStatus.tsx    # counts by status, retry, VK status, start-send
│   │       └── SubscriberMetrics.tsx      # anonymous counts + click aggregates
│   └── app/
│       ├── [locale]/
│       │   ├── privacy/page.tsx
│       │   ├── subscribe/confirm/[token]/page.tsx
│       │   ├── unsubscribe/[token]/page.tsx
│       │   └── projects/[slug]/
│       │       ├── page.tsx               # + SubscribeForm
│       │       └── issues/[issueId]/page.tsx  # + SubscribeForm, page-view count
│       ├── r/[token]/[target]/route.ts    # click redirect
│       └── api/
│           ├── public/projects/[slug]/subscribe/route.ts
│           ├── unsubscribe/[token]/route.ts   # RFC 8058 POST
│           ├── internal/issues/[id]/translate/route.ts
│           └── webhooks/resend/route.ts
└── tests/e2e/
    └── subscriptions.spec.ts
```

**Structure Decision**: No new deployable. The hourly worker sweep is the only place that fans
out, retries, posts to VK, and deletes expired rows, because that is where `logError` already
pages the owner and because Hobby cron cannot run every hour. The web app keeps every
reader-facing request and the translator. Shared modules are pure string and decision functions
so the welcome email and the sweep cannot build different bodies.

## Implementation Notes (for `/speckit-tasks`)

Suggested order. Each step is verifiable on its own.

1. **Shared rules and schema.** Address matching, source allow-list, delivery decisions, email
   body, chat posts, and the five collections with their unique indexes. `ensure-schema` on a
   local database.
2. **Subscribe and confirm.** Form on the issue and project pages, the POST, the confirmation
   page, the sandbox gate, and the `src` cookie. Email stub in tests.
3. **Unsubscribe.** Visible page (GET does not unsubscribe), one-click POST, owner unsubscribe
   and delete in the admin.
4. **Sweep.** Fan-out, welcome dedup against the same unique key, Russian wait and fallback,
   retries, quota deferral, hide, owner kit, erasure. Internal translate route.
5. **VK.** `wall.post` only when the project has a community id and the worker has the token.
6. **Analytics and the webhook.** Page-view and form counters, the click redirect, admin
   aggregates, bounce and complaint unsubscribe.
7. **Five-locale chrome and the privacy page.** Then the launch checklist in the quickstart.

Steps 1–3 deliver User Stories 1 and 3. Step 4 delivers User Story 2 and the owner half of User
Story 4. Step 5 delivers User Story 5. Step 6 delivers User Story 6 and FR-020.

## Complexity Tracking

> No constitution violations requiring justification.
