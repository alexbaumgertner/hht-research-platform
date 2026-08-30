# Feature Specification: Research Materials Feed

**Feature Branch**: `002-research-materials-feed`

**Created**: 2026-08-30

**Status**: Draft

**Input**: User description: "A read-only feed of research materials on a project page (e.g. `/[locale]/projects/hht`), surfacing tracked items — journal articles, clinical trials, news, clinical guidelines, and social posts — with clear visual distinction by source and by importance, fully responsive, and following the platform's existing locale routing."

## Clarifications

### Session 2026-08-30

- Q: Which materials are eligible to appear in the public feed? → A: Only materials already included in a published digest — digests stop being a visual grouping but remain the publishing gate
- Q: How is a syndicated-feed material sorted into the news, guideline, or social badge? → A: The owner tags each configured source once with a display category, and materials inherit it from the source they came from
- Q: What should the reader see while the feed loads, and if it fails to load? → A: The feed arrives complete with the page, so there is no in-page loading state; a load failure shows an inline error with a retry action and keeps the page chrome
- Q: Should the feed call its items "materials" or reuse the platform's "publications"? → A: "Material" is the reader-facing term in all five locales; "publication" remains the internal stored name, mapped once at the presentation boundary
- Q: How is a material with no usable title in any language handled? → A: Shown with a neutral placeholder built from its source and date, still linking out and still counted, rather than omitted

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Scan what is new on a research topic (Priority: P1)

A member of the patient/clinician community opens the HHT project page and immediately
sees a single-column list of everything the platform is tracking, newest first. Each
entry announces where it came from (journal article, trial registry, news, guideline,
social post) through a distinct, consistently coloured badge, and the handful of entries
the platform considers especially important are gently set apart from the rest. Clicking
an entry's title takes the reader to the original source in a new tab, leaving the feed
open behind them.

**Why this priority**: This is the entire value of the feature. A reader who can only do
this — open the page and scan a correctly ordered, visually differentiated list — already
has a working product. Everything else narrows or translates this list.

**Independent Test**: Load the project page with a seeded set of materials spanning all
five source categories and both importance levels. Verify order (newest first), badge
distinctness, subtle high-importance treatment, and that title links open externally in a
new tab. No filtering or language switching required.

**Acceptance Scenarios**:

1. **Given** the project has tracked materials of several source categories, **When** a
   reader opens the project page, **Then** all materials render in one vertical column
   ordered by date with the most recent first.
2. **Given** a material entry is visible, **When** the reader looks at it, **Then** it
   shows a source badge (icon plus text label), the title, the date, and the summary when
   one exists.
3. **Given** a material entry, **When** the reader activates its title, **Then** the
   original source opens in a new browser tab and the feed page remains open and
   unchanged.
4. **Given** a material marked high importance, **When** it renders alongside normal
   materials, **Then** it carries a soft edge accent, a faint background tint, and a small
   muted textual label — and no saturated warning badge, alarm icon, or animation.
5. **Given** any material entry, **When** the reader clicks anywhere on it other than the
   title link, **Then** nothing happens — no navigation, no expansion, no selection.
6. **Given** the reader is anywhere in the feed, **When** they look for a way to add,
   change, or remove a material, **Then** no such control exists anywhere on the page.
7. **Given** the feed's content cannot be loaded, **When** the page renders, **Then** an inline
   error offering a retry appears — worded differently from the empty-project message — and the
   page header and language control remain usable.
8. **Given** a material has not been carried by a published digest, **When** the feed renders in
   any locale and under any combination of filters, **Then** that material is absent.

---

### User Story 2 - Narrow the feed down to what I care about (Priority: P2)

A reader who follows the topic regularly wants to cut through the full list: type a few
words to find a specific study, keep only trial-registry entries and guidelines, or hide
everything except the high-importance items. The controls sit above the feed, combine
with each other, and the reader can always tell whether they are looking at an empty
project or at an over-filtered list.

