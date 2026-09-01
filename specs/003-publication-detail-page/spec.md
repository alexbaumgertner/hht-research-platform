# Feature Specification: Publication Detail Page

**Feature Branch**: `003-publication-detail-page`

**Created**: 2026-09-01

**Status**: Draft

**Input**: User description: "As a User I want to see Abstract Or Body, Source Type, Summary (Objective, Methods, Results, Limitations, Why It Matters etc) so I don't need to open the publication link. It can be visible on the publication page. Remove 'opens in a new tab' - provide the link to original publication on this page."

## Clarifications

### Session 2026-09-01

- Q: On the material detail page, in what order should the source type, structured summary, and original abstract or body appear? → A: Source type with the title, then structured summary, then full abstract or body
- Q: When a reader follows the original-publication link on the detail page, should that publisher page open in the same tab or a new tab? → A: New tab — the detail page stays open; the feed never shows “opens in a new tab”
- Q: Should the material detail page also show the date and the high-importance treatment that already appear on the feed card? → A: Show date (when known) and high-importance treatment, matching the feed
- Q: If a reader opens a material detail address and the content cannot be loaded, what should they see compared with an unknown or unpublished material? → A: Not-found for unknown/unpublished; distinct load-error with retry for a published material that fails to load

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Read a material on the site without leaving (Priority: P1)

A reader scanning the project feed wants enough of a paper, trial, or other tracked item to decide whether it matters — without jumping away to the original publisher. They activate the material's title and land on that material's detail page, still on this site. There they see the source type, date, and high-importance treatment with the title (matching the feed), then the structured summary (objective, methods, results, limitations, and why it matters), then the original abstract or body when the platform has it. They can finish the visit without ever opening the original publication.

**Why this priority**: This is the whole request. Today the feed title sends the reader off-site, so the detail page is easy to miss and the original text is not offered on-site. Until this journey works, the rest of the feature has no entry point.

**Independent Test**: From a project feed with at least one published material that has abstract-or-body text, a source type, and a structured summary, activate the title, land on the detail page, and confirm all three content blocks are visible without following the original-publication link.

**Acceptance Scenarios**:

