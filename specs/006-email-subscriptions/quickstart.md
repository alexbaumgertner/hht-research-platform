# Quickstart: Email Subscriptions and Chat Delivery

**Branch**: `006-email-subscriptions` | **Spec**: [`spec.md`](./spec.md)

Runnable checks for the feature. Contracts:
[`public-subscriptions.md`](./contracts/public-subscriptions.md),
[`delivery-sweep.md`](./contracts/delivery-sweep.md),
[`admin-and-webhooks.md`](./contracts/admin-and-webhooks.md).
Schema: [`data-model.md`](./data-model.md).

CI runs the automated sections. Mailbox placement and a live VK post are launch checks and
stay manual.

## Prerequisites

- Local Postgres via `DATABASE_URL` (`docker compose up -d`), then
  `pnpm --filter @hht/shared build && pnpm --filter @hht/web ensure-schema`. The new collections
  are created by that push. There is no migration script.
- `pnpm install` at the repo root. No new npm packages.
- Seed: `pnpm --filter @hht/web seed:public-feed`. The seed gains one `ready` issue and one
  confirmed subscriber per language so the sweep tests have rows. Tests that need an empty
  subscriber list create their own.
- Mail stub, same rule as the translator stub: `EMAIL_DELIVERY=stub` is honored only when
  `VERCEL_ENV` is not `production`. The stub records the last messages in memory and does not
  call Resend. Playwright starts the app with `EMAIL_DELIVERY=stub`.
- The sandbox gate is open in tests by setting `RESEND_FROM_EMAIL` to a non-`resend.dev`
  address even under the stub. A test that wants the gate closed sets `onboarding@resend.dev`.

## 1. Subscribe without JavaScript (US1)

```bash
EMAIL_DELIVERY=stub pnpm dev
```

Open `http://localhost:3000/ru/projects/hht-research/issues/{id}?src=tg` at 360 px width with
JavaScript disabled.

| Check                                       | Expected                                                                                                               |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Form                                        | Email, language preset to Russian, consent checkbox unchecked, link to `/ru/privacy`                                   |
| Submit, no consent                          | Stays on the page, message asks for consent, subscriber count unchanged                                                |
| Submit with consent                         | "Check your inbox". Stub recorded one Russian confirmation. Admin shows one `pending` row, source `tg`, language `ru`. |
| Open the confirm link from the stub         | Success page in Russian. Status `confirmed`. If the issue is ≤ 14 days old, the stub has the issue email too.          |
| Submit the same address again               | The same "check your inbox" sentence. No second row. No second confirmation.                                           |
| `User@Example.com` after `user@example.com` | One row.                                                                                                               |
| `user+hht@gmail.com`                        | A different row.                                                                                                       |

Repeat the form on `/de/projects/hht-research`. Language preset is English. Chrome is German.
The privacy link opens `/de/privacy` and the note body is the English text.

Cross-page source: land on the issue with `?src=wa`, follow the in-site link to the project
page (the project URL has no `src`), submit there. The row's source is `wa`.

## 2. Issue email is complete with links removed (US2)

Jest on `issueEmailBody`, not a mailbox:

- A fixture issue with two summary points and three items, one of them a trial.
- Build the Russian and the English bodies.
- Delete every substring that starts with `http`.
- The remaining plain text still contains the project name, the date, both points, each item's
  title, source, date, and sentence, the trial label, the disclaimer, and the AI label.

The delivery-decision tests cover: one claim wins and the loser does not send; a `sent` row is
not sent again; a hidden issue moves `pending` to `skipped`; Russian inside 6 hours waits;
Russian after 6 hours is the English body plus the Russian note; a 429 quota does not increase
`attempts`; the failure that sets `attempts` to 4 becomes `failed` (first try plus three retries).

Sweep against the stub, one confirmed subscriber per language, issue text `ready`:

```bash
EMAIL_DELIVERY=stub pnpm --filter @hht/worker exec tsx src/index.ts
```

Expected: two issue emails, one per language, and one owner kit. A second run of the worker
adds no further issue emails (`subscriberFanoutAt` set, both rows `sent`).

## 3. Unsubscribe (US3)

From a stub issue email, open the visible unsubscribe URL.

| Check                         | Expected                                                                    |
| ----------------------------- | --------------------------------------------------------------------------- |
| The GET                       | A page with one button. Status still `confirmed`.                           |
| The POST of the button        | "You are unsubscribed" in the subscriber's language. Status `unsubscribed`. |
| Publish-equivalent next sweep | That address gets nothing.                                                  |
| Open the same URL again       | "You are not subscribed". Not an error page.                                |
| The token                     | The path contains no `@`.                                                   |

One-click, with the token from the `List-Unsubscribe` header:

