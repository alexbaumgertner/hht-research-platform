# Contract: Admin Surfaces and the Resend Webhook

**Feature**: `006-email-subscriptions` | **Scope**: Payload admin UI and `POST /api/webhooks/resend`

Schema: [`data-model.md`](../data-model.md). Decisions: research R5, R10, R14, R17.

The owner works in the existing Payload admin. This feature adds fields and three UI
components. It does not add a second admin app, and it does not add a screen that composes an
email.

---

## 1. Subscriber list

Collection `subscribers`, group Research.

The owner sees `email`, `language`, `source`, `status`, `consentAt`, and the project. They do
not see token hashes.

Actions on a row:

| Action      | Effect                                                                       |
| ----------- | ---------------------------------------------------------------------------- |
| Unsubscribe | Sets `unsubscribed` and `unsubscribedAt`. The next sweep will not mail them. |
| Delete      | Deletes the row and its `issue-deliveries` now, including click flags.       |

There is no "email this person" action and no body field.

A filter or a small summary on the project shows confirmed and pending counts by `source` and
by `language` (FR-028). Those counts are computed, not a separate store.

---

## 2. Digest edit view

When the issue has text, the edit view shows:

**Post kit** (`IssuePostKit`). Eight plain-text blocks, one per chat and language, each with a
copy button. Built by the shared function in the delivery contract §8. Copy uses the clipboard
API; the text is also selectable if the clipboard call is denied. Hidden issues still show the
kit so the owner can read what would have gone out, but the owner kit email is not sent for a
hidden issue.

**Deliveries** (`IssueDeliveryStatus`). Counts of `issue-deliveries` for this digest by
`sent`, `pending`, `failed`, and `skipped`. The `clicked` column is not on this screen.

| Control             | Shown when                       | Effect                                                                                          |
| ------------------- | -------------------------------- | ----------------------------------------------------------------------------------------------- |
| Retry failed        | `failed` count > 0               | Sets those rows to `pending`, `attempts = 0`, `nextAttemptAt` empty. The next sweep sends them. |
| Send to subscribers | `subscriberSendBlockedAt` is set | Clears `subscriberSendBlockedAt`. The next sweep fans out.                                      |

**VK.** Shows the `vk-posts` status for this digest, or "not configured" when the project has
no `vkCommunityId`. A failed row has a retry control that sets `pending`. The component never
requests or renders `VK_COMMUNITY_TOKEN`.

---

## 3. Project metrics

`SubscriberMetrics` on the research project edit view. Numbers only:

| Figure                                        | Source                                               |
| --------------------------------------------- | ---------------------------------------------------- |
| Page views, form submissions, confirmations   | `analytics-counts`, per `issueKey` and per `source`  |
| Clicking subscribers per issue                | count of deliveries for that digest with `clicked`   |
| Subscribers who clicked in two or more issues | one count of confirmed subscribers meeting that test |

The component's loader returns those numbers and nothing else. It does not return subscriber
ids, addresses, or which issue a named person clicked. The delivery collection's admin config
omits `clicked` and `clickTokenHash` from every list, filter, and default column.

---

## 4. Resend webhook

```http
POST /api/webhooks/resend
```

No session. The body is read as raw text. The signature is checked before any parse that
trusts the JSON (research R10):

- Headers `svix-id`, `svix-timestamp`, `svix-signature`.
- Signed payload: `{svix-id}.{svix-timestamp}.{rawBody}`.
- HMAC-SHA256 using the base64 secret after the `whsec_` prefix of `RESEND_WEBHOOK_SECRET`.
- Reject when the timestamp is more than 5 minutes from now, or when no `v1` signature matches.
- A failed check responds `400` and writes nothing.

Handled events:

| Event              | Effect                                                                                  |
| ------------------ | --------------------------------------------------------------------------------------- |
| `email.bounced`    | Unsubscribe every `subscribers` row with that normalized address. Set `unsubscribedAt`. |
| `email.complained` | Same.                                                                                   |
| anything else      | `200`, no write. Open and click events are not subscribed.                              |

Address match uses `resendEmailId` on a delivery row when present, otherwise the event's `to`
address lowercased. Unsubscribing is idempotent: a second event for an already unsubscribed
address responds `200` and does not send mail.

The endpoint responds `200` after a handled event so Resend does not retry a success. It
responds `500` only when the signature was valid and the write failed, so Resend will retry.

Webhook registration (dashboard or API, not app code) selects `email.bounced` and
`email.complained` only. Open tracking and click tracking stay off on the sending domain.
Resend Contacts are not used.

---

## 5. Environment

| Name                    | Where       | Required to go live          | Notes                                         |
| ----------------------- | ----------- | ---------------------------- | --------------------------------------------- |
| `RESEND_API_KEY`        | web, worker | yes                          | Already used.                                 |
| `RESEND_FROM_EMAIL`     | web, worker | yes, and not `@resend.dev`   | The sandbox gate (research R12).              |
| `RESEND_WEBHOOK_SECRET` | web         | yes, before real subscribers | `whsec_…`. Absent → the route responds 400.   |
| `VK_COMMUNITY_TOKEN`    | worker only | only if VK should post       | Never in the admin and never logged.          |
| `PUBLIC_SITE_URL`       | web, worker | yes                          | Absolute links in mail.                       |
| `PAYLOAD_API_KEY`       | both        | yes                          | Worker REST and the internal translate route. |

`emailFromName` and `vkCommunityId` are project fields, not env vars.
