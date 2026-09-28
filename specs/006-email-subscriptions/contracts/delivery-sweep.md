# Contract: Delivery Sweep, VK, and Erasure

**Feature**: `006-email-subscriptions` | **Scope**: `apps/worker` end-of-job sweep, plus one internal route on `apps/web`

Schema: [`data-model.md`](../data-model.md). Decisions: research R1, R2, R4, R5, R11, R13, R14, R18.
The issue email body is public contract §7.

The worker reaches the CMS only through Payload REST, as it does today. It does not open
Postgres. Translation stays in the web app.

---

## 1. When the sweep runs

`apps/worker/src/index.ts`, inside the existing `finally`, after `sweepIssueText()`:

```text
sweepIssueText(cms)
sweepSubscriptions(cms)
```

A failure in the new sweep is caught and `logError`ed. It does not change run status or
watermarks. No new Cloud Scheduler job. No Vercel cron.

Each run, in order:

1. Start fan-out for issues whose text just became sendable.
2. Send due `pending` deliveries (including Russian waits and retries).
3. Post due VK rows.
4. Send the owner kit once.
5. Delete expired rows.

Before each individual send or VK post, re-read `hiddenFromPublic`. If the issue is now
hidden, mark the remaining `pending` deliveries and any unpublished VK row `skipped` and stop
that issue.

---

## 2. Fan-out

An issue is eligible when all of these hold:

- `issueTextStatus` is `ready`;
- `hiddenFromPublic` is false;
- `subscriberFanoutAt` is empty;
- `subscriberSendBlockedAt` is empty;
- the sandbox gate is open (research R12), or the only recipient would be the owner.

Then, for every `confirmed` subscriber of that project with no `issue-deliveries` row for this
digest, insert `pending`. Set `subscriberFanoutAt`. English rows are due now. Russian rows are
due now only if the Russian translation is already `ready`; otherwise they wait (§3).

If `issueTextStatus` is `failed` and `subscriberFanoutAt` is empty, set
`subscriberSendBlockedAt` if it is empty and `logError` once. Do not insert delivery rows and
do not create a VK row.

The admin action "Send to subscribers" clears `subscriberSendBlockedAt`. The next run treats
the issue as eligible. It does not clear `subscriberFanoutAt`, so an issue that was already
sent is not sent again.

Regenerating or editing the text does not clear `subscriberFanoutAt` and does not insert new
rows for subscribers who already have one.

---

## 3. Russian wait

For a Russian delivery or a VK post that still needs Russian text, the sweep calls:

```http
POST /api/internal/issues/{digestId}/translate
X-Payload-API-Key: {PAYLOAD_API_KEY}
Content-Type: application/json

{ "locale": "ru" }
```

The route is not public. A missing or wrong key is `401`. It runs the existing
`resolveIssueTranslation` with a 50-second deadline and no `after()`, and returns:

```json
{ "status": "ready" }
```

or `"unavailable"` (English text missing) or `"failed"`. `maxDuration` is 60. The
`issue-translations` collection is not opened to REST.

| Clock                                        | English subscribers       | Russian subscribers and VK                                       |
| -------------------------------------------- | ------------------------- | ---------------------------------------------------------------- |
| Russian text `ready`                         | send English              | send / post Russian                                              |
| Not ready, and `now < publishedAt + 6 hours` | send English, do not wait | leave `pending`, try next run                                    |
| Not ready, and the 6 hours have passed       | already sent              | send / post English plus the fixed Russian note; `logError` once |

The fallback email is the one email for that subscriber (the row becomes `sent`). The fallback
wall post is the one VK post (`published`). A Russian translation that appears later does not
replace either.

---

## 4. Sending one delivery

Skip the row when `nextAttemptAt` is in the future, the subscriber is not `confirmed`, or the
issue is hidden (then set `skipped`).

Otherwise claim is already the row. Call Resend once.

| Result                                                        | Row                                                                               |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Accepted                                                      | `sent`, set `sentAt` and `resendEmailId`                                          |
| 429 `daily_quota_exceeded` or `monthly_quota_exceeded`        | stay `pending`; `nextAttemptAt` = next 00:10 UTC; do not increase `attempts`      |
| 429 `rate_limit_exceeded`                                     | sleep 1 second, try again in this run; not an attempt                             |
| Other 5xx or a network error, and `attempts` is still under 3 | `attempts += 1` (now 1, 2, or 3); `nextAttemptAt` = now + 2 hours; stay `pending` |
| Other 5xx or a network error, and `attempts` is already 3     | `attempts` becomes 4; `failed`; `logError`; keep `lastError`. No further try.     |

Idempotency key: `issue/{digestId}/subscriber/{subscriberId}`. One HTTP call per recipient, not
a batch.

The sandbox gate (research R12): when the from-address is still `@resend.dev`, the sweep sends
only to the owner's address and logs one warning per run, not an error.

---

## 5. VK

Configured only when the project `vkCommunityId` is non-empty **and** `VK_COMMUNITY_TOKEN` is
set. Otherwise the sweep does not create a row and does not log.

When configured, the fan-out inserts one `vk-posts` row (`pending`) if none exists. The post
body is the VK chat post (every item, Russian when ready, otherwise the §3 fallback). HTTP
POST:

```text
POST https://api.vk.com/method/wall.post
owner_id=-{vkCommunityId}
from_group=1
message={post text}
access_token={VK_COMMUNITY_TOKEN}
v=5.199
```

On success, store `vkPostId` and set `published`. On failure, `logError`, set `failed`, and do
not change any delivery row. A retry sets `failed` back to `pending`; the unique index plus
"skip when `vkPostId` is set" means a second wall post is not created.

The token is never written to a Payload field, a log line, or an admin response.

---

## 6. Owner kit

Once per issue, when `ownerKitSentAt` is empty, the issue is not hidden, fan-out has started
or the text is `ready`, and the Russian window has resolved the same way as VK (Russian text
ready, or the 6 hours have passed).

One email to the owner. Plain text and HTML. Eight posts, each with a heading for the chat and
the language. Idempotency key: `owner-kit/{digestId}`. Set `ownerKitSentAt` when Resend accepts.
This email has no list-unsubscribe. It is not an issue delivery and it does not use
`assertLinkOnlyEmail`.

The link-only "digest published" notice (`emailNotificationEnabled`) is unchanged and stays
link-only.

---

## 7. Erasure

Each run, delete:

- `subscribers` in `pending` whose `confirmationExpiresAt` is more than 24 hours ago;
- `subscribers` in `unsubscribed` whose `unsubscribedAt` is more than 30 days ago, and their
  `issue-deliveries`;
- `subscribe-rate-limits` rows older than 24 hours.

Do not delete `analytics-counts`.

---

## 8. Chat posts

Pure function in `packages/shared`. Inputs: the issue text in one language, the project name,
the issue date, the disclaimer line, the issue URL with `?src={chat}`, the subscribe URL with
the same `src`.

| Chat                   | Items                      | Limit         |
| ---------------------- | -------------------------- | ------------- |
| `vk`                   | every item                 | 16384         |
| `telegram`             | the first 3 in issue order | 4096 (UTF-16) |
| `whatsapp`, `facebook` | the first 3 in issue order | 65536 / 63206 |

When there are more items than the post includes, append a line with that count. When the post
is still over the limit, drop items from the bottom of the included list and add them to that
count. Never drop the summary, the disclaimer, or the two links. Omit the "more items" line
when the count is zero.

Posts contain no HTML. The admin copy button copies that plain text.