1. **Given** a published material is listed in the project feed, **When** the reader activates its title, **Then** they are taken to that material's detail page on this site (not to the original publisher).
2. **Given** the reader is on a material's detail page, **When** they look at the page, **Then** they see the title together with the source type, the date when known, and high-importance treatment when the material is high importance, then the structured summary sections that have content, then the original abstract or body when that text exists — in that order.
3. **Given** a material whose original abstract or body was collected, **When** the detail page renders, **Then** that full text appears after the structured summary so the reader can assess the item without opening the original publication.
4. **Given** a material with a structured summary, **When** the detail page renders, **Then** each populated summary section appears under a clear heading: Objective, Methods, Results, Limitations, and Why it matters (or that locale's equivalent).
5. **Given** the reader is looking at the feed, **When** they look at a material's title, **Then** there is no "opens in a new tab" wording, and activating the title does not open a new browser tab.
6. **Given** a high-importance material with a known date, **When** the detail page renders, **Then** the date and the same high-importance treatment used on the feed are visible with the title, without the reader returning to the feed.
7. **Given** an unknown, mistyped, or unpublished material address, **When** the reader opens it, **Then** they see a not-found state with a way back to the project feed, and they do not see the material's abstract, summary, or original link.
8. **Given** a published material whose detail content cannot be loaded, **When** the page renders, **Then** they see a distinctly worded inline error with a retry, the page header, language control, and back-to-feed path remain usable, and the message is not the not-found wording.

---

### User Story 2 - Open the original publication only when I choose to (Priority: P2)

After reading the on-site abstract and summary, a reader who still wants the publisher's page uses a clearly labeled link on the detail page. That is the only place the original publication is offered. The feed no longer hijacks the title into an off-site jump.

**Why this priority**: The original link remains necessary for verification and full-text access, but it is secondary to reading on-site. It is independently testable once the detail page exists.

**Independent Test**: Open a material detail page that has a usable original address, follow the original-publication link, confirm it opens in a new tab with the detail page still open, and confirm the feed title no longer goes there and no feed row shows “opens in a new tab”.

**Acceptance Scenarios**:

1. **Given** a material with a usable original address, **When** the reader is on its detail page, **Then** a clearly labeled link to the original publication is present on that page.
2. **Given** the reader activates that original-publication link, **When** the original site opens, **Then** it opens in a new browser tab, the detail page remains open in the original tab, and the reader has left this site only by that explicit choice — not by activating the material title in the feed.
3. **Given** a material whose original address is missing or unusable, **When** the detail page renders, **Then** no broken original-publication link is shown, and the rest of the page (title, source type, summary, abstract or body when present) remains readable.
4. **Given** the reader is on the feed, **When** they activate a material title, **Then** they stay on this site on the detail page; the original publication is not opened as a side effect.

---

### User Story 3 - Read the detail page in my language (Priority: P3)

A reader who has already chosen German, Turkish, Russian, or Ukrainian on the project page continues in that language on the detail page. Interface wording and the structured summary follow the same language rules as the feed. Source-collected abstract or body text that exists only in its original language still appears, with a quiet note when it is not in the active language, rather than being hidden.

**Why this priority**: The platform already serves five locales; a monolingual detail page would strand non-English readers. Ranked below the content itself because an English detail page is still useful, whereas a detail page that omits abstract, source, and summary is not.

**Independent Test**: Open the same published material under each supported locale and verify chrome translation, summary language (or documented fallback), and that stored abstract-or-body text remains visible.

**Acceptance Scenarios**:

1. **Given** the reader opens a material detail page, **When** the active language is one of the five supported locales, **Then** page chrome (headings, back link, original-publication link label) appears in that language.
2. **Given** a structured summary exists in the active language, **When** the detail page renders, **Then** those summary sections are shown in that language.
3. **Given** a structured summary does not exist in the active language, **When** the detail page renders, **Then** the summary is shown in the best available language using the same fallback rule as the feed, with a small unobtrusive note naming the language actually shown.
4. **Given** abstract or body text was stored in a language other than the active locale, **When** the detail page renders, **Then** that stored text is still shown, with the same style of language note if it is not in the active language, and is never omitted solely because it was not translated.

---

### Edge Cases

- **Material with no abstract or body** — the detail page still shows title, source type, structured summary, and original-publication link (when usable); the abstract-or-body block is omitted rather than shown as an empty heading or placeholder paragraph.
- **Structured summary missing some sections** — only sections that have content are shown; empty sections do not appear as blank headings.
- **Structured summary missing entirely** — the page still shows title, source type, abstract or body when present, and the original-publication link when usable; it is not treated as "not found" solely for lack of a summary.
- **Original address missing or unusable** — no original-publication link is rendered; the on-site content remains the primary reading path.
- **Unrecognised source type** — the page still renders, using the same neutral fallback source label the feed uses, rather than failing or hiding the material.
- **Missing or unparseable date** — no date is shown; the rest of the header (title, source type, importance when high) remains.
- **Normal-importance material** — no high-importance label, tint, or accent; the page is not marked as “normal” with extra chrome.
- **High-importance material** — the title/source/date header uses the same soft accent, faint tint, and muted text label as the feed card; the treatment is not applied as a full-page wash over the summary and abstract.
- **Unpublished material** (awaiting review, rejected, or never carried by a published digest) — the public detail page is not available; a reader who has the address sees the same not-found state as an unknown address, not the content and not a load-error.
- **Unknown or mistyped detail address** — the same not-found state as unpublished; the reader can still return to the project feed.
- **Published material fails to load** — a third, distinctly worded inline error with a retry; never presented as not-found or as an empty material. Header, language control, and back-to-feed remain usable.
- **Very long abstract or body** — the full stored text is shown after the structured summary and wraps without overflowing the page or forcing horizontal scroll; it MUST NOT push the summary below a wall of source text.
- **Very long translated headings** — German and Russian labels wrap; headings and the original-publication link remain fully visible.
- **Narrow viewport (320 px)** — title, source type, abstract or body, summary sections, and the original-publication link remain readable in a single column with no horizontal scroll.
- **Keyboard-only reader** — title in the feed, back-to-feed control, original-publication link, and load-error retry (when shown) are reachable in a sensible order with a visible focus ring.
- **Screen-reader reader** — source type and high importance are conveyed in text, not by colour alone; the original-publication link is named as the original publication (not a duplicate of the title) and is discoverable as opening in a new tab, without visible “opens in a new tab” companion text on the feed or beside the detail-page title.
- **Feed material with no title** — the same source-and-date placeholder used in the feed remains the activation target and still opens the detail page.

## Requirements _(mandatory)_

### Functional Requirements

#### Getting to the detail page

- **FR-001**: Activating a material's title in the project feed MUST take the reader to that material's public detail page on this site.
- **FR-002**: Activating a material's title in the feed MUST NOT open the original publication, MUST NOT open a new browser tab, and MUST NOT display "opens in a new tab" (or any locale equivalent of that phrase) on the feed.
- **FR-003**: The detail page MUST be readable without registration or sign-in, consistent with the rest of the public site.
- **FR-004**: A material MUST be reachable on the public detail page only when it is already eligible to appear in the public feed (carried by a published digest). Unpublished materials MUST NOT be readable at the public detail address.
- **FR-005**: The detail page MUST offer a way back to the project feed.
- **FR-030**: An unknown, mistyped, or unpublished material address MUST show a not-found state with a path back to the project feed, MUST NOT expose any of that material's content, and MUST NOT be worded as a temporary load failure.
- **FR-031**: When a published material's detail content cannot be loaded, the page MUST show an inline error that states the content is temporarily unavailable and offers a retry, while keeping the page header, language control, and back-to-feed path usable. That error MUST be worded and presented distinctly from the not-found state.
- **FR-032**: When a published material loads successfully, its detail content MUST arrive with the page already rendered, so that no loading placeholder, spinner, or content shift is shown for the initial view.

#### What the detail page shows

- **FR-006**: The detail page MUST display the material's title.
- **FR-007**: The detail page MUST display the material's source type using the same source classification and reader-facing labels as the feed (journal article, clinical trial registry entry, news or press release, clinical guideline or recommendation, social media post, or the feed's neutral fallback).
- **FR-008**: When original abstract or body text was stored for the material, the detail page MUST display that text in full, after the structured summary.
- **FR-009**: When no abstract or body text was stored, the detail page MUST omit that block entirely rather than showing an empty heading or a "not available" filler.
- **FR-010**: The detail page MUST display each structured summary section that has content, using these section identities: Objective, Methods, Results, Limitations, and Why it matters.
- **FR-011**: A structured summary section with no content MUST be omitted; it MUST NOT render as a blank heading.
- **FR-012**: Absence of a structured summary MUST NOT hide the rest of the detail page (title, source type, abstract or body when present, original-publication link when usable).
- **FR-013**: Source type MUST be conveyed by a text label, not by colour or icon alone.
- **FR-028**: When the material has a usable date, the detail page MUST display that date with the title and source type, using the same meaning as the feed. When the date is missing or unusable, the date MUST be omitted rather than shown as an invalid value.
- **FR-029**: When the material is high importance, the detail page MUST use the same high-importance treatment as the feed (soft edge accent, faint background tint, and a small muted text label) on the title/source/date header. High importance MUST be conveyed by that text label, not by colour, tint, or border alone. Normal-importance materials MUST NOT receive extra importance chrome.

