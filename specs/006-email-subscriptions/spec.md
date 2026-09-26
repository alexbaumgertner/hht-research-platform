# Feature Specification: Email Subscriptions and Chat Delivery

**Feature Branch**: `006-email-subscriptions`

**Created**: 2026-09-25

**Status**: Draft

**Input**: User description: "Email Subscriptions and Chat Delivery — each published issue reaches patients as a full-text email and as a ready-to-post message for the patient chats, so readers who cannot open the site still get the news." (full draft: `docs/spec-drafts/006-email-subscriptions.md`)

## Clarifications

### Session 2026-09-25

- Q: If the site is unreachable from Russian networks, how do readers there subscribe and unsubscribe? → A: Accept that subscribing needs a VPN and rely on the VK community post for readers in Russia; unsubscribe requests sent by email reply are handled manually by the owner from the admin (FR-009).
- Q: Where is the data controller legally based, and what consent basis applies? → A: EU-based; explicit consent (GDPR Art. 9(2)(a)) via an unticked checkbox plus the privacy page; subscriber data stays in the EU (FR-026).
- Q: Should the system record which subscriber clicked a link in which issue? → A: Yes, minimally — one "clicked" flag per issue and subscriber, disclosed in the privacy note and erased with the subscriber; page views and form counts stay anonymous (FR-007, FR-039).
- Q: When an issue email fails to send, what should happen? → A: Retry automatically up to 3 times over about 6 hours; if it still fails, log an error and leave it for a manual retry from the admin (FR-018).
- Q: If the Russian translation is missing, how long should Russian subscribers wait before receiving the English text with a note? → A: Keep retrying the translation for about 6 hours after publication, then send English with a note in Russian and log an error (FR-012).
- Q: How many items should each chat post include? → A: VK posts include every item (full text); WhatsApp, Facebook and Telegram posts include the top 3 items plus a line saying how many more are in the full issue (FR-030, FR-032).
- Q: When someone confirms their subscription, what is the first issue they receive? → A: The latest published, visible issue right away if it is at most 14 days old, then every new issue (FR-010a).

### Session 2026-09-26

- Q: If a person unsubscribes and later uses the same email address to subscribe again before that address is deleted (within 30 days), what should happen? → A: Allow signup again immediately. Replace the old record with a new pending subscription (new language, source, and consent). Require email confirmation again. Delete the old per-issue click history now (FR-024).
- Q: Should `User@Example.com` and `user@example.com` count as one subscription, and should a plus-tag such as `user+hht@gmail.com` count as a different address? → A: Same inbox when only letter case differs. Plus-tags stay different addresses (FR-007).
- Q: If the Russian translation of an issue is not ready when the issue is published, what should happen to the automatic VK community post? → A: Wait and retry for about 6 hours. If the Russian text is still missing, post the English text with a short note in Russian, and log an error (FR-034).
- Q: If the owner hides an issue before its VK post is on the wall, should that post still go out? → A: No. If the issue is hidden before the VK post is published, do not post it. If it is already on the wall, leave that post as it is (FR-019).
- Q: How long should an unsubscribe link in an issue email keep working? → A: No expiry while the address is stored. The link unsubscribes them. If they already unsubscribed, or the address has been erased, the page says they are not subscribed (FR-023).

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Subscribe with double opt-in (Priority: P1)

A patient opens an issue link shared in a patient chat (for example `?src=vk`). On the issue page, or on the project page, they enter their email, keep or change the preselected language (Russian or English, preset from the page they are on), and tick a consent checkbox that links to the privacy note. They get a confirmation email in that language. Only after they follow its link are they subscribed. The chat they came from is recorded with the subscription.

**Why this priority**: Nobody can subscribe today, so quarter criterion 2 (50 confirmed subscribers from patient chats, attributed by source) is impossible until this works. Double opt-in and attribution are what make each subscriber count toward that criterion.

**Independent Test**: Open an issue page with `?src=tg`, submit an address with consent ticked, follow the link in the confirmation email, and confirm that the admin shows one new confirmed subscriber for that project with source `tg` and the chosen language.

**Acceptance Scenarios**:

1. **Given** a visitor on a Russian-locale issue page, **When** the subscribe form renders, **Then** it shows an email field, a language choice preset to Russian, and an unticked consent checkbox linking to the privacy note.
2. **Given** a visitor submits the form without ticking consent, **When** the form is processed, **Then** nothing is stored, no email is sent, and the visitor sees a message asking them to give consent.
3. **Given** a visitor submits a valid address with consent, **When** the form is processed, **Then** they see a "check your inbox" message and receive one confirmation email in the chosen language.
4. **Given** a pending subscription, **When** the visitor follows the confirmation link within 7 days, **Then** the subscription becomes confirmed, the visitor sees a success page in their language, and, if the latest issue was published at most 14 days ago, they receive that issue by email right away.
5. **Given** a confirmation link that was already used or is older than 7 days, **When** it is opened, **Then** no subscription is confirmed and the visitor is told the link is no longer valid and can subscribe again.
6. **Given** a visitor arrived via a link carrying `src=wa`, **When** they subscribe on that page or on another page of the site reached through its own links, **Then** the subscription is recorded with source `wa`.
7. **Given** an address that is already confirmed, **When** it is submitted again, **Then** the visitor sees exactly the same response as for a new address, and no information reveals that the address already exists.

---

### User Story 2 - Receive the full issue by email (Priority: P1)

When a weekly issue is published, every confirmed subscriber of that project receives it by email in their language. The email carries the whole issue: date, summary points, and every item with its title, source, date and plain-language sentence, plus the medical disclaimer and the AI-generated label. A reader whose network blocks the site can still read everything in the email.

**Why this priority**: The site may be unreachable from Russian residential and mobile networks, where most of the audience is. The email is the delivery channel that works regardless, and it is what keeps subscribers coming back each week.

**Independent Test**: With at least one confirmed subscriber per language, publish an issue and confirm each subscriber receives exactly one email in their language, and that the email shows the date, all summary points, every item with its sentence, the disclaimer and the AI label, with the site's links disabled.

**Acceptance Scenarios**:

1. **Given** a project with confirmed Russian and English subscribers, **When** an issue is published, **Then** each subscriber receives that issue in their own language, with no manual step by the owner.
2. **Given** an issue email is opened in a mail client with all links blocked, **When** the reader reads it, **Then** the date, every summary point, every item (title, source, date, plain-language sentence), the disclaimer and the AI label are all present in the email body.
3. **Given** the send for an issue is retried, or runs twice at the same time, **When** both runs finish, **Then** each subscriber has received that issue exactly once.
4. **Given** the email is opened on a phone in Gmail, Mail.ru, Yandex Mail or Apple Mail, or in a client that shows plain text only, **When** it renders, **Then** it is readable without horizontal scrolling and without missing content.
5. **Given** a subscriber's address bounces permanently or the subscriber reports the email as spam, **When** that report arrives, **Then** the address is unsubscribed and receives no further issues.

---

### User Story 3 - Unsubscribe in one click (Priority: P1)

A subscriber who no longer wants the emails uses the unsubscribe button their mail client shows, or the visible unsubscribe link in the email. It takes effect immediately, without a login, and they receive nothing further.

**Why this priority**: Easy unsubscribing is a legal and deliverability requirement. Without it, mail providers mark the emails as spam, which would also stop delivery to everyone else.

**Independent Test**: As a confirmed subscriber, use the mail client's native unsubscribe action on one issue email, then publish another issue and confirm nothing is delivered to that address; repeat with the visible link on another subscriber.

**Acceptance Scenarios**:

1. **Given** an issue email in a mail client that supports one-click unsubscribe, **When** the subscriber uses the client's unsubscribe button, **Then** they are unsubscribed with no further step.
2. **Given** the subscriber follows the visible unsubscribe link, **When** the page opens, **Then** a single button press unsubscribes them and a confirmation is shown in their language.
3. **Given** an automated link scanner opens the visible unsubscribe link without a person pressing the button, **When** the page loads, **Then** the subscriber stays subscribed.
4. **Given** a subscriber has just unsubscribed, **When** the next issue is published, **Then** they receive nothing.
5. **Given** any unsubscribe link, **When** its address is inspected, **Then** it does not contain the subscriber's email address.
6. **Given** an unsubscribe link in an issue email and the address is still stored, **When** the subscriber opens it any time later, **Then** the link still works.
7. **Given** the address is already unsubscribed or has been erased, **When** someone opens that issue email's unsubscribe link, **Then** the page says they are not subscribed and does not show an error.