**Why this priority**: Meaningful only once a feed exists, but it is what makes a growing
list usable rather than merely present.

**Independent Test**: With a seeded multi-category list, exercise each control alone and
in combination, verify the visible set matches expectations, and verify the two empty
states are distinguishable from one another.

**Acceptance Scenarios**:

1. **Given** the reader types text into the search field, **When** the text matches part
   of a title or summary in the currently displayed language, **Then** only matching
   materials remain visible, matching case-insensitively.
2. **Given** the reader selects one or more source categories, **When** the selection is
   applied, **Then** only materials in those categories remain visible.
3. **Given** no source category is selected, **When** the feed renders, **Then** materials
   of every category are shown — an empty selection never produces an empty feed.
4. **Given** the high-importance toggle is switched on, **When** the feed renders, **Then**
   only high-importance materials are shown; switching it off restores the rest.
5. **Given** search text, a category selection, and the importance toggle are all active,
   **When** the feed renders, **Then** only materials satisfying all three conditions at
   once are shown.
6. **Given** the project has materials but the active filters match none, **When** the feed
   renders, **Then** a "nothing matches your filters" message appears together with a way
   to clear the filters.
7. **Given** the project has no materials at all, **When** the feed renders, **Then** a
   distinctly worded "nothing published yet" message appears and no filter-clearing
   prompt is offered.
8. **Given** any filter changes, **When** the result set updates, **Then** the sort order
   remains newest-first and the count of visible materials is stated on screen.

---

### User Story 3 - Read the materials in my own language (Priority: P3)

A Russian-, German-, Ukrainian- or Turkish-speaking reader switches the page language and
sees both the interface wording and the material titles and summaries in that language.
Where a particular material has not been translated yet, it still appears — in the best
available language — with a small, quiet note saying which language it is being shown in,
rather than disappearing or showing a blank.

**Why this priority**: The platform already serves five locales, so the feed must not be a
monolingual island. It is ranked below filtering because a reader can still get value from
an English-fallback feed, whereas an unfiltered thousand-item list is unusable.

**Independent Test**: Seed materials with partial translation coverage, then visit the feed
under each of the five locales and verify chrome translation, content translation, fallback
selection, and the fallback note.

**Acceptance Scenarios**:

1. **Given** the reader is on the feed, **When** they change the language, **Then** both the
   interface wording and the material titles and summaries switch to that language.
2. **Given** a material has no content in the active language but has English content,
   **When** it renders, **Then** the English content is shown with a small unobtrusive note
   naming the displayed language.
3. **Given** a material has no content in the active language and none in English, **When**
   it renders, **Then** content from any available language is shown with the same note.
4. **Given** the reader has search text and filters applied, **When** they change the
   language, **Then** their search text, category selection, and importance toggle are
   preserved.
5. **Given** search text is entered, **When** the language changes, **Then** matching is
   evaluated against the newly displayed language's title and summary.

---

### Edge Cases

- **Project with zero materials** — distinct empty state, no filter-clearing prompt, controls
  either hidden or visibly inert rather than misleadingly interactive.
- **Filters exclude everything** — distinct empty state with a clear-filters affordance; the
  feed must never render a bare blank region.
- **Content fails to load** — a third, distinctly worded state with a retry action; never
  presented as an empty or unpublished project.
- **All source categories deselected** — treated as "all categories", not as "none".
- **Material with no summary** — the entry renders with title, badge, and date only, with no
  collapsed or ragged gap.
- **Material with no translation in any locale, or an empty title** — the entry still renders,
  using a neutral placeholder built from its source category and date, and still links to the
  original. It is never omitted and never rendered as a blank row.
- **Material with an unrecognised source category** — renders with a neutral fallback badge
  instead of breaking the row or being silently dropped.
- **Material with a missing or unparseable date** — sorts last and displays no date rather
  than an invalid one.
- **Material with a missing or malformed external link** — the title renders as plain text,
  not as a broken link.
