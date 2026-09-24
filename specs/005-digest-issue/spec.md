# Feature Specification: Weekly Digest Issue

**Feature Branch**: `005-digest-issue`

**Created**: 2026-09-24

**Status**: Draft

**Input**: User description: "Weekly Digest Issue — a public, shareable page for each published digest that tells a patient, in plain language, what is new this week and why it matters."

## Clarifications

### Session 2026-09-24

- Q: What is the publishing cadence for issues, and how does it interact with the current schedule? → A: Weekly, every Monday 04:00 UTC, anchored to the weekday so it never drifts; the project moves from its current daily cadence to this weekly cadence; each issue covers everything published since the previous issue (FR-020).
- Q: How should on-demand translation behave for the first request to an untranslated locale, including concurrent requests and link-preview crawlers? → A: The first request waits for translation up to ~8 seconds during page render; if the translation is not ready by then, English is served with the "not yet translated" note and translation finishes in the background. Link-preview crawlers get the same behavior. Each issue+locale pair is translated at most once even if multiple requests arrive concurrently (FR-012, FR-013).
- Q: Can the owner edit or regenerate an issue's generated text, and what happens to existing translations when they do? → A: Yes — in the admin, the owner can edit or regenerate an issue's English summary and per-item sentences, and can hide an issue from public view; editing or regenerating the English text invalidates that issue's cached translations (FR-021).
- Q: How is the traceability requirement (an issue summary must be traceable to its items) made objectively testable? → A: Each generated summary point links to the specific issue item(s) it is based on, so traceability can be checked by following those links (FR-007).
- Q: Does this feature conflict with the 002 clarification that digests stopped being a visual grouping? → A: This spec explicitly amends that 002 clarification — a published digest is reader-visible again as its own issue page — while the flat, ungrouped materials feed introduced by 002 remains unchanged (FR-019).

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Read this week's issue (Priority: P1)

A patient taps a link shared in a chat (VK, WhatsApp, Facebook, Telegram) on their phone. They land on the latest published issue and, within a minute, understand the issue date, a short plain-language summary of what's new and why it matters, and the list of materials behind that summary — each with its title, source, date, and a one-sentence plain-language explanation. Tapping a material opens the existing detail page.

**Why this priority**: This is the feature's entire reason for existing. Today a published digest is invisible to readers — there is nothing to open, read, or understand. Until this journey works, there is no product to share.

**Independent Test**: Given a project with at least one published digest containing materials, open that digest's issue page and confirm the issue date, the plain-language summary, and the material list (each with title, source badge, date, and one-sentence explanation) are all visible without leaving the page.

**Acceptance Scenarios**:

1. **Given** a published digest exists for a project, **When** a reader opens its issue page, **Then** they see the issue date and a plain-language summary of 3–5 points (not specialist Objective/Methods/Results wording) explaining what is new and why it matters.
2. **Given** the reader is on an issue page, **When** they scroll past the summary, **Then** they see every material included in that issue, each showing its title, source badge, date, and one plain-language sentence (not the specialist summary) describing what it is about.
3. **Given** the reader is looking at a material listed in the issue, **When** they tap or activate its title, **Then** they are taken to that material's existing detail page.
4. **Given** an issue contains both publications and trial registrations, **When** the reader views the material list, **Then** trial registrations are visibly distinguished from publications and the registration item does not claim any results or outcomes.
5. **Given** the reader opens the issue page on a phone with a 360px-wide screen, **When** the page renders, **Then** all content (summary, material list) is readable without horizontal scrolling, and the page is usable even if JavaScript does not run.

---

### User Story 2 - Share a link that previews well (Priority: P1)

The chat admin posts one issue link per week into a patient chat group. When the link is pasted into Telegram, VK, WhatsApp or Facebook, the chat app shows a rich preview: a meaningful title (project name and issue date), a one-line description drawn from the issue summary, and an image — all in the reader's language.

**Why this priority**: A link with no preview, or a generic/broken preview, gets ignored or looks untrustworthy in a patient chat. The preview is what earns the tap that leads to User Story 1.

**Independent Test**: Paste a published issue's URL into a link-preview-checking tool (or a chat client) and confirm the rendered preview shows a project-and-date title, a one-line description from the issue summary, and an image.

**Acceptance Scenarios**:

1. **Given** a published issue page, **When** its URL is shared in a chat app that generates link previews, **Then** the preview shows a title combining the project name and the issue date.
2. **Given** a published issue page, **When** a link preview is generated, **Then** the preview description is a one-line excerpt derived from that issue's plain-language summary.
3. **Given** a published issue page, **When** a link preview is generated, **Then** the preview includes an image (an issue-specific image when available, otherwise a default project image).
4. **Given** the issue page is opened in a specific locale, **When** its metadata is read by a link-preview crawler, **Then** the title and description are in that locale's language (English if no translation exists yet).

---

### User Story 3 - Trust signals (Priority: P1)

A patient reading an issue or material page sees a short medical disclaimer stating this is an automated overview, not medical advice, and that any treatment change should be discussed with their doctor. They also see a visible label that the summaries are AI-generated from the linked sources.

**Why this priority**: Patient-facing generated medical content without a disclaimer and provenance label is a trust and safety risk from day one — it must ship with the first reader-visible page, not be added later.

**Independent Test**: Open any published issue page and any material detail page and confirm both display the disclaimer text and the AI-generated label, in the active locale.

**Acceptance Scenarios**:

1. **Given** a reader opens a published issue page, **When** the page renders, **Then** a medical disclaimer ("this is an automated overview, not medical advice; discuss any treatment change with your doctor") is visible.
2. **Given** a reader opens a published issue page, **When** the page renders, **Then** a visible label states that the summaries are AI-generated from the linked sources.
3. **Given** a reader opens an existing material detail page, **When** the page renders, **Then** the same disclaimer and AI-generated label are visible there too.
4. **Given** the reader's active locale is German, Turkish, Russian, or Ukrainian, **When** the disclaimer and label render, **Then** they appear in that locale's language.

---

### User Story 4 - Browse past issues (Priority: P2)

A reader on the project page sees the latest issue presented prominently, with a link to an archive of every past issue for that project, newest first. The existing flat materials feed remains available alongside the issue view.

**Why this priority**: Once issues exist, readers and the chat admin need a way to find last week's (or an older) issue without having saved the original link. This depends on User Story 1 existing but is not required for the first issue to be shareable.

**Independent Test**: Given a project with two or more published issues, open the project page, confirm the latest issue is prominently featured, follow the archive link, and confirm every published issue is listed newest first and each links to its issue page.

**Acceptance Scenarios**:

1. **Given** a project has at least one published issue, **When** a reader opens the project page, **Then** the latest issue is presented prominently (date and summary excerpt visible without navigating further).
2. **Given** a project has multiple published issues, **When** a reader opens the issue archive, **Then** all published issues are listed newest first, each linking to its own issue page.
3. **Given** a reader is on the project page, **When** they look for the flat materials feed, **Then** it is still present and reachable, unchanged in its ungrouped form.

---

### User Story 5 - Read in my language (Priority: P2)

A reader who has selected German, Turkish, Russian, or Ukrainian sees the issue-level text (summary and per-item sentences) in that language. The first reader to request a locale that has no cached translation yet triggers translation of the English source text, which is then cached and reused for later readers. If translation is missing or fails, the English text is shown along with a note.

**Why this priority**: The primary target audience is Russian-speaking patients; an English-only issue page would fail the core audience even though the page itself (User Story 1) would technically work.

**Independent Test**: Open a published issue in a locale that has no cached translation yet, confirm English text with a note is shown or a translation appears, then reopen the same issue in the same locale and confirm the same (now-cached) translated text is served without a new translation delay.

**Acceptance Scenarios**:

1. **Given** an issue's summary and item sentences exist only in English, **When** a reader opens the issue in a non-English supported locale for the first time, **Then** the system requests a translation and, once available, displays the translated text.
2. **Given** a translation for a given issue and locale has already been produced, **When** any reader opens that issue in that locale again, **Then** the previously produced translation is reused rather than re-translated.
3. **Given** a translation request fails or is still pending, **When** the reader views the issue in that locale, **Then** the English text is shown along with a visible note that a translation is not yet available.
4. **Given** the reader switches between any of the five supported locales, **When** the issue page reloads, **Then** the summary, item sentences, and page chrome all appear in the newly selected locale (or English with a note, per the fallback rule).

---

### User Story 6 - Plain site chrome (Priority: P3)

A patient browsing the site sees a header, page titles, and descriptions written in plain, welcoming language appropriate for a patient audience — not internal-sounding terms like "Research Monitoring" or "configured research projects".