---

### User Story 4 - Chat post kit (Priority: P2)

For each published issue, the owner sees in the admin a ready-to-paste post for each patient chat (VK, WhatsApp, Facebook, Telegram) in Russian and English. Each post has the summary points, the items (every item for VK, the top 3 for the other chats), the disclaimer line, an issue link that carries the right source (for example `?src=vk`) and a subscribe link. A copy button puts it on the clipboard. The owner also gets the kit by email when the issue is published, so they can post from their phone.

**Why this priority**: WhatsApp and Facebook offer no way to post to groups automatically, so the chats depend on the owner posting by hand every week. Making that take a few minutes is what makes a weekly habit sustainable. It is P2 because the owner can already paste the issue link manually.

**Independent Test**: Publish an issue, open the post kit in the admin, copy the Telegram Russian post, paste it into a Telegram chat, and confirm it fits in one message, includes the disclaimer and an issue link ending in `src=tg`; confirm the same kit arrived in the owner's inbox.

**Acceptance Scenarios**:

1. **Given** a published issue, **When** the owner opens it in the admin, **Then** they see one post per chat and per language (8 in total), each with a copy button.
2. **Given** the owner copies the VK post, **When** they paste it, **Then** it contains the summary points, every item of the issue, the disclaimer line, an issue link with `src=vk`, and a subscribe link with `src=vk`.
3. **Given** an issue with 7 items, **When** the owner copies the Telegram, WhatsApp or Facebook post, **Then** it contains the first 3 items in issue order and a line saying 4 more items are in the full issue.
4. **Given** a post that would still exceed its chat's message length limit, **When** the post is generated, **Then** the lowest-ranked of its items are left out and counted in the "more items" line, while the summary, disclaimer and links are kept.
5. **Given** an issue is published, **When** publishing completes, **Then** the owner receives one email containing the whole post kit.

---

### User Story 5 - Auto-post to the VK community (Priority: P3)

When an issue is published and the VK community connection is configured, the Russian post is published on the community wall automatically, as the community, with the full text. If the Russian translation is still missing after about 6 hours, the wall gets the full English text with a note in Russian instead. Readers in Russia can read the issue on VK without opening the site.

**Why this priority**: VK is reachable in Russia even if the site is not, and the owner already runs the community; it is the main channel for readers who cannot open the site (FR-009). It is P3 because the post kit (User Story 4) already covers VK manually.

**Independent Test**: With the VK connection configured and the Russian text available, publish an issue and confirm one wall post appears in the community with the full Russian post text; retry the post from the admin and confirm no second post appears. With the Russian text missing, confirm that after about 6 hours one English post with a Russian note appears and a retry still does not create a second post.

**Acceptance Scenarios**:

1. **Given** the VK connection is configured and the Russian text is available, **When** an issue is published, **Then** the Russian post appears once on the community wall, posted as the community.
2. **Given** the VK post fails, **When** the failure happens, **Then** it is logged as an error, email delivery is unaffected, and the admin shows the failure with a retry action.
3. **Given** the VK connection is configured and the Russian translation is missing, **When** about 6 hours pass after publication, **Then** one wall post appears with the full English text and a note in Russian that the translation is unavailable, an error is logged, and that post is not replaced if the Russian text appears later.
4. **Given** a VK post for an issue already exists, **When** the post is retried, **Then** no second post is created for that issue in that community.
5. **Given** the VK connection is not configured, **When** an issue is published, **Then** no VK post is attempted and nothing is logged as an error.
6. **Given** the VK post is not on the wall yet, including while it waits for a Russian translation, **When** the owner hides the issue, **Then** no VK post is published.
7. **Given** the VK post is already on the wall, **When** the owner hides the issue, **Then** that wall post stays.

---

### User Story 6 - Minimal analytics (Priority: P3)

The owner sees, without cookies or personal data in the page analytics, how many people viewed each issue page and submitted the subscribe form, broken down by the chat they came from, and how many subscribers clicked a link in each issue email. This tells the owner which chat brings subscribers and whether subscribers come back.

**Why this priority**: Quarter criterion 2 requires subscribers "from patient chats", which must be provable from the first day. It is P3 because the source on each subscription (User Story 1) already proves the criterion; page views and clicks add the "do they come back" signal.

