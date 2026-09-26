# Research: Email Subscriptions and Chat Delivery

**Branch**: `006-email-subscriptions` | **Date**: 2026-09-26 | **Spec**: [`spec.md`](./spec.md)

The clarify sessions closed the product questions (consent basis, click flag, retry window,
Russian fallback, re-subscribe, address matching, VK hide rule, unsubscribe lifetime). What is
left are technical decisions: where fan-out runs, how a send stays unique, and how little
personal data leaves Frankfurt.

Verified against the installed versions: Payload `3.88.0`, Next.js `16.3.3`, next-intl `4.13.7`.
Vercel Hobby cron is still limited to once per day ([usage and pricing](https://vercel.com/docs/cron-jobs/usage-and-pricing)).
The repo already sends mail through Resend: `apps/web/src/lib/email.ts` (HTTP, no SDK) and
`apps/worker/src/notify/digestEmail.ts` (SDK, link-only owner notice).

---

## R1 — Fan-out, retries, VK, and erasure run in the hourly worker

**Decision**: After `sweepIssueText()`, the same Cloud Run job runs `sweepSubscriptions()`. It
creates missing delivery rows, sends due mail, retries failures, waits on the Russian
translation, posts to VK, sends the owner the post kit once, and deletes expired subscriber
rows. The web app does not grow a cron.

**Rationale**:

- **The 6-hour window needs more than a daily tick.** FR-012, FR-018, and FR-034 retry for about
  6 hours. Hobby cron expressions that run more than once a day fail the deployment. The backup
  cron in `apps/web/vercel.json` is daily and stays daily. A second Cloud Scheduler job would
  spend the free-tier job budget the constitution already refused in spec 005 (R5 there).
- **Alerting already lives on the worker.** `logError` becomes a Cloud Logging ERROR, which is
  the existing alert. Vercel runtime logs are not wired to it. FR-018's "logged as an error
  through the existing alerting" is met only if the sweep runs in the worker.
- **Principle VII.** Sending fifty emails, calling VK, and deleting rows is pipeline work. It
  must not sit inside a Payload `afterChange` hook. That hook already documents a pool stall
  when it does extra writes (`Digests.ts`).

**Trade-off accepted**: a published issue is mailed on the same hourly run that finishes its
text, or on the next run if text becomes ready later. That is inside the 1-hour goal (SC-003).
The welcome issue is the exception and is sent from the web app immediately (R2).

**Alternatives considered**:

- _Vercel cron every hour._ Rejected: Hobby rejects the expression at deploy time.
- _Send inside the digest `afterChange` hook._ Rejected: the hook runs on the web process that
  answered the worker's REST call, with no retry loop and no alert.
- _A new Cloud Scheduler job._ Rejected: the hourly job already runs; a second job is a new
  cost and a second failure mode.

---

## R2 — The request path sends only confirmation and the welcome issue

**Decision**: The web app sends two kinds of mail itself, both through the existing
`sendEmail` fetch helper:

1. The confirmation email, in the language chosen on the form, as soon as a submission is
   accepted.
2. The welcome copy of the latest issue, on the confirmation request, when that issue is
   visible, its English text is ready, and `publishedAt` is at most 14 days ago.

Everything else (the weekly fan-out, Russian waits, retries, the owner kit) is the sweep.
Both callers build the issue body with `packages/shared` and both claim the same
`issue-deliveries` row before sending (R4). The inserter is the only sender.

A Russian welcome does not send English immediately. The row stays `pending` and the sweep
applies the translation wait (R13). "Right away" in FR-010a is still subject to FR-012.

**Rationale**: The person confirming is waiting on that request. Leaving the confirmation to
the next hour would fail SC-001. The welcome issue has the same uniqueness rule as the weekly
send, so it must use the same row, not a second code path that can double-send.

**Alternatives considered**:

- _Queue the welcome and let the sweep send it._ Rejected: up to an hour late, against
  "right away".
- _Send the welcome from the web app without a delivery row._ Rejected: the sweep would send
  it again (FR-014, the "never both" edge case).

---

## R3 — A subscriber is not a user

**Decision**: New `subscribers` collection. One row per project and address. The address is
stored lowercased. Uniqueness is a unique index on `(project, email)`. Plus-tags are kept, so
`user+hht@gmail.com` and `user@gmail.com` are two rows. `User@Example.com` and
`user@example.com` are one row. No Payload `users` row, no session, no password.

**Rationale**: Principle IV forbids a public auth flow until there is real multi-user demand.
The spec forbids accounts (FR-007). A collection with a unique index is the same tool spec 005
used for the translation lock, and it makes the case-fold rule true in Postgres rather than
only in the form handler.

**Alternatives considered**:

- _Payload Auth users with a `subscriber` role._ Rejected: that is a public account system.
- _`citext` column._ Rejected: Payload does not generate it. Lowercasing in `beforeValidate`
  plus a unique index is the same guarantee and stays inside Payload's schema push.

---

## R4 — One delivery row is both the idempotency lock and the click flag

**Decision**: `issue-deliveries` has a unique index on `(digest, subscriber)`. Status is
`pending`, `sent`, `failed`, or `skipped`. The boolean `clicked` lives on this row. Creating
the row is the claim:

- No row → insert `pending`. The inserter sends.
- Row is `sent` → nobody sends.
- Row is `pending` and `nextAttemptAt` is in the future → nobody sends.
- Row is `failed` → nobody sends unless the owner sets it back to `pending`.
- Two callers insert at once → one unique-index failure. The loser does not send.

Resend's `Idempotency-Key` (`issue/{digestId}/subscriber/{subscriberId}`) is a second guard for
the 24 hours Resend remembers the key. The database row is the guard after that.

`clicked` is set by the redirect (R7). It is not a Resend click event.

**Rationale**: FR-014 and the welcome/sweep race are the same problem as spec 005's
single-flight translation: the lock has to hold across processes, so it has to be a unique
index. Putting the click flag on the same row keeps FR-007's "only other linked data" true
and gives FR-024 a single child table to delete.

**Alternatives considered**:

- _Resend idempotency alone._ Rejected: the key expires after 24 hours, and a welcome send
  from the web app plus a sweep send are two different keys unless we share one — the row is
  still required to decide who sends.
- _Resend click tracking._ Rejected: it records which link was clicked, which FR-039 forbids,
  and it stores that history at Resend rather than in Frankfurt. It is turned off for the
  sending domain (R10).

---

## R5 — Chat posts are computed; only the VK post is stored

**Decision**: The eight posts (VK, WhatsApp, Facebook, Telegram × `ru`/`en`) are a pure
function of the issue text, the public URL, and the length limits below. The admin renders
them. The owner kit email renders them. They are not a collection and they are not edited.

`vk-posts` stores one row per `(digest, vkCommunityId)`: status, the VK post id, and the last
error. The unique index is what makes a retry post at most once (FR-035).

**Rationale**: The spec says a chat post can be regenerated at any time and is not edited by
hand. Storing eight texts would go stale the moment the owner edits the issue. The VK row is
different: it is the fact that a wall post exists, which cannot be derived by rendering text.

**Length limits** (characters, counted the way that platform counts them):

| Chat     | Limit | Counting            | What the post includes                  |
| -------- | ----- | ------------------- | --------------------------------------- |
| Telegram | 4096  | UTF-16 code units   | First 3 items, then a "more items" line |
| VK wall  | 16384 | Unicode code points | Every item                              |
| WhatsApp | 65536 | Unicode code points | First 3 items, then a "more items" line |
| Facebook | 63206 | Unicode code points | First 3 items, then a "more items" line |

VK does not publish an official `message` cap. 16384 is the figure current posting tools use,
and `wall.post` is called with HTTP POST so the old ~1000-character GET limit does not apply.
The number lives in one constant. If a post is still over its limit after the item cap, the
lowest-ranked items are dropped and counted in the "more items" line. The summary, the
disclaimer, and the links are never dropped (FR-032).

**Alternatives considered**:

- _Store the eight posts when the issue is published._ Rejected: an owner edit would either
  stale them or force a write path the spec says does not re-send.
- _A VK SDK._ Rejected: one form POST is the whole integration, and a dependency is a new
  package for no behavior.

---

## R6 — Tokens are random, stored only as hashes, and do not carry the address

**Decision**: Confirmation and unsubscribe tokens are 32 random bytes, encoded base64url. The
row stores SHA-256 of the token, never the token. Lookup hashes the URL token and finds the row.

- The confirmation hash is single-use and expires 7 days after it was issued. A newer
  confirmation email replaces the hash, which kills the previous link.
- The unsubscribe hash is created when the subscription is confirmed. It has no expiry while
  the row exists. The same hash is used by the visible page and by the RFC 8058 POST.
- Issue-email links use `/{language}/…` so the page is in the subscriber's language even when
  the row has since been erased. An unknown token renders "not subscribed" in that locale. It
  does not 404 and it does not send mail.

**Rationale**: FR-023 forbids the address appearing in the link, and forbids expiry while the
address is stored. A hash means a database leak does not hand out live links. Putting the
language in the path, not in the token, keeps the erased-row page in the right language without
keeping the row.

**Alternatives considered**:

- _HMAC of the subscriber id with no stored secret per row._ Rejected: rotating the server
  secret would invalidate every unsubscribe link, and there is no per-row way to kill one link.
- _Store the raw token._ Rejected: unnecessary; the hash is enough to look up and safer to back up.

---

## R7 — Clicks are counted only on links to this site, and the redirect never blocks them

**Decision**: Issue emails link to this site through `GET /r/{clickToken}/{target}` where
`target` is `issue`, `privacy`, or `subscribe`. The token is its own secret on the delivery
row (`clickTokenHash`), not the unsubscribe token, so one unsubscribe link cannot mark every
issue. The handler sets `clicked = true` on that row, then responds `302` to the real URL on
`PUBLIC_SITE_URL`. The flag write is in a `try`/`finally`: a database error still redirects.
An unknown token redirects to the site root.

External URLs (the paper, the trial) are written as plain links, not wrapped. The unsubscribe
link is not a click target.

**Rationale**: FR-039 says counting must not make a link less reachable than a direct link to
the site. A redirect on the same host has the same reachability as that direct link, including
when the reader's network blocks the site. Wrapping a PubMed URL would make it _less_ reachable,
because it would start depending on our host. The unsubscribe link is a different action and
must not be recorded as "they came back to the issue".

**Alternatives considered**:

- _An open `?url=` parameter._ Rejected: that is an open redirect.
- _Resend's click endpoint._ Rejected: see R4.

---

## R8 — The chat source is a session cookie; the counters do not read it

**Decision**: `proxy.ts` sets a first-party cookie `src` when the query string carries
`vk`, `wa`, `fb`, or `tg`. The cookie is `HttpOnly`, `SameSite=Lax`, `Path=/`, a session
cookie (no `Max-Age`), and `Secure` in production. The first recognized value wins until the
browser session ends. The subscribe form's server render copies it into a hidden field so the
POST still works with JavaScript off. The POST prefers the cookie, then the hidden field, and
stores anything else as `other`.

Page-view counts read the query string of that request only. They do not read the cookie.
Submitting the form does not set an analytics cookie. No third-party script is added.

**Rationale**: FR-006 requires the source to survive a click from the issue to the project
page, and FR-001 requires that path to work without JavaScript. A session cookie is the only
mechanism that does both. FR-038 forbids an _analytics_ cookie; this cookie is not read by the
counters. The privacy note says the chat the reader arrived from is remembered for the visit so
the subscription can be attributed.

**Alternatives considered**:

- _Rewrite every internal link to keep `?src=`._ Rejected: it has to touch every `Link` and
  still breaks when a reader copies a bare URL. The cookie covers the visit the spec describes.
- _`localStorage`._ Rejected: it needs JavaScript, which the form is not allowed to require.

---

## R9 — Unsubscribe is a POST; opening the page does nothing

**Decision**:

- Visible link: `GET /{locale}/unsubscribe/{token}` renders a page with one button. The button
  posts to the same path. A GET, from a person or a scanner, does not change state.
- Mail-client button: the issue email sets `List-Unsubscribe` to the HTTPS one-click URL and
  `List-Unsubscribe-Post: List-Unsubscribe=One-Click`. `POST /api/unsubscribe/{token}` with that
  body unsubscribes immediately and returns 200. It also returns 200 when the address is already
  unsubscribed or already erased, and it sends no mail (FR-023).

Every subscriber email sets `Reply-To` to the project owner's address. The issue email and the
privacy note say that a reply asking to unsubscribe is enough; the owner then unsubscribes that
address in the admin (FR-009).

**Rationale**: FR-022 exists because security scanners GET every link. RFC 8058 is the
one-click path mail clients already show, and it is a POST, so scanners do not fire it.

**Alternatives considered**:

- _Unsubscribe on GET._ Rejected: the spec forbids it, and scanners would empty the list.
- _A second confirmation email after unsubscribe._ Rejected: FR-022 says the one-click action
  has no further step, and FR-023 says the one-click path sends no further mail.

---

## R10 — Bounces unsubscribe; Resend does not keep a second copy of the list

**Decision**: `POST /api/webhooks/resend` accepts only `email.bounced` and `email.complained`.
The signature is checked with Node `crypto` against `RESEND_WEBHOOK_SECRET` (Svix: HMAC-SHA256
over `{svix-id}.{svix-timestamp}.{rawBody}`, secret is the base64 after `whsec_`, timestamp
skew 5 minutes). A bad signature is 400. A good event unsubscribes every subscriber row with
that address (a bounce is about the mailbox, and uniqueness is per project). The lookup uses
the stored Resend email id on the delivery row, then the normalized `to` address.

These Resend features stay off:

- Contacts / Audiences (would copy the list out of Frankfurt).
- Open tracking and click tracking on the sending domain (would record which link, and not in
  our database).

`email.delivery_delayed` is ignored. Resend retries soft bounces itself; if they become
permanent, `email.bounced` arrives and we unsubscribe. Our own retry loop (R11) is for
accept-time failures, not for soft bounces.

The system of record remains Neon in `fra1`. Resend is the transport the project already
accepted in spec 001. This feature does not add a second store.

**Rationale**: FR-020 and FR-026. Webhook verification without the `svix` or `resend` package
on the web app keeps the "no new dependencies" rule. The worker already has the `resend`
package for the old link-only notice; this feature does not start using it.

**Alternatives considered**:

- _Poll Resend for bounces from the sweep._ Rejected: the webhook is the event Resend already
  sends, and polling would need the SDK on the worker for a path the web app can finish in one
  request.
- _Add the `resend` package to `apps/web` for `webhooks.verify`._ Rejected: the verify steps
  are a single HMAC, and the web app's mail path is already raw HTTP.

---

## R11 — Quota waits until the next UTC day; other failures retry three times

**Decision**: Each delivery has `attempts` and `nextAttemptAt`.

| Resend result                                                    | What the sweep does                                                                             |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Accepted                                                         | `sent`, store the email id. `attempts` is not increased.                                        |
| HTTP 429 with `daily_quota_exceeded` or `monthly_quota_exceeded` | Stay `pending`. Set `nextAttemptAt` to the next 00:10 UTC. Do not increase `attempts` (FR-017). |
| HTTP 429 `rate_limit_exceeded` (about 2 req/s)                   | Sleep one second and retry inside the same run. Not an `attempt`.                               |
| Other 5xx or network error                                       | Increase `attempts`. Set `nextAttemptAt` to now + 2 hours.                                      |
| Permanent reject, or `email.bounced`                             | Do not retry. The webhook unsubscribes (R10).                                                   |

A delivery is sent at most four times: the first try plus three retries. Each failed send
increments `attempts` and, while `attempts` is 1, 2, or 3, sets `nextAttemptAt` to now + 2
hours. The failure that sets `attempts` to 4 marks the row `failed`, does not schedule another
try, and calls `logError`. The two-hour gaps put those retries inside the "about 6 hours"
window even though the job is hourly: a failure at 10:00 is eligible again at 12:00 and is
picked up by the 12:00 or 13:00 run. The owner retry sets `failed` rows back to `pending` with
`attempts = 0`.

Sends are one Resend call per recipient, not a batch. A batch fails as a whole, which would
mark fifty deliveries failed because one address was rejected.

**Rationale**: FR-017 and FR-018 describe different outcomes. Counting a quota error as a
failure would exhaust the three retries on a day the list is simply over 100, and the next day
nobody would be retried.

**Alternatives considered**:

- _`POST /emails/batch`._ Rejected: atomic failure, and no per-recipient status.
- _Retry every hour with no `nextAttemptAt`._ Rejected: three hourly retries are only three
  hours, and a quota error would burn them.

---

## R12 — Nobody but the owner is mailed until the from-address is a real domain

**Decision**: `subscriberMailEnabled` is true only when `RESEND_API_KEY` is set and
`RESEND_FROM_EMAIL` is non-empty and does not end in `@resend.dev`. When it is false:

- A submission of the project owner's own address still confirms and can receive issue mail
  (sandbox delivery to the Resend account). This is how SC-005 is rehearsed before DNS exists.
- Any other address gets the same "check your inbox" response, and nothing is stored or sent.
- The sweep logs one warning per run, not an error, and does not fan out.

The from address is `RESEND_FROM_EMAIL` (the verified domain; one domain for the platform).
The visible sender name is the project's `emailFromName`, or the project `name` when that field
is empty. It is not the `HHT News` constant in `email.ts`.

**Rationale**: FR-016 and FR-042. DNS verification is per domain, so the address stays in
configuration. The name is project data, which is what a second research topic would change.
Gating on the from-address means a preview deployment that still has `onboarding@resend.dev`
cannot mail the list by accident.

**Alternatives considered**:

- _A separate `EMAIL_SUBSCRIPTIONS_ENABLED` flag._ Rejected: it can be turned on while the
  from-address is still the sandbox, which is the failure FR-016 exists to prevent. The
  from-address check is the flag.
- _Hide the form until the domain is verified._ Rejected: FR-001 says the form is on every
  issue and project page. The identical response keeps the form from revealing anything while
  the gate is closed.

---

## R13 — The worker asks the web app to translate; it does not translate

**Decision**: When a Russian delivery or the VK post is waiting, the sweep calls
`POST /api/internal/issues/{id}/translate` with `X-Payload-API-Key` and `{ "locale": "ru" }`.
The route runs the existing `resolveIssueTranslation` with a 50-second deadline and no
`after()`, and returns `ready`, `unavailable`, or `failed`. `maxDuration` is 60. The
`issue-translations` collection stays closed to REST writes.

The sweep then:

- Sends English subscribers immediately.
- If Russian text is `ready`, sends Russian subscribers and, when VK is configured, posts the
  Russian wall text.
- If it is not ready and `publishedAt` is less than 6 hours ago, leaves those rows `pending`
  and tries again next run.
- If it is still not ready after 6 hours, sends the English body with a fixed Russian note
  ("the translation is not available"), posts that same fallback to VK once, and `logError`s.
  A Russian translation that appears later does not replace the email or the wall post.

The public issue API is not used for this. It has an 8-second budget meant for a browser, and
calling it would mix translation into a reader endpoint.

**Rationale**: Spec 005 put translation in the web app and kept the worker off the database.
A second translator in the worker would fork the prompt and the single-flight lock. Six hourly
runs cover the "about 6 hours" window: the fallback can land between 6 and 7 hours after
publication, which the spec's "about" allows.

**Alternatives considered**:

- _GET the public issue route with `?locale=ru`._ Rejected: 8-second budget, and the sweep
  would depend on a reader cache policy.
- _Translate inside the worker with the AI SDK._ Rejected: duplicates spec 005's translator
  and its lock.

---

## R14 — When the issue text failed, nothing goes out until the owner asks

**Decision**: On the digest:

| Field                     | Meaning                                                                                                            |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `subscriberFanoutAt`      | Set when the sweep first creates delivery rows. A later edit of the text does not clear it, so nothing is re-sent. |
| `subscriberSendBlockedAt` | Set, with `logError`, when issue text is terminally `failed`. Fan-out does not start.                              |
| `ownerKitSentAt`          | Set when the owner kit email is accepted.                                                                          |

The sweep starts a fan-out only when English text is `ready`, the issue is not hidden,
`subscriberFanoutAt` is empty, and `subscriberSendBlockedAt` is empty. The admin action
"Send to subscribers" clears `subscriberSendBlockedAt`. The next sweep then fans out. It does
not clear `subscriberFanoutAt`, so it cannot send an issue twice.

Hiding the issue before `subscriberFanoutAt` is set prevents the fan-out. Hiding it during a
run is checked before each send; remaining `pending` rows become `skipped`. A VK row that is
not yet `published` becomes `skipped` and is not posted. A `published` VK row is left alone
(FR-019).

The owner kit waits for the same Russian window as the VK post, then sends once, including the
English fallback if the window expired. It is not sent for a hidden issue or a blocked one.

**Rationale**: FR-013 and FR-019. Regeneration in spec 005 sets the text back to `pending` and
then `ready`; without `subscriberFanoutAt` that transition would look like a new issue and
would re-mail everyone.

**Alternatives considered**:

- _A `subscriberDeliveryStatus` enum._ Rejected: `pending` deliveries still need retries after
  the fan-out is "done". Two timestamps plus the delivery rows describe that without a status
  that lies.

---

## R15 — The privacy page is localized chrome plus an authoritative note

**Decision**: `/{locale}/privacy` exists for all five locales. Russian and English message
files contain the legal note (controller, Art. 9(2)(a) consent, what is stored, EU storage,
retention, the click flag, unsubscribe including by reply, how to ask for deletion). German,
Turkish, and Ukrainian pages render that English note and translate only the chrome (title,
back link). The form, the confirmation email, and every issue email link to this page.

**Rationale**: Principle VI requires the five locales to exist. The spec's assumption, which
this plan's constitution check records, says the legal text is authoritative only in Russian
and English. Shipping an unreviewed translation of a consent note would state a different
legal text than the controller's.

**Alternatives considered**:

- _Machine-translate the note into five languages._ Rejected: the note is the consent
  disclosure, not issue prose.
- _English-only route._ Rejected: the form in every locale must be able to link to a privacy
  page in that locale's URL.

---

## R16 — Rate limits are two different stores, and neither is the subscriber row's identity

**Decision**:

- **Per address**: `confirmationSentAt` on the subscriber row. At most one confirmation email
  per address per hour (FR-008). A repeat inside the hour returns "check your inbox" and does
  not replace the token.
- **Per IP**: `subscribe-rate-limits` rows of `{ keyHash, createdAt }`. `keyHash` is
  SHA-256 of the client IP keyed with `PAYLOAD_SECRET`. More than 5 rows for that hash in the
  last hour → the form shows "try again later" (this may say so, because it reveals nothing
  about an address). The sweep deletes rows older than 24 hours.
- **Honeypot**: a hidden field people do not fill. When it is filled, the response is
  "check your inbox" and nothing is stored.

The IP hash is not linked to a subscriber. The privacy note mentions a short-lived security
hash kept for a day. It is not one of the fields FR-007 lists on the subscription, and it is
not stored on that row.

**Rationale**: In-memory limits do not survive a second Vercel instance. Vercel KV is no
longer offered. Postgres is the store the app already has. Hashing the IP keeps the raw
address out of backups' readable columns while still enforcing FR-008.

**Alternatives considered**:

- _Vercel Firewall only._ Rejected: it is not in the Jest suite, and a preview deployment
  would not share the production rule. The table is testable.
- _Store the raw IP on the subscriber._ Rejected: FR-007.

---

## R17 — Anonymous counts are upserts; click totals are queries

**Decision**: `analytics-counts` has a unique index on `(project, issueKey, source, metric)`.
`issueKey` is the digest id, or `none` for a project-page event. `metric` is `page_view`,
`form_submit`, or `confirmation`. The page increments `page_view` from the issue page's server
component (not from the public API, so a page load is one count). The subscribe POST increments
`form_submit` only after consent and a syntactically valid address (not for a honeypot or a
missing checkbox). The confirm handler increments `confirmation` when the state actually
changes to `confirmed`.

The increment is an upsert that adds 1. A failure to count is logged and does not fail the
page or the form.

Click reporting is not this table. The admin aggregate is:

- per issue: how many delivery rows have `clicked = true`;
- one number: how many `confirmed` subscribers have `clicked = true` on two or more issues.

The delivery admin list does not include `clicked`. Field read for that column is denied to
the admin UI. The aggregate endpoint returns numbers only (FR-039).

**Rationale**: A counter row races if two page views read-modify-write. The unique key makes
the upsert one statement. Using `issueKey` text instead of a nullable relationship avoids
Postgres treating two `NULL` digests as distinct in a unique index.

**Alternatives considered**:

- _A third-party analytics script._ Rejected: FR-038.
- _Show `clicked` on the delivery row and trust the owner not to look._ Rejected: the spec
  says there is no way to see which subscriber clicked.

---

## R18 — Re-subscribe and retention are row replacements, not new states

**Decision**: The sweep deletes:

- `pending` rows whose confirmation expiry is more than 24 hours ago (FR-004);
- `unsubscribed` rows whose `unsubscribedAt` is more than 30 days ago, plus their delivery
  rows (FR-024);
- `subscribe-rate-limits` rows older than 24 hours.

A new submission of an `unsubscribed` address, including inside those 30 days, deletes that
row's delivery rows (and therefore the click flags) and replaces the subscriber row with a new
`pending` row: new language, source, consent timestamp, and confirmation token. Anonymous
counter totals are not decremented.

Owner "delete" in the admin does the same deletion immediately (FR-027).

**Rationale**: FR-024's "replace" is simpler than resurrecting a row and trying to clear every
child. The unique `(project, email)` index still holds, because the old row is gone before the
new one is inserted, in one transaction.

**Alternatives considered**:

- _Keep the old row and flip it back to `pending`._ Rejected: too easy to leave the previous
  click history in place, which FR-024 says to delete now.
- _A nightly Vercel cron for deletion._ Rejected: the sweep already runs every hour (R1).

---

## What this research does not reopen

- Resend on the free tier, EU hosting, and full-text email are fixed assumptions in the spec.
- WhatsApp, Facebook, and Telegram stay manual.
- The link-only owner notice from spec 001 stays. Issue mail must not call
  `assertLinkOnlyEmail`, and that function must not be weakened to allow issue bodies through.