**Why this priority**: This is a polish pass over existing chrome; it improves trust and comprehension but does not block the core issue-reading or sharing journeys above.

**Independent Test**: Review the site header, homepage/project titles, and meta descriptions across all five locales and confirm no internal/technical wording remains and all text reads as addressed to a patient.

**Acceptance Scenarios**:

1. **Given** a reader lands on the site in any supported locale, **When** they view the header and page titles, **Then** the wording is patient-facing plain language, not technical/internal terminology.
2. **Given** a reader views a project's page description or metadata, **When** it renders, **Then** it describes the project in terms a patient would understand rather than as a "configured research project".

---

### Edge Cases

- **No new items in a week**: no issue is published for that week (existing behavior); the health/status endpoint still reports the scheduled run as successful.
- **Issue text generation fails at publish time**: the issue page still renders with the item list and titles (summary section omitted or shown as unavailable); the failure is logged as an error through existing alerting.
- **Digests published before this feature existed**: their issue text is generated once, after the feature ships, so no existing published digest is left without an issue page.
- **Translation missing or failing for a requested locale**: English text is shown with a visible note rather than a blank or broken section.
- **Concurrent first requests for the same untranslated issue+locale**: only one translation attempt runs; all concurrent requests either wait on that single attempt (up to ~8 seconds) or fall back to English-with-note, and no duplicate translation calls are made.
- **Owner edits or regenerates an issue's English text after translations exist**: cached translations for that issue are invalidated immediately, so subsequent locale requests re-translate rather than serving stale text.
- **Owner hides a published issue**: the issue page and any links to it (project page, archive, shared URLs) stop serving it publicly.
- **Trial registration with no outcomes yet**: described as a study that is planned or recruiting, never described as having results.
- **Very small or early-stage study**: summary and per-item sentence use cautious, hedged wording rather than confident claims.
- **Mobile, no JavaScript**: the issue page's core content (summary, material list, disclaimer) remains readable without requiring JavaScript execution.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The system MUST expose a stable, shareable, locale-prefixed URL for each published digest ("issue"), reachable without registration.
- **FR-002**: Each project page MUST link to an archive listing every published issue for that project, newest first.
- **FR-003**: Each issue MUST have a generated summary of 3–5 plain-language points (roughly a school-reading level, at most ~120 words) explaining what changed and why it matters, derived only from the items included in that issue.
- **FR-004**: Each material within an issue MUST have one generated plain-language sentence (at most ~30 words) describing what it is about, distinct from that material's existing specialist summary.
- **FR-005**: All generated patient-facing text (issue summaries and per-item sentences) MUST NOT recommend doses, drugs, or treatment changes, and MUST NOT state findings beyond what the source material says.
- **FR-006**: All generated patient-facing text MUST use cautious wording for early-stage or small studies and MUST describe trial registrations as planned or recruiting studies, never as having outcomes or results.
- **FR-007**: Each point in an issue's generated summary MUST link to the specific issue item(s) it is based on, so every claim in the summary can be traced to a listed item by following that link; all other generated patient-facing text (per-item sentences) MUST likewise be traceable back to the specific item it describes.
- **FR-008**: Materials within an issue MUST be ordered by existing importance value first, then by newest first, with trial registrations visibly distinguished from publications.
- **FR-009**: Every issue page, the project page, and material detail pages MUST expose localized page metadata (title, description, and Open Graph/Twitter card data) including an image, so that sharing the link produces a rich preview.
- **FR-010**: The system MUST use a generated per-issue image for page metadata when available, and fall back to a default project image otherwise.
- **FR-011**: Every issue page and material detail page MUST display a medical disclaimer stating the content is an automated overview and not medical advice, and a visible label stating that summaries are AI-generated from the linked sources — both in the reader's active locale.
- **FR-012**: Issue-level generated text (summary and per-item sentences) MUST be authored once in English and translated into a requested locale on first request, with the translation cached and reused for subsequent requests in that locale. When the first request for a given issue+locale arrives, the page render MUST wait up to approximately 8 seconds for that translation to complete before falling back per FR-013; the translation MUST then continue to completion in the background so it is cached for the next request. Link-preview crawlers requesting the same issue+locale MUST receive the same wait-then-fallback behavior as a reader's browser. Concurrent requests for the same issue+locale MUST NOT trigger more than one translation attempt for that pair — later concurrent requests wait on (or fall back ahead of) the single in-flight attempt rather than starting their own.
- **FR-013**: When a translation for the active locale does not yet exist, is still in progress past the wait defined in FR-012, or fails to generate, the system MUST display the English text along with a visible note that translation is not yet available.
- **FR-014**: Issue text generation MUST be triggered when a digest is published; for digests published before this feature existed, the system MUST generate issue text for them once so no existing published digest has an empty issue page.
- **FR-015**: If issue text generation fails, the issue page MUST still render with the item list and titles, and the failure MUST be recorded as an error through existing alerting.
- **FR-016**: The issue page MUST remain usable (readable core content) at a 360px viewport width and without JavaScript execution.
- **FR-017**: All reader-facing pages covered by this feature (issue page, archive, project page chrome) MUST support all five existing UI locales (English, German, Turkish, Russian, Ukrainian).
- **FR-018**: Site chrome text (header, page titles, descriptions) MUST use plain, patient-facing language rather than internal/technical terminology, across all supported locales.
- **FR-019**: The flat, ungrouped materials feed introduced by an earlier feature MUST remain available and unchanged alongside the new issue view. This specification amends the prior (002) clarification that a digest is not a visual grouping: a published digest is once again reader-visible, as its own issue page, while the flat feed itself remains unchanged.
- **FR-020**: Issues MUST publish weekly, every Monday at 04:00 UTC, anchored to the weekday so the schedule does not drift over time; this replaces the project's current daily publishing cadence. Each issue MUST cover every relevant item published since the previous issue (or, for the first issue, since publishing began).
- **FR-021**: The project owner MUST be able to, through the admin, edit or regenerate an issue's English summary and per-item sentences, and hide a published issue from public view. Editing or regenerating an issue's English text MUST invalidate that issue's cached translations so that readers next see either the updated English text or a freshly generated translation, not a stale cached translation.