```bash
curl -i -X POST \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data "List-Unsubscribe=One-Click" \
  http://localhost:3000/api/unsubscribe/{token}
```

Expected: `200`, status `unsubscribed`, no new stub message. A second POST is also `200`.

A GET on that same URL is `405`, and the subscriber stays `confirmed` if they were.

## 4. Post kit and VK (US4, US5)

In the admin, open the ready issue.

| Check                    | Expected                                                                                 |
| ------------------------ | ---------------------------------------------------------------------------------------- |
| Blocks                   | 8, each with a copy button                                                               |
| VK Russian               | Every item, disclaimer, issue link ending in `src=vk`, subscribe link ending in `src=vk` |
| Telegram, 7-item fixture | First 3 items and a line that 4 more are in the full issue                               |
| Over the Telegram limit  | Lowest items dropped, summary and links kept. Covered by `chatPost.test.ts`.             |
| Owner inbox (the stub)   | One kit email after the sweep in §2                                                      |

VK without config: empty `vkCommunityId`. Run the sweep. No `vk-posts` row, no error in the log.

VK with config: set `vkCommunityId` and `VK_COMMUNITY_TOKEN`. The sweep test mocks `fetch` to
`api.vk.com`. One `wall.post` with `from_group=1` and `owner_id` negative. The row stores
`vkPostId` and `published`. A second run does not call `wall.post` again.

Hide the issue before `vkPostId` is set (leave the row `pending`). The next sweep sets
`skipped` and does not call VK. Hide after `published`: the row stays `published`.

Russian missing: freeze the translate route so it returns `failed`, set `publishedAt` to
7 hours ago, run the sweep. One wall post whose message contains the English text and the
Russian note, and one `logError`. A later `ready` translation does not change `vkPostId`.

## 5. Counts and the click flag (US6)

| Check                                      | Expected                                                                                                                              |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| Open the issue with `?src=fb`              | `page_view` / `fb` is 1                                                                                                               |
| Open it with no `src`                      | `page_view` / `other` is 1                                                                                                            |
| Submit the form once                       | `form_submit` increases by 1 for that source                                                                                          |
| Document cookies after browsing            | No analytics cookie. The `src` cookie may be present; the counters do not read it.                                                    |
| Network panel                              | No third-party analytics host                                                                                                         |
| Open `/r/{clickToken}/issue` from the stub | `302` to the issue page. Admin metrics show one clicking subscriber for that issue. The delivery list does not show a clicked column. |
| Break the database write (unit test)       | The redirect is still `302`                                                                                                           |
| Two issues clicked by one subscriber       | The "two or more issues" figure is 1, with no address next to it                                                                      |

## 6. Webhook (FR-020)

```bash
# Sign the raw body the way research R10 describes, then:
curl -i -X POST http://localhost:3000/api/webhooks/resend \
  -H "svix-id: …" -H "svix-timestamp: …" -H "svix-signature: …" \
  --data '{ "type": "email.complained", "data": { "to": ["subscriber@example.com"], "email_id": "re_123" } }'
```

A valid complaint or permanent bounce sets that address to `unsubscribed` on every project.
A missing or bad signature is `400` and does not change the row. Jest covers the HMAC cases
with a known `whsec_` secret; the curl above is the local end-to-end check.

## 7. Automated commands

```bash
pnpm --filter @hht/shared test
pnpm --filter @hht/web test
pnpm --filter @hht/worker test
pnpm --filter @hht/web exec playwright test tests/e2e/subscriptions.spec.ts
```

`subscriptions.spec.ts` runs the §1 form (including 360 px and JavaScript disabled), the
cross-page `src`, the confirm link from the stub, and the unsubscribe GET-then-POST. It does
not call Resend or VK.

## 8. Launch checklist (not CI)

Do these before `RESEND_FROM_EMAIL` leaves `@resend.dev`. Until then, only the owner's address
can be stored or mailed.

- The sending domain has SPF, DKIM, and DMARC. `RESEND_FROM_EMAIL` is an address on that domain.
- Resend open tracking and click tracking are off for the domain. No Contacts audience is filled.
- The webhook is registered for `email.bounced` and `email.complained` only, and
  `RESEND_WEBHOOK_SECRET` is set on the web app.
- `VK_COMMUNITY_TOKEN` is set on the worker only if `vkCommunityId` is set. It is not in the
  web app's env and not in the admin.
- Send one issue to a test subscriber in Gmail, Mail.ru, Yandex Mail, and Apple Mail, on a
  phone, with links disabled in the client. The full text is readable and the message is not
  in spam (SC-005).
- Use the mail client's unsubscribe button on one of those messages and confirm the row
  becomes `unsubscribed` before the next sweep.