**Independent Test**: Visit an issue page with `?src=fb` and without a source, submit the form once, click a link in an issue email, then confirm the admin shows the page views and form submission under `fb` and `other`, and one clicking subscriber for that issue.

**Acceptance Scenarios**:

1. **Given** visitors open an issue page with different `src` values, **When** the owner opens the analytics view, **Then** page views are shown per issue and per source, with missing or unknown sources counted as `other`.
2. **Given** a visitor views pages and submits the form, **When** their browser is inspected, **Then** no analytics cookie has been set and no third-party tracker has loaded.
3. **Given** subscribers click links in issue emails, **When** the owner opens the analytics view, **Then** they see the number of clicking subscribers per issue and the number of confirmed subscribers who clicked in two or more different issues, with no way to see which subscriber clicked.

---

### Edge Cases

- **Russian translation not ready at send time**: English subscribers are sent immediately; Russian subscribers and the VK post wait for the translation, which is retried for about 6 hours. If it is still unavailable after that, Russian subscribers get the English text with a note in Russian that the translation is not available, the VK wall gets that same English text with a note in Russian, and the failure is logged as an error (FR-012, FR-034). The VK fallback is the one post for that issue and is not replaced if the Russian text appears later.
- **Issue text generation failed** (spec 005 FR-015): no issue emails are sent and no VK post is made, because an email with no summary and no plain-language sentences is not worth sending. The failure is logged. After the owner regenerates the text, they can start the send from the admin.
- **Owner hides an issue** (spec 005 FR-021): if hidden before sending, the issue is not emailed; if hidden while sending, the remaining deliveries are cancelled and marked skipped. Emails already delivered cannot be recalled. If the issue is hidden before the VK post is published, including during the translation wait, no VK post is made. A VK post already on the wall is left as it is (FR-019).
- **Owner edits an issue after it was sent**: nothing is re-sent; the edit only affects the site and later post kits.
- **Subscriber confirms while a new issue is being sent**: they receive that issue once, either as their welcome issue or as part of the regular send, never both (FR-010a, FR-014).
- **Email provider briefly unavailable**: affected deliveries stay pending and are retried automatically up to 3 times over about 6 hours; only deliveries that still fail are marked failed and alerted (FR-018).
- **Daily sending limit reached**: deliveries beyond the email provider's daily limit are marked pending and are sent automatically after the limit resets, without duplicates.
- **Same address submitted repeatedly**: at most one confirmation email per address per hour; each new confirmation email invalidates the previous link; the on-screen response is always the same.
- **Same inbox, different spelling**: `User@Example.com` and `user@example.com` are one subscription. `user+hht@gmail.com` and `user@gmail.com` are two (FR-007).
- **Pending address never confirmed**: it receives nothing else and is deleted once the 7-day link expires.
- **Confirmed subscriber wants to change language**: they unsubscribe and subscribe again with the other language. The new submission is accepted immediately, even inside the 30-day erasure window, and follows FR-024.
- **Honeypot field filled or rate limit hit**: the submission is silently discarded for the per-address limit and the honeypot (same response as success); the per-IP limit may show a "try again later" message because it reveals nothing about any address.
- **Subscriber on a de/tr/uk page**: the form and pages are in that locale, and the email language is preset to English (the only email languages are Russian and English).
- **Visible unsubscribe link opened by a mail security scanner**: the subscription stays active until a person presses the button.
- **Unsubscribe link opened again, or after the address is erased**: the link has no expiry while the address is stored. If they are already unsubscribed, or the address has been erased, the page says they are not subscribed and does not show an error (FR-023).
- **Bounce or spam complaint for an address that later subscribes again**: the new subscription goes through double opt-in like any other and replaces the unsubscribed record immediately (FR-024), including inside the 30-day erasure window.
- **Link-click counting fails or its host is unreachable**: counting must never make an email link less reachable than a direct link to the site would be.
- **Issue with many items**: the email and the VK post include every item; WhatsApp, Facebook and Telegram posts show the top 3; any post that still exceeds its length limit drops its lowest-ranked items.
- **Site unreachable from the reader's network**: the reader can still read every issue email in full and the VK post; subscribing needs a VPN; unsubscribing works by replying to any email, and the owner unsubscribes the address from the admin (FR-009). The mail client's one-click button may fail in this case, which is why the reply path exists.

