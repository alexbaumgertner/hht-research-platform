# Data Model: Email Subscriptions and Chat Delivery

**Branch**: `006-email-subscriptions` | **Date**: 2026-09-26 | **Spec**: [`spec.md`](./spec.md)

Additive only (same rule as spec 005). New collections, new nullable fields on `digests` and
`research-projects`, new unique indexes. Nothing is renamed or removed. Field names are Payload
field names.

Chat posts are not stored (research R5). The click flag is a column on `issue-deliveries`, not
its own collection (R4).

---

## 1. `subscribers`

One email address subscribed to one project (spec entity **Subscriber**).

| Field                   | Type                                              | Default   | Access                               | Notes                                                                                  |
| ----------------------- | ------------------------------------------------- | --------- | ------------------------------------ | -------------------------------------------------------------------------------------- |
| `project`               | relationship → `research-projects`                | —         | system                               | Required. Every row belongs to a project (FR-042).                                     |
| `email`                 | text, required                                    | —         | system                               | Stored lowercased. Plus-tags kept (FR-007, R3).                                        |
| `language`              | select `ru` \| `en`                               | —         | system                               | The email language, not the UI locale.                                                 |
| `source`                | select `vk` \| `wa` \| `fb` \| `tg` \| `other`    | `other`   | system                               | Chat the reader arrived from (FR-006).                                                 |
| `status`                | select `pending` \| `confirmed` \| `unsubscribed` | `pending` | system; admin may set `unsubscribed` | See states below.                                                                      |
| `consentAt`             | date, required                                    | —         | system                               | When the checkbox was submitted (FR-026).                                              |
| `confirmationTokenHash` | text                                              | —         | hidden                               | SHA-256 of the current confirmation token. Null once confirmed or replaced.            |
| `confirmationExpiresAt` | date                                              | —         | hidden                               | Seven days after the token was issued, while `pending`.                                |
| `confirmationSentAt`    | date                                              | —         | hidden                               | Last confirmation email. Enforces one per hour (FR-008).                               |
| `unsubscribeTokenHash`  | text                                              | —         | hidden                               | SHA-256. Set when status becomes `confirmed`. No expiry while the row exists (FR-023). |
| `unsubscribedAt`        | date                                              | —         | system                               | Set on every unsubscribe path. The sweep deletes the row 30 days later.                |

Unique index: `(project, email)`.

`confirmationTokenHash` and `unsubscribeTokenHash` each have a unique index. The column is
null when there is no live token. Postgres unique indexes allow multiple nulls, so confirmed
rows do not collide with each other.

Admin list columns: `email`, `language`, `source`, `status`, `consentAt`. Token fields are
not in the admin UI. The owner may unsubscribe or delete a row. The owner cannot compose an
email (FR-028).

### States

```text
pending --confirm link, once, within 7 days--> confirmed --unsubscribe--> unsubscribed
   |                                              |                            |
   | 24h after confirmationExpiresAt              | owner delete               | 30 days, or owner delete
   +----------------------------------------------+----------------------------+--> row gone
```

A new submission of an `unsubscribed` address deletes that row and its `issue-deliveries`, then
inserts a new `pending` row (FR-024, R18). A submission of a `confirmed` address changes
nothing and sends nothing. A submission of a `pending` address sends a new confirmation only
when `confirmationSentAt` is at least an hour ago, and that send replaces the token hash.

A `pending` row receives no mail except its confirmation email (FR-004).

---

## 2. `issue-deliveries`

The record that one issue was or was not delivered to one subscriber (spec entity **Issue
Delivery**). Erased with the subscriber, including when an unsubscribed row is replaced
(FR-024).

| Field            | Type                                                | Default   | Access                                         | Notes                                                          |
| ---------------- | --------------------------------------------------- | --------- | ---------------------------------------------- | -------------------------------------------------------------- |
| `project`        | relationship → `research-projects`                  | —         | system                                         | Must match the subscriber's project.                           |
| `digest`         | relationship → `digests`                            | —         | system                                         | The issue.                                                     |
| `subscriber`     | relationship → `subscribers`                        | —         | system                                         |                                                                |
| `status`         | select `pending` \| `sent` \| `failed` \| `skipped` | `pending` | worker; admin may set `failed` → `pending`     | Claim and outcome (R4, R11).                                   |
| `attempts`       | number, min 0                                       | `0`       | worker                                         | Retry count. Quota deferrals do not increase it.               |
| `nextAttemptAt`  | date                                                | —         | worker                                         | The sweep skips the row until this time.                       |
| `sentAt`         | date                                                | —         | worker, admin read                             |                                                                |
| `resendEmailId`  | text                                                | —         | hidden                                         | Maps a bounce webhook back to the row (R10).                   |
| `lastError`      | text                                                | —         | worker, admin read                             | Also logged at ERROR when status becomes `failed`.             |
| `clicked`        | checkbox                                            | `false`   | worker write; **not readable in the admin UI** | Set once. Cleared only by deleting the row (FR-039, R17).      |
| `clickTokenHash` | text                                                | —         | hidden                                         | SHA-256 of the `/r/` token. Unique. Not the unsubscribe token. |

Unique indexes: `(digest, subscriber)`, and `clickTokenHash` (multiple nulls allowed until the token is issued).

### Delivery states

