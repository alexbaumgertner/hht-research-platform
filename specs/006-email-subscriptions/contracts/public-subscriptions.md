# Contract: Public Subscribe, Confirm, Unsubscribe, Click, Privacy

**Feature**: `006-email-subscriptions` | **Scope**: reader-facing routes in `apps/web`

Schema: [`data-model.md`](../data-model.md). Decisions: research R2, R6, R7, R8, R9, R12, R15, R16.

The form, the confirmation page, and the unsubscribe page ship in `en`, `de`, `tr`, `ru`, and
`uk`. Email language is only `ru` or `en`. On `de`, `tr`, and `uk` the language control is
preset to English.

---

## 1. Routes

| Route                                        | Method | Purpose                                                                 |
| -------------------------------------------- | ------ | ----------------------------------------------------------------------- |
| `/{locale}/projects/{slug}`                  | GET    | Existing project page, plus the subscribe form.                         |
| `/{locale}/projects/{slug}/issues/{issueId}` | GET    | Existing issue page, plus the subscribe form and one `page_view` count. |
| `/api/public/projects/{slug}/subscribe`      | POST   | Accept or reject a submission. Always redirects (303).                  |
| `/{locale}/subscribe/confirm/{token}`        | GET    | Confirm a pending subscription, or say the link is no longer valid.     |
| `/{locale}/unsubscribe/{token}`              | GET    | Show one button. Does not unsubscribe.                                  |
| `/{locale}/unsubscribe/{token}`              | POST   | The button. Unsubscribes.                                               |
| `/api/unsubscribe/{token}`                   | POST   | RFC 8058 one-click. No page.                                            |
| `/r/{token}/{target}`                        | GET    | Click redirect. `target` is `issue`, `privacy`, or `subscribe`.         |
| `/{locale}/privacy`                          | GET    | Privacy note.                                                           |

No route requires a Payload session. None of them sets an analytics cookie.

---

## 2. Subscribe form

Rendered on the issue page and the project page, for that project. At 360 px, without
JavaScript, the fields are usable and the submit is a normal POST.

Fields:

| Field      | Control                           | Rule                                                                                             |
| ---------- | --------------------------------- | ------------------------------------------------------------------------------------------------ |
| `email`    | email input, required             | Trimmed. Matched by the normalized form (research R3).                                           |
| `language` | radio `ru` or `en`                | Preset `ru` when `locale` is `ru`, otherwise `en`. The reader may change it.                     |
| `consent`  | checkbox, **unchecked**, required | Label names the project and links to `/{locale}/privacy`.                                        |
| `src`      | hidden                            | Copied from the `src` cookie at render. Allow-list only.                                         |
| `company`  | hidden text (honeypot)            | `tabindex="-1"`, `autocomplete="off"`, not displayed. A non-empty value discards the submission. |

The form `action` is `POST /api/public/projects/{slug}/subscribe`.

### Source cookie

Set in `proxy.ts` when the query `src` is `vk`, `wa`, `fb`, or `tg`. The first value in the
browser session wins. `HttpOnly`, `SameSite=Lax`, `Path=/`, no `Max-Age`, `Secure` when the
request is HTTPS. The counters do not read this cookie (research R8).

### POST outcomes

The handler always responds `303` back to the page that submitted (the `Referer` path on this
site, otherwise the project page), with one query flag. The page shows the matching message.
The flag is not personal data.

| Condition                                                                            | Flag           | Stored                         | Mail                           |
| ------------------------------------------------------------------------------------ | -------------- | ------------------------------ | ------------------------------ |
| Consent missing                                                                      | `need_consent` | no                             | no                             |
| Email syntactically invalid                                                          | `bad_email`    | no                             | no                             |
| More than 5 submissions from this IP hash in 1 hour                                  | `try_later`    | no                             | no                             |
| Honeypot filled                                                                      | `check_inbox`  | no                             | no                             |
| Sandbox gate closed and the address is not the owner                                 | `check_inbox`  | no                             | no                             |
| Address already `confirmed`                                                          | `check_inbox`  | no                             | no                             |
| `pending`, and a confirmation was sent less than 1 hour ago                          | `check_inbox`  | no change                      | no                             |
| New address, or `pending` outside that hour, or `unsubscribed` (the row is replaced) | `check_inbox`  | yes, `pending`                 | one confirmation in `language` |
| Resend rejects that confirmation                                                     | `try_later`    | no (the insert is rolled back) | no                             |

`check_inbox` is the same sentence in every row that uses it (FR-005). `try_later` may differ
because it does not reveal whether an address exists (FR-008).

A `form_submit` count happens only when consent was given and the address is syntactically
valid and the honeypot was empty, including the identical-response cases (already confirmed,
hourly suppression, sandbox discard of a non-owner). A `page_view` is counted only on the
issue page, from that request's query `src` (missing or unknown → `other`).

### Confirmation email

- Language: the chosen `language`.
- Body: project name, one sentence asking them to confirm, the confirm link, the privacy link.
  No issue body.