## Requirements _(mandatory)_

### Functional Requirements

**Subscribing**

- **FR-001**: Every issue page and project page MUST show a subscribe form for that project with an email field, a language choice (Russian or English, preset to Russian on Russian-locale pages and to English otherwise), and an unticked consent checkbox linking to the privacy note. The form MUST work at a 360px viewport width and without JavaScript.
- **FR-002**: A submission without consent MUST be rejected with a clear message; nothing is stored and no email is sent.
- **FR-003**: A valid submission MUST send a confirmation email in the chosen language. The subscription becomes confirmed only when its confirmation link is followed. Confirmation links MUST be single-use and expire after 7 days.
- **FR-004**: An unconfirmed address MUST NOT receive any email other than its confirmation email, and MUST be deleted within 24 hours after its confirmation link expires.
- **FR-005**: The on-screen response to a submission MUST be identical whether the address is new, pending, already confirmed, or discarded by the per-address limit or the honeypot, so the form never reveals whether an address is subscribed.
- **FR-006**: Each subscription MUST record the chat source (`vk`, `wa`, `fb`, `tg`; anything missing or unrecognized is recorded as `other`) taken from the link the visitor arrived by. The source MUST still apply when the visitor subscribes on another page of the site reached through the site's own links during the same visit.
- **FR-007**: A subscription MUST store only the project, email address, language, source, consent timestamp and subscription state. The only other data linked to a subscriber is, per issue, its delivery status and whether they clicked any link in that issue's email (FR-039). No other personal data is collected, and there are no accounts or preferences beyond language. For one project, the address MUST match without regard to letter case, so `User@Example.com` and `user@example.com` are the same subscription. A plus-tag is part of the address, so `user+hht@gmail.com` and `user@gmail.com` are different subscriptions.
- **FR-008**: The subscribe endpoint MUST be rate-limited per IP address and per email address, MUST include a hidden field that people do not fill (submissions that fill it are discarded), and MUST send at most one confirmation email per address per hour.
- **FR-009**: Subscribing requires reaching the site; readers whose network blocks it are expected to use a VPN or to read the issue in the VK community (User Story 5). So that nobody is ever unable to unsubscribe, every email MUST have a reply-to address that reaches the owner, every issue email and the privacy note MUST say that replying with a request to unsubscribe works, and the owner MUST be able to unsubscribe an address from the admin, taking effect before the next delivery.

**Issue delivery**

- **FR-010**: When an issue is published and not hidden, every confirmed subscriber of that project MUST receive it by email in their language, automatically and with no approval step.
- **FR-010a**: When a subscription is confirmed, the subscriber MUST be sent the project's latest published, visible issue right away, in their language, if that issue was published at most 14 days earlier; otherwise their first email is the next issue. This delivery follows the same rules as any other (FR-011 to FR-019), so a subscriber never receives the same issue twice.
- **FR-011**: The issue email MUST contain the project name, the issue date, every summary point, and every item in the issue page's order with its title, source, date and plain-language sentence (trial registrations marked as such), plus the medical disclaimer, the AI-generated label, the unsubscribe link and a link to the privacy note. It MUST be complete and understandable when every link in it is unreachable; links to the site are an addition, not a dependency.
- **FR-012**: A Russian issue email MUST use the Russian text of the issue. If that translation does not exist yet, sending MUST trigger it, and English subscribers MUST NOT wait for it. A failed translation MUST be retried automatically for about 6 hours after publication. If the Russian translation is still unavailable after that, Russian subscribers MUST receive the English text with a note in Russian saying the translation is unavailable, and the failure MUST be logged as an error.
- **FR-013**: If an issue's generated text failed (spec 005 FR-015), no issue emails and no VK post MUST be sent for it; the failure MUST be logged as an error, and the owner MUST be able to start the send from the admin after regenerating the text.
- **FR-014**: Each subscriber MUST receive each issue at most once, even when the send is retried or runs concurrently. Delivery status MUST be tracked per issue and subscriber.
- **FR-015**: Every email MUST include both an HTML part and a plain-text part, be readable on a phone, and render correctly in Gmail, Mail.ru, Yandex Mail and Apple Mail.
- **FR-016**: All emails MUST be sent from the project's verified sending domain with sender authentication (SPF, DKIM and DMARC) in place, never from the email provider's shared test sender. Sending to anyone other than the owner MUST NOT be enabled until this is true. The sender name and address come from project data or configuration.
- **FR-017**: Deliveries that would exceed the email provider's daily sending limit MUST be kept pending and sent automatically once the limit resets, without duplicates.
- **FR-018**: A failed delivery MUST be retried automatically up to 3 times, spread over about 6 hours, while it stays in pending status. If it still fails after the last automatic retry, it MUST be marked failed and logged as an error through the existing alerting. A delivery rejected as permanently undeliverable (FR-020) is not retried. The issue stays published, and the owner MUST be able to retry failed deliveries from the admin without causing duplicates.
- **FR-019**: A hidden issue MUST NOT be sent by email. If an issue is hidden while its send is in progress, the remaining deliveries MUST be cancelled and recorded as skipped. Emails already delivered cannot be recalled. If an issue is hidden before its VK post is published, including while that post waits for a Russian translation, the VK post MUST NOT be published. A VK post already on the wall MUST be left as it is. Editing an issue after sending MUST NOT trigger a re-send.
- **FR-020**: A permanent bounce or a spam complaint reported for an address MUST unsubscribe that address automatically.