#### Original publication link

- **FR-014**: When the material has a usable original address, the detail page MUST present a clearly labeled link to the original publication on that same page.
- **FR-015**: That original-publication link MUST be distinct from the material title; the title MUST NOT be the original-publication link.
- **FR-016**: When the original address is missing or unusable, the detail page MUST NOT render a broken or empty original-publication link.
- **FR-017**: The feed MUST NOT present the original publication as the primary action on a material; the original publication is offered only on the detail page.
- **FR-026**: Activating the original-publication link on the detail page MUST open the original address in a new browser tab and MUST leave the detail page loaded in the tab the reader was using.
- **FR-027**: Neither the feed nor the detail page MUST display “opens in a new tab” (or any locale equivalent) as visible companion text. Assistive technology MUST still be able to determine that the original-publication link opens in a new tab.

#### Language

- **FR-018**: All interface wording introduced or changed by this feature MUST be available in every locale the platform serves (English, German, Turkish, Russian, Ukrainian) and MUST follow the platform's existing locale-prefixed routing.
- **FR-019**: Structured summary text MUST be shown in the active locale whenever content for that locale exists, and MUST otherwise follow the same language-fallback rule and fallback note as the feed.
- **FR-020**: Stored abstract or body text MUST remain visible even when it is not in the active locale; if it is shown in a language other than the active locale, the page MUST show a small unobtrusive note naming the language actually shown.
- **FR-021**: Reader-facing wording MUST use each locale's equivalent of "material" for the item; the internal term "publication" MUST NOT appear anywhere a reader can see it, including the detail page chrome and the original-publication link label.