- **Very long title or summary, and long translated labels** (German and Russian strings run
  considerably longer than English) — wrap without overflowing the card or clipping badges.
- **Narrow viewport (320 px)** — header and controls stack vertically; no horizontal scroll.
- **Keyboard-only reader** — every control is reachable in a sensible order with a visible
  focus ring; no control is mouse-only.
- **Screen-reader reader** — source and importance are conveyed in text, not by colour alone.
- **Dark colour scheme** — all five source colours and the high-importance tint remain legible
  and mutually distinguishable.

## Requirements _(mandatory)_

### Functional Requirements

#### Feed content and ordering

- **FR-001**: The project page MUST present a read-only feed of the research materials
  published for that project.
- **FR-002**: A material MUST appear in the feed only after it has been included in a published
  digest. Materials that are awaiting review, that were reviewed and rejected, or that have not
  yet been carried by a published digest MUST NOT be visible to the public, in the feed or in
  any data it relies on.
- **FR-003**: Digests MUST remain the publishing gate while ceasing to be a visual grouping;
  removing the digest-grouped layout MUST NOT widen what is publicly visible.
- **FR-004**: The feed MUST always be ordered by material date, newest first, with no
  user-facing control to change the ordering.
- **FR-005**: Each material entry MUST display its source badge, its title as an outbound
  link, its date, and its summary when a summary exists.
- **FR-006**: Activating a material's title MUST open that material's external address in a
  new browser tab while leaving the feed page loaded and in its current state.
- **FR-007**: No part of a material entry other than the title link MUST be interactive.
- **FR-008**: The feed MUST expose no affordance to create, edit, or delete a material, and
  MUST perform no write operation of any kind.
- **FR-009**: The feed MUST be readable without registration or sign-in.

#### Source categorisation

- **FR-010**: Every material MUST be presented under exactly one of five display categories:
  journal article, clinical trial registry entry, news or press release, clinical guideline or
  recommendation, and social media post.
- **FR-011**: The five display categories MUST resolve from the three source kinds the platform
  already tracks — journal articles and trial registry entries map to their badge directly, and
  syndicated sources resolve to news, guideline, or social — so that the feature introduces no
  new ingestion source and does not raise the number of tracked source types.
- **FR-012**: Each configured syndicated source MUST carry a display category chosen by the
  project owner — news, guideline, or social — and every material collected from that source MUST
  inherit it. The same source MUST therefore always yield the same badge.
- **FR-013**: A material MUST record which configured source it came from, so its display
  category can be resolved.
- **FR-014**: Changing a source's display category MUST change the badge on every material from
  that source, including material already published, without re-collecting anything.
- **FR-015**: A syndicated source with no display category set MUST default to news rather than
  leaving its materials uncategorised.
- **FR-016**: Each display category MUST render as a badge combining an icon with a text label,
  and MUST use the same icon, label, and colour on every occurrence.
- **FR-017**: The category colours MUST be distinguishable from one another and legible against
  the entry background under both the light and the dark colour scheme.
- **FR-018**: A material carrying a display category that is unrecognised MUST still render,
  using a neutral fallback badge, and MUST remain reachable through the "all categories" view.
  This is distinct from an untagged syndicated source, which defaults to news under FR-015.

#### Importance

- **FR-019**: Each material MUST be presented at one of exactly two importance levels: normal
  or high.
- **FR-020**: A high-importance entry MUST be set apart by a soft edge accent, a faint
  background tint, and a small muted text label.
- **FR-021**: High-importance presentation MUST NOT use alarm-style treatment — no saturated
  or red badge, no warning iconography, no animation, no all-caps emphasis.
- **FR-022**: Importance MUST NOT influence position in the feed.

#### Search and filtering

- **FR-023**: Readers MUST be able to enter free text that restricts the feed to materials
  whose title or summary, in the currently displayed language, contains that text,
  case-insensitively.