**Unsubscribing**

- **FR-021**: Every issue email MUST carry a visible unsubscribe link and the standard one-click unsubscribe headers (RFC 8058), so mail clients can offer their own unsubscribe button.
- **FR-022**: Unsubscribing through the mail client's one-click action MUST take effect immediately with no further step. The visible link MUST open a page where a single button press unsubscribes; merely opening that page MUST NOT unsubscribe, so automated link scanners cannot unsubscribe people.
- **FR-023**: Unsubscribing MUST NOT require a login, MUST take effect before the next delivery, and MUST show a confirmation in the subscriber's language. Unsubscribe links, both the visible link and the one-click action, MUST use tokens that do not contain or reveal the email address and MUST keep working with no expiry while the address is stored. If the address is already unsubscribed, the page MUST say they are not subscribed, in their language, and MUST NOT show an error. If the address has been erased, the page MUST say they are not subscribed and MUST NOT show an error. The one-click action MUST succeed in those same cases and MUST NOT cause any further email.
- **FR-024**: After unsubscribing, the email address MUST be erased within 30 days; only anonymous aggregate counts are kept. If the same address (FR-007) is submitted again before that erasure, the unsubscribed record MUST be replaced immediately by a new pending subscription with the new language, source, and consent timestamp; confirmation is required again (FR-003); and that subscriber's per-issue click history MUST be deleted at replacement. Anonymous aggregate counts already recorded are kept.

**Privacy and owner control**

- **FR-025**: A privacy page in Russian and English MUST state who the data controller is, the legal basis (consent), what is stored and why, where it is stored (EU), how long it is kept, that the system records whether each subscriber clicked a link in each issue email, how to unsubscribe (including by replying to any email), and how to request deletion. The subscribe form, the confirmation email and every issue email MUST link to it.
- **FR-026**: The legal basis for storing subscribers is explicit consent under GDPR Art. 9(2)(a), with the owner as an EU-based data controller: the consent checkbox MUST be unticked by default, name the project, and link to the privacy note; the consent timestamp is recorded (FR-007); and all subscriber data MUST be stored in the EU.
- **FR-027**: The owner MUST be able to unsubscribe a subscriber, and to delete a subscriber completely, from the admin; deletion removes every record that identifies them.
- **FR-028**: The admin MUST show the owner: confirmed and pending subscriber counts by source and language; per-issue delivery counts by status (sent, pending, failed, skipped) with a retry action for failures. The admin MUST NOT let the owner write or send arbitrary emails to subscribers.

**Chat post kit**