#### Layout and accessibility

- **FR-022**: The detail page MUST remain a single readable column on viewports from 320 pixels wide upward, with no horizontal scrolling and with long titles, abstracts, and translated labels wrapping rather than clipping.
- **FR-023**: The feed title control, the back-to-feed control, the original-publication link, and the load-error retry (when shown) MUST each be reachable and operable using the keyboard alone, in a logical order, with a clearly visible focus indicator.
- **FR-024**: Colour, spacing, and corner-radius values MUST come from the platform's shared design tokens, and the page MUST render correctly under both the light and the dark colour scheme.
- **FR-025**: The detail page MUST present content in this order: title together with source type, date when known, and high-importance treatment when applicable, then the structured summary (populated sections only), then the full abstract or body when that text exists. The original-publication link and back-to-feed control MUST NOT appear between the summary and the abstract or body.

### Out of Scope

- Generating or regenerating summaries, importance ranks, or translations as part of this feature.
- Translating stored abstract or body text when no translation already exists; this feature only surfaces text already held.
- Fetching full-text PDFs, publisher HTML beyond the stored abstract or body, or any new content from the original site at read time.
- Adding summary sections beyond Objective, Methods, Results, Limitations, and Why it matters.
- Changing how the feed lists, filters, badges, or truncates materials, other than where the title goes and the removal of "opens in a new tab".
- Making the entire feed card clickable, expanding a card in place, or adding a second "read more" control (the title is the entry to the detail page).
- Write actions, owner editing of abstract or summary on the public page, or any new public write path.
- Changing which materials are publicly visible (the published-digest gate is unchanged).

### Glossary

- **Material** — the reader-facing term for one tracked item, in every locale. The detail page is a page about a material.
- **Publication** — the same item as stored internally. Retained as the internal entity name; it MUST NOT appear in reader-facing copy.
- **Detail page** — the on-site page for a single material, where abstract or body, source type, structured summary, and the original-publication link are shown.
- **Abstract or body** — the original source text the platform already stored for the material (abstract, trial description, or feed body), as opposed to the generated structured summary.
- **Source type** — the reader-facing source classification already used on the feed (not a new taxonomy).
- **Structured summary** — the generated sections Objective, Methods, Results, Limitations, and Why it matters.
- **Original publication** — the publisher's or registry's own page for the item, reached only via the labeled link on the detail page.

### Key Entities

- **Material (Publication)**: One publicly visible tracked item. Identified uniquely; belongs to one research project; carries a title, a source type, an optional date, an importance level, an optional abstract or body, an optional structured summary, an optional original address, and localised content. Publicly shown only after a published digest has carried it.
- **Structured Summary**: The five-part generated synopsis attached to a material: objective, methods, results, limitations, why it matters. Individual sections may be empty.
- **Abstract or Body**: Optional original-source text stored with the material, shown on the detail page when present, not invented when absent.
- **Source Type**: Presentation classification shared with the feed, determining the source label the reader sees on both the feed and the detail page.
- **Original Publication Link**: The usable external address of the item, offered only on the detail page, opening in a new tab; never the feed title's destination.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: From the project feed, a reader reaches a material's on-site detail page in one activation of the title, without a new browser tab opening.
- **SC-002**: On a detail page for a material that has abstract-or-body text, a source type, and a structured summary, a reader can identify the source type and read the structured summary without scrolling past the original text, and can still read the original text further down the same page — in a timed check, within 30 seconds of the page appearing.
- **SC-011**: A reader who opens a detail page without using the feed (for example via a shared link) can state whether the material is high importance and, when a date is shown, how recent it is, without navigating back to the feed.
- **SC-003**: In a check of the feed, 100% of material titles go to the on-site detail page, and 0% of feed rows display "opens in a new tab" or a locale equivalent.
- **SC-004**: For materials that have a usable original address, 100% of detail pages present a working original-publication link that opens in a new tab while leaving the detail page open; for materials that do not, 0% of detail pages present a broken link. Zero feed rows display “opens in a new tab” or a locale equivalent.
- **SC-005**: A reader who never activates the original-publication link can still complete the primary reading task (source type + abstract or body when present + structured summary when present) for every published material that has at least one of those content blocks.
- **SC-006**: All five locales render the detail page chrome with zero untranslated or missing interface strings.
- **SC-007**: The detail page renders with no horizontal scrolling and no clipped headings or link labels at every viewport width from 320 to 1920 pixels, in all five locales.
- **SC-008**: Every interactive control on the feed title path and the detail page is reachable and operable by keyboard with a visible focus indicator, and an automated accessibility audit of the detail page reports zero critical or serious violations.
- **SC-009**: With unpublished materials seeded alongside published ones, zero unpublished items are readable at a public detail address.
- **SC-010**: The detail page becomes readable within 2 seconds of navigation on a mid-tier mobile device over a typical mobile connection.
- **SC-012**: The not-found state and the load-failure state are worded distinctly enough that a reader shown either of them in isolation identifies which situation they are in.