- **FR-024**: Readers MUST be able to select any combination of source categories to restrict
  the feed to those categories.
- **FR-025**: An empty source-category selection MUST be treated as "all categories"; it MUST
  never be the cause of an empty feed.
- **FR-026**: Readers MUST be able to switch a single control that restricts the feed to
  high-importance materials only, and switch it back.
- **FR-027**: Active search text, category selection, and importance restriction MUST combine
  so that only materials satisfying all of them remain visible.
- **FR-028**: The feed MUST state how many materials are currently visible.
- **FR-029**: Changing any filter MUST update the visible feed without a full page reload and
  without losing the reader's scroll context unexpectedly.

#### Empty, loading, and failure states

- **FR-030**: When the project has no materials at all, the feed MUST show a message that
  identifies this as an empty project, and MUST NOT suggest clearing filters.
- **FR-031**: When the project has materials but none satisfy the active filters, the feed MUST
  show a distinctly worded message and offer a way to clear all active filters at once.
- **FR-032**: The feed's materials MUST arrive with the page already rendered, so that no
  loading placeholder, spinner, or content shift is shown for the initial feed.
- **FR-033**: When the feed's content cannot be loaded, the page MUST show an inline error that
  states the content is temporarily unavailable and offers a retry, while keeping the page
  header, language control, and navigation usable.
- **FR-034**: A load failure MUST be worded and presented distinctly from both empty states, and
  MUST never be reported to the reader as an empty or unpublished project.

#### Language and content localisation

- **FR-035**: All interface wording introduced by the feed MUST be available in every locale
  the platform serves (English, German, Turkish, Russian, Ukrainian) and MUST follow the
  platform's existing locale-prefixed routing.
- **FR-036**: A material's title and summary MUST be shown in the active locale whenever
  content for that locale exists.
- **FR-037**: When content for the active locale is absent, the feed MUST fall back to English;
  when English is also absent, it MUST fall back to any locale that has content.
- **FR-038**: Whenever fallback content is displayed, the feed MUST show a small, unobtrusive
  note naming the language actually shown; this note MUST NOT obstruct or delay reading the
  material.
- **FR-039**: A material with no usable title in any language MUST still render, using a neutral
  placeholder built from its source category and date, MUST still link to its external address,
  and MUST still be included in the visible-material count. It MUST NOT be omitted from the feed.
- **FR-040**: Changing the language MUST change both the interface wording and the material
  content, and MUST preserve the reader's current search text, category selection, and
  importance setting.
- **FR-041**: Adding a further locale MUST require only adding translation data — interface
  wording entries and per-material localised fields — with no change to feed presentation,
  filtering, or search behaviour.
- **FR-042**: Every locale's reader-facing wording MUST use that locale's equivalent of
  "material" for a feed item, and MUST NOT surface the internal term "publication" anywhere a
  reader can see it.

#### Layout, responsiveness, and theme

- **FR-043**: The feed MUST be a single vertical column with a comfortable maximum content
  width, horizontally centred, consistent with the platform's existing feed page, and MUST NOT
  become a multi-column grid at any viewport width.
- **FR-044**: On narrow viewports the page header and the feed controls MUST stack vertically
  without horizontal scrolling, clipping, or truncated labels, and material entries MUST remain
  full width and legible.
- **FR-045**: All colour, spacing, and corner-radius values MUST come from the platform's shared
  design tokens rather than values defined only for this view, and the feed MUST render
  correctly under both the light and the dark colour scheme.

#### Accessibility

- **FR-046**: The search field, source category controls, importance control, and language
  control MUST each be reachable and fully operable using the keyboard alone, in a logical
  order, with a clearly visible focus indicator.
- **FR-047**: The language control MUST carry an accessible label describing its purpose.
- **FR-048**: Source category MUST be conveyed by its text label and not by colour alone.
- **FR-049**: High importance MUST be conveyed by its text label and not by colour, tint, or
  border alone.