- **FR-029**: For each published issue, the admin MUST show a ready-to-paste plain-text post for each chat (VK, WhatsApp, Facebook, Telegram) in Russian and English, each with a copy-to-clipboard button.
- **FR-030**: Each post MUST contain the issue date, the summary points, the disclaimer line, an issue link carrying that chat's source (for example `?src=vk`), and a subscribe link carrying the same source. VK posts MUST include every item of the issue. WhatsApp, Facebook and Telegram posts MUST include the first 3 items in issue order, followed by a line stating how many more items are in the full issue (omitted when the issue has 3 items or fewer).
- **FR-031**: Posts MUST be built only from the issue text already produced by spec 005; no new AI generation is involved.
- **FR-032**: Each post MUST fit its platform's single-message length limit (Telegram: 4096 characters; VK wall post, WhatsApp message and Facebook post: their respective limits). When a post would still not fit, the lowest-ranked of its items MUST be dropped and counted in the "more items in the full issue" line; the summary, disclaimer and links MUST never be dropped.
- **FR-033**: When an issue is published, the owner MUST receive one email containing the full post kit.

**VK auto-post**

- **FR-034**: When the VK community connection is configured, publishing an issue MUST publish the full Russian post (FR-030, FR-032) to the community wall, posted as the community. If the Russian translation does not exist yet, the VK post MUST wait and retry that translation for about 6 hours after publication, and MUST NOT block or delay email delivery. If the Russian text is still unavailable after that, the wall MUST receive the full English post with a note in Russian saying the translation is unavailable, and the failure MUST be logged as an error. That fallback post is the one VK post for the issue (FR-035) and MUST NOT be replaced if the Russian text appears later. A hidden issue MUST NOT be posted (FR-019). When the connection is not configured, no VK post is attempted.
- **FR-035**: There MUST be at most one VK post per issue per community, even when the post is retried.
- **FR-036**: A failed VK post MUST be logged as an error, MUST NOT block or delay email delivery, and MUST be retryable from the admin, which shows each issue's VK post status.
- **FR-037**: The VK access credential MUST be stored as a secret, and MUST never be logged or shown in the admin.

**Analytics**

- **FR-038**: The system MUST count issue-page views, subscribe-form submissions and confirmations per project, per issue where applicable, and per source, without cookies, without storing personal data, and without third-party trackers.
- **FR-039**: The system MUST record, per issue and subscriber, a single flag for whether the subscriber clicked any link in that issue's email (not which link, not when, not how often), and MUST show the owner only aggregates: clicking subscribers per issue, and the number of confirmed subscribers who clicked in two or more different issues. The flags MUST be erased together with the subscriber (FR-024, FR-027). Counting MUST NOT make an email link less reachable than a direct link to the site.
- **FR-040**: The owner MUST be able to see the metrics from FR-038 and FR-039 in the admin without external tools.

**Cross-cutting**

- **FR-041**: The subscribe form, confirmation page, unsubscribe page and all related messages MUST be available in all five UI locales. Email content and chat posts are produced in Russian and English only.
- **FR-042**: Every subscriber, delivery, VK post and analytics record MUST belong to a project. Sender name, VK community, post wording and disease-specific text MUST come from project data or configuration, not from code.

### Key Entities