## Assumptions

- **Entry point**: The project feed remains the primary discovery surface. This feature changes only where the title goes (on-site detail instead of the original publisher) and removes the "opens in a new tab" wording. Filter, badge, importance, and truncated-summary behaviour from the materials feed stay as specified there.
- **Page identity**: The destination is the existing public per-material detail page already implied by the platform (the page a digest entry used to open for the full summary). This feature fills that page with abstract or body and source type, and makes the feed actually use it. No new public site section is introduced.
- **Source type is the feed's classification**: "Source Type" in the request is the same reader-facing source category already shown as a badge on the feed, not a new raw ingestion label and not a sixth category.
- **Abstract or body is already stored**: Monitoring already collects original text when the source provides it. This feature only displays that stored text. If it was never collected, the page does not try to fetch it live.
- **Abstract or body language**: Canonical stored text is typically English (or the source's own language). This feature does not add a new translation pipeline for that text. A language note is enough when the active locale differs.
- **Summary sections**: The five named sections already exist as the platform's summary shape. No additional named sections are required even though the request said "etc."
- **Reading order**: Source type, date when known, and high-importance treatment sit with the title; the structured summary comes next; the full abstract or body follows. This keeps the generated summary above potentially long source text so the 30-second reading check remains realistic. The original request listed abstract first as the content to stop leaving the site for, not as a required visual order.
- **Date and importance**: The detail page reuses the feed's date and two-level importance presentation so a deep-linked reader is not missing context. High-importance chrome applies to the header region only, not as a tint over the whole scrolling page. This feature does not change how importance is assigned.
- **Original link behaviour**: The original-publication link on the detail page opens in a new tab so the on-site reading context stays available. The feed never opens that address and never shows “opens in a new tab”. The detail page also does not show that phrase as visible companion text (that would have been a separate, rejected option); assistive technology can still determine the new-tab behaviour from the control itself. The link sits with the title and source type (before the summary), so it is findable without scrolling past the abstract and does not sit between the summary and the abstract or body.
- **Back navigation**: The back-to-feed control returns the reader to the same project's feed. Restoring the exact previous filter query is desirable but not required for this feature to succeed; browser Back already covers that when they came from the feed.
- **Not-found state**: An unknown, unpublished, or mistyped detail address shows a simple not-found message and a path back to the project feed. This is distinct from a published material that simply lacks abstract or summary (that page still renders) and distinct from a load failure.
- **Load failure**: Follows the same pattern as the materials feed: a published item that cannot be loaded is a temporary error with retry, never reported as missing. Successful detail content arrives with the page, so there is no happy-path loading placeholder.
- **Terminology**: Reader-facing copy continues the materials-feed glossary ("material" on the outside, "publication" only internally), even though this spec's directory uses "publication" to match the existing internal page name.
- **Dependency**: Relies on the public feed, locale routing, design tokens, and already-stored material fields. It adds no new ingestion source, no new summary pipeline, and no public write path.
- **Supersedes feed title behaviour**: Where the materials-feed specification required the title to open the original source in a new tab and to announce that to assistive technology, this specification replaces that behaviour. Feed listing, filtering, and badges are otherwise unchanged.