```text
(no row) --claim insert--> pending --Resend accepts--> sent
                              |  \
                              |   +-- issue hidden, or subscriber not confirmed --> skipped
                              |
                              +-- fourth failed send (attempts = 4) --> failed --owner retry--> pending
```

`pending` with `nextAttemptAt` in the future stays `pending` (quota, or the two-hour gap).
`sent` is never sent again. A click does not change `status`.

The welcome send and the sweep share this table. The caller that inserts the row is the only
sender (R2, R4).

---

## 3. `vk-posts`

The fact that an issue was posted to one community (spec entity **VK Post Record**).

| Field           | Type                                                     | Default   | Access                                     | Notes                                                 |
| --------------- | -------------------------------------------------------- | --------- | ------------------------------------------ | ----------------------------------------------------- |
| `project`       | relationship → `research-projects`                       | —         | system                                     |                                                       |
| `digest`        | relationship → `digests`                                 | —         | system                                     |                                                       |
| `vkCommunityId` | text, required                                           | —         | system                                     | Copied from the project at insert time. Not a secret. |
| `status`        | select `pending` \| `published` \| `failed` \| `skipped` | `pending` | worker; admin may set `failed` → `pending` |                                                       |
| `vkPostId`      | text                                                     | —         | worker, admin read                         | Wall post id from VK. Proof the post is on the wall.  |
| `lastError`     | text                                                     | —         | worker, admin read                         |                                                       |

Unique index: `(digest, vkCommunityId)`.

No row is created when the project has no `vkCommunityId`, or the worker has no
`VK_COMMUNITY_TOKEN`. That is "not configured": nothing is posted and nothing is logged
(FR-034). A `published` row is never replaced with a later post. `skipped` means the issue was
hidden before `vkPostId` was set.

The community token is not a field. It is the worker env var `VK_COMMUNITY_TOKEN` (FR-037).

---

## 4. `analytics-counts`

Anonymous counters (spec entity **Analytics Count**). No email, no token, no subscriber id.

| Field      | Type                                                  | Notes                                                |
| ---------- | ----------------------------------------------------- | ---------------------------------------------------- |
| `project`  | relationship → `research-projects`                    | Required.                                            |
| `issueKey` | text, required                                        | Digest id, or `none` for a project-page event (R17). |
| `source`   | select `vk` \| `wa` \| `fb` \| `tg` \| `other`        | From the request query string, not the cookie.       |
| `metric`   | select `page_view` \| `form_submit` \| `confirmation` |                                                      |
| `count`    | number, min 0                                         | Incremented by an upsert of +1.                      |

Unique index: `(project, issueKey, source, metric)`.

These rows are not deleted when a subscriber is erased. FR-024 keeps anonymous aggregates.

---

## 5. `subscribe-rate-limits`

Not personal data linked to a subscriber (R16).

| Field       | Type | Notes                                                            |
| ----------- | ---- | ---------------------------------------------------------------- |
| `keyHash`   | text | SHA-256 of `PAYLOAD_SECRET` and the client IP. Indexed.          |
| `createdAt` | date | Payload's timestamp. The sweep deletes rows older than 24 hours. |

No unique index. The limit is more than 5 rows for that hash in the last hour.

---

## 6. `digests`: new fields

| Field                     | Type | Default | Access                                                   | Notes                                                                                      |
| ------------------------- | ---- | ------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `subscriberFanoutAt`      | date | —       | worker                                                   | Set when delivery rows are first created. An edit or a regenerate does not clear it (R14). |
| `subscriberSendBlockedAt` | date | —       | worker; the admin action "Send to subscribers" clears it | Set when issue text is terminally `failed` (FR-013).                                       |
| `ownerKitSentAt`          | date | —       | worker                                                   | Set when Resend accepts the owner kit email.                                               |

`hiddenFromPublic`, `issueTextStatus`, and `publishedAt` keep their spec 005 meaning. The sweep
reads them.

The post kit, the delivery counts, the VK status, and the retry / start-send actions are admin
UI on the digest, specified in [`admin-and-webhooks.md`](./contracts/admin-and-webhooks.md).
They are not extra columns the owner edits as text.

---

## 7. `research-projects`: new fields

| Field           | Type | Default | Access | Notes                                                                              |
| --------------- | ---- | ------- | ------ | ---------------------------------------------------------------------------------- |
| `emailFromName` | text | —       | admin  | Visible sender name. Falls back to `name` (FR-042, R12).                           |
| `vkCommunityId` | text | —       | admin  | Numeric community id, without the minus sign. Empty means VK is off. Not a secret. |

`emailNotificationEnabled` and the link-only owner notice are unchanged.

The from address is `RESEND_FROM_EMAIL`, not a project field (R12). Reply-To is the related
owner user's `email`, which the worker already loads.

---

## 8. Relationships

```text
research-projects 1──* subscribers 1──* issue-deliveries *──1 digests
research-projects 1──* vk-posts *──1 digests
research-projects 1──* analytics-counts
```

Deleting a subscriber deletes its `issue-deliveries` in the same operation. Deleting a project
deletes that project's subscribers, deliveries, vk-posts, and analytics counts.

---

## 9. What is deliberately not stored

- The raw confirmation, unsubscribe, or click token.
- Which link was clicked, when, or how often (only `clicked`).
- The raw IP address.
- A Resend contact id.
- The VK access token.
- The eight chat-post texts.
