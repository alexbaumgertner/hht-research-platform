Weekly Digest Issue — a public, shareable page for each published digest that tells a patient, in plain language, what is new this week and why it matters.

## Why

Today a published digest is invisible to readers: since spec 002 the project page is one flat list of materials and the digest is only a publishing gate. There is nothing a chat admin can share as "this week's news", nothing to email later (spec 006), and every summary is written for specialists (Objective / Methods / Results). The first audience is Russian-speaking HHT patients who arrive from patient chats (VK, WhatsApp, Facebook, Telegram) on a phone, often with no medical background. The quarter's hypothesis is "someone will use this and come back"; the issue page is the unit they will read, share and return to.

## Who

- **Patient (primary)** — taps a link in a chat on a phone and should understand within a minute what changed this week and whether any of it concerns them.
- **Chat admin (the project owner)** — posts one link per week; the link preview in the chat must look trustworthy and readable.
- **Physician (secondary)** — reaches the existing detailed material page from the issue.

## User stories

1. **P1 — Read this week's issue.** A patient opens the link to the latest issue and sees the issue date, a short "what's new and why it matters" summary (3–5 plain-language points), then the list of materials in the issue, each with its title, source badge, date and one plain-language sentence explaining what it is about. Tapping a material opens the existing detail page.
2. **P1 — Share a link that previews well.** When the issue link is pasted into Telegram, VK, WhatsApp or Facebook, the preview shows a meaningful title (project name + issue date), a one-line description from the summary, and an image, in the reader's language.
3. **P1 — Trust signals.** Every issue page and material detail page shows a short medical disclaimer ("This is an automated overview, not medical advice; discuss any change in treatment with your doctor") and a visible label that summaries are AI-generated from the linked sources.
4. **P2 — Browse past issues.** The project page shows the latest issue prominently and links to an archive of all issues, newest first; the flat materials feed stays available.
5. **P2 — Read in my language.** The issue page works in all five UI locales. Issue-level text is written once in English and translated into the reader's locale on first request, then reused; until a translation exists (or if it fails) the English text is shown with a note.
6. **P3 — Plain site chrome.** The site header, page titles and descriptions are localized and written for patients, not developers (no "Research Monitoring" / "configured research projects" wording).

## Decisions already made (please don't re-ask)

- An issue page per published digest **is** reader-visible. This amends the 002 clarification "digests stop being a visual grouping"; the flat feed remains.
- Cadence: **weekly, Monday 04:00 UTC (07:00 Moscow)**, anchored to the weekday (not drifting). An issue covers everything published since the previous issue. A week with no new relevant items publishes no issue (existing FR-010); the health endpoint still shows the run succeeded.
- Language policy: English is canonical; other locales are **translated on first request** and cached (Constitution VI, 001 FR-017). Email delivery (spec 006) may pre-translate for subscribed locales; that is out of scope here.
- Hosting/data stay in the EU (Frankfurt).
- Domain-agnostic: no disease names in code; disease/audience wording comes from project data.

## Requirements

- Each published digest has a stable, shareable, locale-prefixed URL and appears in an archive list for its project.
- Each issue has a generated summary (3–5 points, plain language, roughly a school-level reading level, max ~120 words) answering "what changed and why it matters", derived only from the items in that issue.
- Each item in an issue has one generated plain-language sentence (max ~30 words).
- Generated patient-facing text must: not recommend doses, drugs or treatment changes; not state findings beyond what the source says; use cautious wording for early or small studies; never invent results for trial registrations (a registered trial is described as "a study that is planned / recruiting", not as having outcomes); be traceable to the listed items.
- Items are ordered with the most important first (using the existing importance value until a later spec improves ranking), then newest first; trial registrations are visibly distinguished from publications.
- Page metadata: localized title, description and Open Graph / Twitter card data with an image for every issue page, the project page and material pages; a default image is acceptable, generated per issue is preferred.
- Issue text is generated when the digest is published; digests published before this feature get their issue text generated once so existing issues are not empty.
- If generation fails, the issue page still renders with the item list and titles, and the failure is logged as an error (existing alerting).
- Mobile-first: readable at 360px width; the issue content is usable without JavaScript.
- Works in all five locales (en, de, tr, ru, uk).

## Out of scope

Email subscriptions and sending (006); importance rubric / top-3 selection (007); dedicated clinical-trials section with phase/status/eligibility (008); full per-item patient layer beyond one sentence, register switch (009); organ/topic tags (010); landing page, methodology page, custom domain setup (011); comments, accounts, personalization.

## Success criteria

- A link to an issue pasted into Telegram, VK and WhatsApp shows title, description and image in the chosen language.
- Three patients from the chats, shown an issue on their phone, can each say in their own words what is new that week within one minute.
- The first two scheduled Monday issues publish with no manual action.
- Manual review of the first three issues finds zero medical-advice statements and zero claims not supported by the linked items.
- Every issue and material page shows the disclaimer and AI label in the reader's locale.
