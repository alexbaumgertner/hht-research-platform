Email Subscriptions and Chat Delivery — each published issue reaches patients as a full-text email and as a ready-to-post message for the patient chats, so readers who cannot open the site still get the news.

## Why

Spec 005 made each weekly issue a page worth sharing. Two problems remain:

- Nobody can subscribe. Quarter criterion 2 (50 confirmed subscribers from patient chats) is impossible today.
- The site is likely unreachable from Russian residential and mobile networks (roadmap N7 / F17). The primary audience is there.

So the issue itself, not only a link to it, has to travel to where readers already are: their inbox and the patient chats. The chats the owner runs today are:

- VK community: https://vk.ru/curehhtru
- WhatsApp group (invite link kept by the owner, not published in the repo)
- Facebook group: https://www.facebook.com/groups/curehhtru
- Telegram

## Who

- **Patient (primary).** Subscribes once, then gets each issue by email in Russian (or English) and can read it fully without opening the site. Unsubscribes in one click.
- **Chat admin (the project owner).** Posts each issue into VK, WhatsApp, Facebook and Telegram. Wants this to take a few minutes: copy, paste, done.

## User stories

1. **P1 — Subscribe with double opt-in.**
   - On the issue page and the project page, a patient enters an email, picks a language (ru/en, preset from the page locale) and ticks an explicit consent checkbox that links to the privacy note.
   - They receive a confirmation email. Only after they click its link are they subscribed.
   - The chat source (`src` = vk / wa / fb / tg / other, taken from the link they arrived by) is stored with the subscription.
2. **P1 — Receive the issue by email.**
   - When an issue is published, every confirmed subscriber of that project receives it in their language.
   - The email carries the full issue: date, summary points, and every item with its title, source, date and plain-language sentence.
   - It also carries the medical disclaimer and the AI label, so it is complete even if every link in it is unreachable.
   - Links to the site are a bonus, not a requirement.
3. **P1 — Unsubscribe in one click.**
   - Every issue email has a visible unsubscribe link and `List-Unsubscribe` / `List-Unsubscribe-Post` headers (RFC 8058).
   - Unsubscribing takes effect immediately and needs no login.
4. **P2 — Chat post kit.**
   - For each published issue the admin sees a ready-to-paste post per chat and per language:
     - plain text sized for each chat;
     - the summary points and top items;
     - the disclaimer line;
     - an issue link carrying the right `src` (e.g. `?src=vk`);
     - a subscribe link.
   - A copy button puts it on the clipboard. This covers WhatsApp and Facebook, which offer no posting API for groups.
   - The owner also gets this kit by email when the issue is published, so they can post from a phone.
5. **P3 — Auto-post to the VK community.**
   - When an issue is published, the Russian post is published to the VK community wall through the VK API, using a community access token.
   - The full text lives in VK, so readers in Russia can read it there without the site.
   - A failed VK post is logged as an error, does not block email delivery, and can be retried from the admin.
   - The feature is off unless the token is configured.
6. **P3 — Minimal analytics.**
   - Cookie-less counts of issue-page views and subscribe-form submissions by `src`.
   - Email link clicks per issue (tracked redirect or Resend click tracking), so the owner can see which chat brings subscribers and whether they come back.

## Decisions already made (please don't re-ask)

- **Subscription = email + locale + `src` + consent timestamp, and nothing else.** No accounts, no preferences beyond language (Constitution IV).
- **Email languages: ru and en.** Other locales can come later. An issue email in ru is sent only after the ru translation exists; the send may trigger that translation.
- **Sending on publish is fully automatic.** No approval hold, which is consistent with quarter criterion 1.
- **Email content is self-contained,** because the site may be blocked in Russia (F17).
- **WhatsApp and Facebook stay manual via the post kit.** WhatsApp has no public API for posting to groups. Facebook removed group publishing from the Graph API in 2024. Unofficial automation risks a ban of the owner's accounts.
- **Telegram stays manual in this spec.** It gets the same post kit.
- **Hosting and data stay in the EU (Frankfurt).** Resend is the email provider (free tier: 100 emails/day, enough for about 50 subscribers).
- **Domain-agnostic.** Wording and the VK community id come from project data or env, not code.

## Requirements

- **Verified sending domain.** Issue and confirmation emails come from a verified domain with SPF, DKIM and DMARC, not the Resend sandbox sender. This spec cannot ship to real subscribers without it.
- **Double opt-in.**
  - Confirmation links are single-use and expire (e.g. after 7 days).
  - Unconfirmed addresses receive nothing else and are deleted after expiry.
  - Re-subscribing an existing confirmed address does not reveal that it exists (same response either way).
- **Abuse protection.**
  - The subscribe endpoint is rate-limited per IP and per address, and has a honeypot field.
  - At most one confirmation email is sent per address per hour.
- **Delivery.**
  - Each subscriber receives each issue at most once, even if the send job is retried or runs concurrently. Track per (issue, subscriber).
  - Bounces and complaints reported by Resend unsubscribe the address automatically.
- **Unsubscribe.** Links are signed or random tokens that do not expose the email address in the URL.
- **Privacy note.** A privacy page in ru and en states:
  - what is stored and why;
  - where it is stored (EU);
  - how long it is kept;
  - how to unsubscribe and to request deletion.
    The owner can delete a subscriber completely from the admin.
- **Subscribers belong to a project.** Every subscriber record carries `project`, per roadmap §4.
- **Owner view in the admin.**
  - Confirmed and pending subscriber counts by `src` and locale.
  - Per-issue send status: sent, failed, skipped.
  - Not a mailing tool: the owner cannot write arbitrary emails to subscribers.
- **Failure handling.** If sending fails, the failure is logged as an error (existing alerting). The issue stays published, and the send can be retried without duplicates.
- **Email rendering.** Emails are readable on a phone and in plain-text mail clients; both HTML and text parts are sent. They render correctly in Gmail, Mail.ru, Yandex Mail and Apple Mail.
- **Chat posts.**
  - Posts are generated from the issue text already produced in spec 005. No new AI generation.
  - Posts respect each platform's length limits: VK wall post, WhatsApp message, Facebook post, Telegram message (4096 characters).
- **VK auto-post (P3).**
  - At most one post per issue per community, even on retry.
  - The token is stored as a secret in env and never logged.

## Out of scope

- Telegram bot or channel automation.
- WhatsApp or Facebook automation.
- SMS.
- Per-topic subscription preferences.
- Pre-translating into de/tr/uk.
- A web archive hosted outside Vercel.
- Scraping of the chats.

## Open questions for /speckit-clarify

1. **Subscribing from Russia (the main risk).**
   - The subscribe form, the confirmation link and the unsubscribe link all live on the site, which may be blocked for the very readers we want.
   - First check whether the site on its own domain opens from Russian residential and mobile networks without a VPN.
   - If it does not, choose a fallback:
     - (a) the owner adds an address from the admin on the reader's request, and the reader confirms by replying to the confirmation email (Resend inbound);
     - (b) host the subscribe, confirm and unsubscribe endpoints on a separate small host that is reachable from Russia;
     - (c) accept that subscribing needs a VPN, and rely on VK auto-post for readers in Russia.
2. **Domain and sender name.** Which domain (roadmap Q3)? Which sender name, e.g. "Cure HHT News"?
3. **Jurisdiction and consent text.** Is an explicit consent checkbox plus a privacy page enough (roadmap Q4)? This matters because of 152-FZ and GDPR Art. 9.
4. **VK post format.**
   - Full text in the post body, or a short teaser plus the link?
   - Post as the community or as the owner?