- **Subscriber**: One email address subscribed to one project. Uniqueness is one subscription per project and address, matching the address without regard to letter case; plus-tags are distinct (FR-007). Holds the language (ru or en), chat source, consent timestamp and state (pending, confirmed, or unsubscribed). A pending subscriber has one active confirmation link with an expiry. An unsubscribed subscriber receives nothing and is erased within 30 days (FR-024), or sooner if the owner deletes them (FR-027). A new submission of that address before erasure replaces the unsubscribed record with a new pending subscription and deletes its per-issue click history immediately.
- **Issue Delivery**: The record that a given issue was (or was not) delivered to a given subscriber, with status sent, pending, failed or skipped, and a "clicked" flag set when the subscriber follows any link in that email. Unique per issue and subscriber, which is what prevents duplicates. Erased with the subscriber, including immediately when an unsubscribed record is replaced by a new subscription (FR-024).
- **Chat Post**: The ready-to-paste text for one issue, one chat and one language, derived from the issue's existing text and link with source. Can be regenerated at any time; it is not edited by hand.
- **VK Post Record**: The record that an issue was posted to a given VK community, with its status and a reference to the published post. At most one per issue and community.
- **Analytics Count**: An anonymous counter by project, issue (optional), source and metric (page view, form submission, confirmation). Contains no personal data. Email clicks are derived from the Issue Delivery "clicked" flags instead.
- **Issue** (from spec 005): The published digest being delivered. Its visibility flag and generated text decide whether and in which language it is sent.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A person who is not the owner can go from a chat link to a confirmed subscription in under 2 minutes on a phone, and at least one such person does so within two weeks of the first chat post.
- **SC-002**: Every confirmed subscriber's source is known, so on 2026-12-31 the count of confirmed subscribers from patient chats (quarter criterion 2) can be read directly from the admin.
- **SC-003**: 95% of confirmed subscribers receive a published issue within 1 hour of publication, and 100% within 24 hours (daily-limit deferrals under FR-017 excepted).
- **SC-004**: Across the first four issues, including at least one deliberate retry of a send, no subscriber receives the same issue twice.
- **SC-005**: A test subscriber in each of Gmail, Mail.ru, Yandex Mail and Apple Mail can read the complete issue on a phone with all links blocked, and the email is not placed in spam.
- **SC-006**: After unsubscribing with one action from an issue email, a subscriber receives no further issue emails.
- **SC-007**: The owner can post one issue to all four chats in under 10 minutes in total, using the post kit.
- **SC-008**: When the VK connection is configured and the Russian text is available, each issue appears on the community wall within 1 hour of publication, exactly once. If the Russian text is still missing, the English fallback post from FR-034 appears once by the end of the about-6-hour retry window.
- **SC-009**: The owner can see, per issue and per chat source, page views, form submissions and confirmations; per issue, how many subscribers clicked a link in the email; and how many subscribers clicked in two or more issues, without any tool outside the admin.

## Assumptions

- Decisions carried over from the draft are fixed: subscription data is limited to email, language, source and consent timestamp; email languages are Russian and English; sending on publish is fully automatic; email content is self-contained; WhatsApp, Facebook and Telegram stay manual via the post kit; hosting and data stay in the EU (Frankfurt); the email provider is Resend on its free tier.
- The Resend free tier (100 emails per day) covers about 50 subscribers plus confirmation emails, welcome issues and the owner's post-kit email; FR-017 handles the rare day that exceeds it.
- Whether the site opens from Russian residential and mobile networks without a VPN is still to be checked (roadmap F17). This spec does not depend on the result: if the site is blocked, readers there use a VPN to subscribe, read issues in full by email or on VK, and can always unsubscribe by reply (FR-009). A separately reachable host or owner-assisted subscribing can be added later if the check fails and subscriber numbers show a need.
- The sending domain is bought and verified as a separate chore (roadmap Stage 1) before this feature goes live to real subscribers; until then only the owner can receive emails (FR-016).
- A new subscriber gets at most one past issue (the latest, if at most 14 days old, per FR-010a); older issues are not sent retroactively. The confirmation success page also links to the latest issue.
- Default rate limits: at most 5 subscribe submissions per IP address per hour, and at most one confirmation email per address per hour (FR-008). The exact per-IP number can be tuned in planning.
- The visible unsubscribe link needs one button press on the page it opens, because mail security scanners open links automatically; the mail client's own unsubscribe button is truly one action (FR-022). Unsubscribe links do not expire while the address is stored (FR-023).
- The VK post contains the full post text, not a teaser, and is posted as the community, because readers in Russia may not be able to open the site. It uses the Russian text when that translation is available. If the Russian text is still missing after about 6 hours, it uses the English text with a note in Russian (FR-034).
- The "top 3" items in WhatsApp, Facebook and Telegram posts are the first 3 in the issue page's order (importance, then newest) until spec 007 introduces a proper top-3.
- The privacy note content is authoritative in Russian and English; de/tr/uk visitors see the English version with the page chrome in their locale. The plan's Constitution Check confirms this against Principle VI.
- The email language is preset to English on de/tr/uk pages because emails exist only in Russian and English.
- The "subscribers who clicked in two or more issues" metric (roadmap open question 12) is shown only as an aggregate count, never per subscriber, even though the underlying flag is stored per subscriber (FR-039).
- Telegram, WhatsApp and Facebook automation, SMS, per-topic preferences, pre-translation into de/tr/uk, a web archive outside the current hosting, and chat scraping are out of scope.
- The feature depends on spec 005: published issues with generated text, the issue page, on-demand translation, the owner's hide and regenerate actions, and the existing error alerting.