### Key Entities

- **Issue**: The reader-facing representation of one published digest — has an issue date, a generated plain-language summary (English canonical, cached per-locale translations, editable/regenerable by the owner), an ordered list of materials, localized page metadata (title, description, social preview image), and a visibility flag the owner can use to hide it from public view. One issue per published digest. Editing or regenerating the English summary invalidates its cached translations.
- **Issue Item Sentence**: The one-sentence, plain-language, patient-facing description generated for a single material within the context of a specific issue; distinct from that material's existing specialist (Objective/Methods/Results) summary.
- **Issue Archive**: The ordered (newest-first) listing of all published issues for a given project.
- **Disclaimer/AI Label**: Reusable, localized trust-signal content shown on every issue page and material detail page.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A link to a published issue, pasted into Telegram, VK, and WhatsApp, shows a title, description, and image in the sharer's chosen language.
- **SC-002**: Three patients from patient chats, shown a published issue on their own phone, can each describe in their own words what is new that week within one minute of opening the link.
- **SC-003**: The first two scheduled weekly issues publish with no manual intervention.
- **SC-004**: Manual review of the first three published issues finds zero medical-advice statements and zero claims not supported by the items linked in that issue.
- **SC-005**: Every issue page and material detail page shows the disclaimer and AI-generated label in the reader's active locale, across all five supported locales.

## Assumptions

- A week with no new relevant items publishes no issue for that week (see FR-020 for the cadence itself).
- English is the canonical language for all generated issue text; other locales are translated on first request and cached, consistent with existing platform i18n policy. Pre-translation for email delivery (a separate, future feature) is out of scope here.
- Hosting and data continue to reside in the EU (Frankfurt), consistent with existing infrastructure.
- The domain model remains disease-agnostic: no disease names are hardcoded, and disease/audience wording is sourced from project data, consistent with the platform's existing approach.
- Item importance ranking uses the existing importance value; a dedicated importance rubric or top-N selection is a later, separate feature.
- Existing material detail pages, source badges, and specialist (Objective/Methods/Results) summaries are unchanged by this feature; issue-level and per-item plain-language text is additive.
- A generated per-issue social-preview image is preferred but not required for launch; a default project-level image is an acceptable fallback.
- Email subscriptions/sending, a dedicated clinical-trials section, a fuller per-item patient layer, organ/topic tags, a landing/methodology page, and custom domain setup are explicitly out of scope for this feature and are tracked as separate, later specs.