- Confirm link: `{PUBLIC_SITE_URL}/{language}/subscribe/confirm/{token}`.
- `Reply-To`: the project owner's email.
- Idempotency key: `confirm/{subscriberId}/{tokenHashPrefix}`.
- No `List-Unsubscribe`. They are not subscribed yet.

---

## 3. Confirmation page

`GET /{locale}/subscribe/confirm/{token}`.

| Token                                     | Page                                                     | Effect                                                                                          |
| ----------------------------------------- | -------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Hash matches a `pending` row, not expired | Success, in the row's `language`                         | Status `confirmed`. Unsubscribe hash is created. `confirmation` count +1. Welcome issue if due. |
| Already used, expired, or unknown         | "This link is no longer valid. You can subscribe again." | No status change. No mail.                                                                      |

The success page links to the project's latest visible issue.

**Welcome issue.** Sent on this request only when the latest visible issue has English text
`ready`, is not hidden, and `publishedAt` is at most 14 days before now. The handler claims
`(digest, subscriber)` first.

- Claim inserted, subscriber language `en` → send now.
- Claim inserted, language `ru`, Russian text already `ready` → send now.
- Claim inserted, language `ru`, Russian text not ready → leave the row `pending`. The sweep
  applies the 6-hour wait. Do not send English on this request.
- Claim lost because the row is already `sent` → send nothing.
- No issue inside 14 days → send nothing. The first issue is the next one.

The welcome body is the issue email in §5, not a separate template.

---

## 4. Unsubscribe

### Visible page

`GET /{locale}/unsubscribe/{token}` renders a button and does not write.

`POST` of that form:

| Lookup                                 | Page                                          | Effect                                      |
| -------------------------------------- | --------------------------------------------- | ------------------------------------------- |
| Hash matches `confirmed`               | "You are unsubscribed", in the row's language | `unsubscribed`, `unsubscribedAt` set to now |
| Hash matches `unsubscribed`, or no row | "You are not subscribed", in the URL locale   | No mail, no error                           |

The link's locale is the subscriber's language at send time (`ru` or `en`), so an erased row
still gets that language's sentence.

### One-click

Issue emails include:

```text
List-Unsubscribe: <{PUBLIC_SITE_URL}/api/unsubscribe/{token}>
List-Unsubscribe-Post: List-Unsubscribe=One-Click
```

`POST /api/unsubscribe/{token}` accepts `application/x-www-form-urlencoded` body
`List-Unsubscribe=One-Click`. It applies the same effect as the button and responds `200`
with an empty body for every token state, including unknown. It does not redirect and it does
not send mail.

A GET on `/api/unsubscribe/{token}` responds `405`.

---

## 5. Click redirect

`GET /r/{token}/{target}`.

The click token is not the unsubscribe token. `issue-deliveries.clickTokenHash` is the SHA-256
of 32 random bytes, set when the row is inserted, and the URL carries the raw token. The field
is hidden in the admin. A separate token means one unsubscribe link cannot mark every issue
that subscriber received.

| `target`      | Redirect                                             |
| ------------- | ---------------------------------------------------- |
| `issue`       | `/{language}/projects/{slug}/issues/{digestId}`      |
| `privacy`     | `/{language}/privacy`                                |
| `subscribe`   | `/{language}/projects/{slug}?src={source}#subscribe` |
| anything else | `302` to `PUBLIC_SITE_URL`                           |

On a known token, set `clicked = true` when it is still false, then `302`. If that write
throws, `302` anyway. An unknown token `302`s to `PUBLIC_SITE_URL`. A well-formed path does
not respond `500`.

`proxy.ts` sets the `src` cookie from the `subscribe` target's query string, same as any other
arrival.

External item URLs in the email are not passed through `/r/`.

---

## 6. Privacy page

`/{locale}/privacy`.

- `ru` and `en`: the legal note (who the controller is, Art. 9(2)(a), what is stored, that
  storage is in the EU, how long rows are kept, that a click flag is stored per issue, how to
  unsubscribe including by reply, how to ask for deletion).
- `de`, `tr`, `uk`: the English note, with the page title and back link from that locale.

The note also says the chat source is remembered for the browser session, and that a
short-lived hashed rate-limit record is kept for a day and is not attached to the subscription.

---

## 7. Issue email content

Built by `packages/shared`. The web app (welcome) and the worker (sweep) both call it. The
plain-text part and the HTML part carry the same information.

Required, in this order:

1. Project name as the sender name. Not a hardcoded product name.
2. Issue date.
3. Every summary point.
4. Every item, in issue-page order: title, source name, date, plain-language sentence. A trial
   registration is marked as such.
5. The medical disclaimer and the AI-generated label, in the email language. Same meaning as
   `TrustNotice`.
6. When this is the Russian fallback: one fixed Russian sentence that the translation is not
   available. The rest of that body is English.
7. The visible unsubscribe link (§4) and the privacy link (via `/r/…/privacy`).
8. A link to the issue (via `/r/…/issue`). The body stays understandable after every URL is
   removed.

Also: `Reply-To` the owner, and the one-click headers from §4. Idempotency key:
`issue/{digestId}/subscriber/{subscriberId}`.

Deleting every `http` URL from the plain-text part must still leave items 1–6.