- **FR-050**: Outbound title links MUST make it discoverable to assistive technology that they
  open in a new tab.
- **FR-051**: When a filter changes the result set, the new count MUST be announced to assistive
  technology.

### Out of Scope

The interactive mockup this feature is derived from was built as a shared, editable prototype
to demonstrate the data model. The following parts of that mockup MUST NOT be built:

- The "Add material" button and any accompanying form or modal.
- Per-material "edit" and "delete" actions.
- The shared-list banner reading "Общий список — любой, у кого есть эта ссылка, может добавлять
  и редактировать материалы."
- Any client-side write path, mutation endpoint, or optimistic local editing state.
- Pagination, infinite scroll, and list virtualisation.
- Manual reordering of the feed.
- A platform-wide light/dark scheme toggle control (the feed must render correctly under both,
  but introducing the switch itself is separate work).
- Any new ingestion source. The two additional display categories come from tagging sources the
  platform already collects from; adding a genuinely new source type is separate work requiring
  its own scope decision.
- Automatic or AI-assisted guessing of a source's display category. The owner sets it by hand.
- A reader-facing view of digests as groupings. Digests remain the gate that decides what is
  published, but no longer drive the project page layout.
- Any change to how material is reviewed, approved, or admitted into a digest.

How tracked materials arrive in the system — ingestion, curation, importance assignment,
translation generation — is out of scope here and is settled during planning.

### Glossary

- **Material** — the reader-facing term for one item in the feed, in every locale. Chosen because
  the feed spans social posts, news, and guidelines, for which "publication" is inaccurate.
- **Publication** — the same thing as stored internally (formerly the reader-facing term too).
  Retained as the internal entity name; translation to "material" happens once, at the
  presentation boundary. These two words MUST NOT be mixed within a single layer: reader-facing
  copy and translation keys say material, stored data and internal contracts say publication.

### Key Entities

- **Research Material**: One published item surfaced in the feed; stored internally as a
  publication. Identified uniquely; carries a source category, an importance level, a date used
  for ordering, an external address, and localised content. Belongs to exactly one research
  project, and is surfaced only once a published digest has carried it.
- **Source Category**: The display classification determining a material's badge — journal
  article, clinical trial registry entry, news or press release, clinical guideline or
  recommendation, or social media post. Each has a stable icon, text label, and colour, with
  labels translated per locale. This is a presentation-layer classification derived from the
  three source kinds the platform tracks, not a fourth and fifth ingestion source.
- **Configured Source**: A monitoring source the project owner set up. Beyond its existing
  configuration it now carries an owner-chosen display category, which every material collected
  from it inherits. Journal and trial-registry sources map to their badge implicitly; syndicated
  sources are the ones the owner tags as news, guideline, or social.
- **Importance Level**: The two-valued presentation classification, normal or high, derived from
  whatever importance the platform records internally.
- **Localised Content**: The title and optional summary of a material for one locale, plus the
  record of which language was actually displayed when fallback occurred.
- **Feed View State**: The reader's transient search text, selected source categories, and
  high-importance setting. Not persisted beyond the session and never written to stored content.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A first-time reader can state the source and the recency of the newest material
  within 5 seconds of the page appearing, without scrolling.
- **SC-002**: In a usability check, participants correctly name a material's source category from
  its badge alone in at least 90% of trials, across all five categories.
- **SC-003**: In the same check, participants identify high-importance entries as "more
  important", and no participant describes them as warnings, errors, or alarms.
- **SC-004**: Applying, changing, or clearing any filter updates the visible list within 300
  milliseconds for a project of up to 200 materials.
- **SC-005**: The page renders with no horizontal scrolling and no clipped or truncated control
  labels at every viewport width from 320 to 1920 pixels, in all five locales.
- **SC-006**: All five locales render the feed with zero untranslated or missing interface
  strings.
- **SC-007**: Every interactive control is reachable and operable by keyboard with a visible
  focus indicator, and an automated accessibility audit reports zero critical or serious
  violations.
- **SC-008**: Adding a sixth locale is achieved by adding translation data only, with no
  modification to feed presentation, filtering, or search logic.
- **SC-009**: The rendered page contains zero controls capable of creating, editing, or deleting
  a material, and the feature adds zero public write endpoints.
- **SC-010**: Retagging a configured source's display category updates the badge on every
  material from that source, including already-published material, with no re-collection and no
  manual per-material edit.
- **SC-011**: The empty-project state, the no-matching-filters state, and the load-failure state
  are worded distinctly enough that a reader shown any one of them in isolation identifies which
  situation they are in.
- **SC-012**: The feed becomes readable within 2 seconds of navigation on a mid-tier mobile
  device over a typical mobile connection.
- **SC-013**: Materials lacking a translation in the active locale are still visible with a
  fallback-language note, so that 100% of published materials remain reachable in every locale.
- **SC-014**: With material seeded in awaiting-review and rejected states alongside published
  material, zero unpublished items are reachable through the feed under any locale or
  combination of filters.

## Assumptions

- **Route and page identity**: The feed occupies the existing locale-prefixed project page
  `/[locale]/projects/[slug]` and replaces the digest-grouped feed currently rendered there.
  Digests continue to decide what is published but no longer shape the reader's view, so the set
  of publicly visible material is unchanged by this feature — only its presentation changes.
  The HHT project keeps its seeded slug (`hht-research`); the `/projects/hht` form in the
  request is treated as shorthand rather than a requirement to rename it. Because this is a
  replacement, existing end-to-end coverage of the digest-grouped page must be updated
  alongside the new view.
- **Source category derivation**: The two categories the platform does not track natively —
  guideline and social — come from an owner-set display category on each configured syndicated
  source, inherited by every material that source produces. The number of ingestion source types
  stays at three, keeping the feature within the first-release scope discipline the project
  constitution requires; what changes is a presentation label on existing configuration, not the
  monitoring pipeline. This does require two small non-UI additions — a display category on the
  configured source and a link from each material back to its source — which are the only
  data-layer changes the feature introduces.
- **Badge accuracy is editorial**: Because the badge is inherited from the source, a source that
  mixes content types (a body publishing both news and guidelines, say) will badge everything
  the same way. This is accepted: the owner can split such a feed into two configured sources if
  the distinction matters.
- **Importance mapping**: The platform records four internal importance levels. These collapse
  to the two display levels of this feature — the top two map to "high", the rest to "normal".
  The internal four-level scale is unchanged by this feature.
- **Title translation**: The platform treats English as the canonical language for generated
  content and today translates summaries only. This feature specifies localised titles as the
  target behaviour, and the fallback rule (FR-037, FR-038) means it degrades correctly while
  titles remain English-only — English titles simply render with the fallback note.
- **Dark colour scheme**: The platform currently ships light only. This feature requires the feed
  to be built entirely from theme tokens so that it is correct under both schemes; shipping a
  user-facing scheme switch is out of scope.
- **List size**: A project holds tens of materials, and the whole set can be delivered and
  filtered in one page load. Pagination and virtualisation are deferred until a project exceeds
  a few hundred materials.
- **Filter state**: Search text, category selection, and importance setting are session-transient
  and reset on a fresh visit. Whether they are reflected in the address bar for sharing is a
  planning decision, not a requirement here.
- **Clear-filters affordance**: The "no matches" empty state offers a one-click reset. This was
  not requested explicitly but follows from distinguishing the two empty states usefully.
- **Reader anonymity**: Readers are unauthenticated members of the public, consistent with the
  platform's public-by-default stance.
- **Dependency**: The feature depends on the platform's existing locale routing, translation
  dictionaries, shared design tokens, and read-only public content access. It adds no
  public-facing write path; the only data-layer additions are the source display category and
  the material-to-source link described above, both maintained by the owner through the existing
  admin panel.
