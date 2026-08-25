# Feature Specification: Research Monitoring MVP

**Feature Branch**: `001-research-monitoring-mvp`

**Created**: 2026-08-26

**Status**: Draft

**Input**: User description: "Build the MVP of HHT Research Platform — research project setup, scheduled source monitoring (PubMed, ClinicalTrials.gov, RSS), dedupe/classify/summarize/rank pipeline, public digest feed with importance filter and on-demand translation, optional owner email on publish. Out of scope: RAG, MCP, multi-model choice, >3 source types, collaboration, read/unread tracking, dedicated translation APIs."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Read a public project digest feed (Priority: P1)

A visitor (researcher, student, or community member) opens a project-specific public URL without signing in. They see a chronological feed of published digests for that research project and can filter publications by importance level (Critical / High / Medium / Low). Each listed publication can be opened for more detail.

**Why this priority**: Public, registration-free consumption is the primary product value and how the Cure HHT community (and similar audiences) will use the platform.

**Independent Test**: With at least one published digest seeded for a project, an anonymous visitor can open the project URL, see digests in order, apply an importance filter, and open a publication entry.

**Acceptance Scenarios**:

1. **Given** a research project with at least one published digest, **When** a visitor opens the project’s public URL without logging in, **Then** they see a chronological list of digests for that project.
2. **Given** digests containing publications of mixed importance, **When** the visitor filters by an importance level, **Then** only publications at that level remain visible in the feed.
3. **Given** a publication listed in a digest, **When** the visitor opens it, **Then** they see the full AI summary sections and a link to the original source.
4. **Given** a visitor who is not the project owner, **When** they attempt any write action (create/edit project, sources, or schedule), **Then** those actions are unavailable without owner authentication.

---

### User Story 2 - Configure a research project and monitoring (Priority: P2)

The project owner authenticates through the admin panel and creates a Research Project with a topic name, description, and keywords. They add one or more monitored sources (PubMed, ClinicalTrials.gov, and/or an RSS feed URL) and set a monitoring schedule (daily, weekly, or monthly).

**Why this priority**: Without owner configuration there is nothing to monitor or publish; this is the enabling journey for the MVP success path (including the first real HHT-focused project).

**Independent Test**: An authenticated owner can create a project with keywords, attach at least one PubMed source, set a schedule, and later retrieve that configuration unchanged.

**Acceptance Scenarios**:

1. **Given** the owner is authenticated in the admin panel, **When** they create a project with name, description, and a keyword set, **Then** the project is saved and available for public viewing once digests exist (or as an empty public project page).
2. **Given** an existing project, **When** the owner adds a PubMed source (and optionally ClinicalTrials.gov and/or RSS), **Then** those sources are associated with the project and used by monitoring.
3. **Given** an existing project, **When** the owner sets schedule to daily, weekly, or monthly, **Then** subsequent monitoring runs follow that cadence.
4. **Given** an unauthenticated visitor, **When** they try to create or change projects, sources, or schedules, **Then** they cannot do so.

---

### User Story 3 - Automatic monitoring run produces a digest (Priority: P3)

On the configured schedule, the system queries each project source for new items matching the project’s keywords. Each newly fetched publication is deduplicated against previously seen publications, classified for relevance to the keywords, and — if relevant — given an AI summary (objective, methods, results, limitations, why it matters) and an importance ranking. All publications processed in that run that qualify for the digest are compiled into one Digest and published to the project’s public feed.

**Why this priority**: This is the automation that removes manual literature tracking; the public feed’s value depends on it.

**Independent Test**: With a configured project, keywords, and at least one source, triggering a monitoring run (or waiting for schedule) yields either a new published digest of new relevant items or no new digest when nothing new/relevant was found — without duplicating previously processed publications.

**Acceptance Scenarios**:

1. **Given** a project with keywords and a PubMed source, **When** a scheduled monitoring run executes and finds new matching publications not seen before, **Then** each is classified and relevant ones receive summary + importance and appear in a newly published digest.
2. **Given** a publication already processed for the project, **When** a later run would fetch the same publication again, **Then** it is not processed or summarized a second time.
3. **Given** a newly fetched publication classified as not relevant, **When** the run completes, **Then** that publication does not appear in the digest (and does not receive a full AI summary for the feed).
4. **Given** a monitoring run that finds no new relevant publications, **When** the run completes, **Then** no empty digest is published to the public feed.

---

### User Story 4 - Optional digest published email (Priority: P4)

When a new digest is published, the owner may optionally receive a short email that links to the public feed. The email does not include the full digest body.

**Why this priority**: Useful awareness for the owner but not required for visitors to consume digests; explicitly optional.

**Independent Test**: With notification enabled, publishing a digest sends one short email with a feed link; with it disabled, no email is sent.

**Acceptance Scenarios**:

1. **Given** the owner has enabled digest email notification for the project, **When** a new digest is published, **Then** the owner receives one short email containing a link to the project feed and not the full digest content.
2. **Given** the owner has disabled (or never enabled) digest email notification, **When** a new digest is published, **Then** no digest notification email is sent.

---

### User Story 5 - Read digests in a preferred language (Priority: P5)

The public UI is available in English, German, Turkish, Russian, and Ukrainian. AI-generated English content is shown by default; when the visitor selects another language, a translation is produced on first request for that content and reused for later viewers of the same language.

**Why this priority**: Constitution requires first-class i18n for the target communities; deferred after a working English feed is acceptable only as story priority within the same MVP, not as a post-MVP retrofit of product intent.

**Independent Test**: Switching locale shows UI chrome in that language; requesting a non-English view of an English summary yields a translation that subsequent visitors in that language receive without regenerating from scratch.

**Acceptance Scenarios**:

1. **Given** a visitor on the public site, **When** they select English, German, Turkish, Russian, or Ukrainian, **Then** the public UI chrome appears in that language.
2. **Given** AI-generated digest/publication content stored in English, **When** a visitor first requests it in another supported language, **Then** a translation is shown for that language.
3. **Given** a translation already produced for a publication in a language, **When** another visitor requests the same content in that language, **Then** the previously produced translation is reused (no redundant first-time generation delay for the same pair).

---

### Edge Cases

- Source returns no results for the keyword query: run completes successfully; no digest if nothing new/relevant.
- Source is temporarily unavailable or returns an error: that source fails for the run without blocking the whole platform; owner-visible run outcome reflects partial failure; other sources for the same project still process if possible.
- RSS feed URL is invalid or non-feed content: configuration is rejected or the run records a clear failure for that source.
- Keyword set is empty: project cannot be saved for monitoring (or schedule cannot be activated) until at least one keyword exists.
- Publication lacks abstract or body text needed for summarization: item is still deduplicated and classified; if marked relevant, summary notes limited source text rather than inventing clinical detail.
- Extremely large result set in one run: run processes within a bounded batch per run (see Assumptions); remaining items wait for a subsequent run rather than hanging indefinitely.
- Duplicate across sources (same paper via PubMed and RSS): treated as one publication for the project after deduplication.
- Visitor requests an unsupported language: only the five supported locales are offered.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow an authenticated project owner to create and update a Research Project with topic name, description, and a non-empty set of keywords.
- **FR-002**: System MUST allow the owner to attach one or more monitored sources to a project, limited to PubMed, ClinicalTrials.gov, and RSS feed URL types (no additional source types in this MVP).
- **FR-003**: System MUST allow the owner to set a monitoring schedule of daily, weekly, or monthly per project.
- **FR-004**: System MUST run monitoring automatically according to each project’s schedule without the owner manually triggering each run (manual/test trigger MAY exist for the owner but MUST NOT be required for normal operation).
- **FR-005**: On each run, the system MUST query each configured source for items matching the project’s keywords and fetch candidate publications new to that run’s discovery window.
- **FR-006**: System MUST deduplicate newly fetched publications against publications already known for that project so the same work is never fully processed twice.
- **FR-007**: System MUST classify each new publication’s relevance to the project’s keywords; only relevant publications proceed to summarization and digest inclusion.
- **FR-008**: For each relevant new publication, the system MUST generate an English AI summary including objective, methods, results, limitations, and why it matters, plus an importance ranking of Critical, High, Medium, or Low.
- **FR-009**: System MUST compile all qualifying publications from a single successful monitoring run into one Digest and publish it to that project’s public chronological feed when at least one qualifying publication exists.
- **FR-010**: System MUST NOT publish an empty digest when a run finds no new relevant publications.
- **FR-011**: Anyone MUST be able to view a project’s published digests and publication summaries at a project-specific public URL without registration or login.
- **FR-012**: Visitors MUST be able to filter the public feed by importance level.
- **FR-013**: Visitors MUST be able to open a publication from a digest to view the full AI summary and a link to the original source.
- **FR-014**: Write operations (create/configure projects, sources, schedules, notification preference) MUST require owner authentication via the admin panel; the MVP MUST NOT introduce a separate public end-user account system.
- **FR-015**: System MUST support optional owner email notification when a digest is published; the message MUST be short and MUST include a link to the feed without the full digest content.
- **FR-016**: Public UI MUST support English, German, Turkish, Russian, and Ukrainian locale selection.
- **FR-017**: AI-generated content MUST be produced in English as the canonical language; translations into other supported languages MUST be generated on first request for that content+language and reused thereafter (not pre-generated for every language up front).
- **FR-018**: Domain concepts (project, source, digest, publication) MUST remain topic-agnostic; HHT is the first deployed project instance, not a hardcoded product constraint.
- **FR-019**: System MUST exclude from this MVP: RAG/vector search over accumulated publications, in-product MCP integrations, more than three source types, owner choice of AI model, shared/multi-owner or collaboration features, per-visitor read/unread tracking, and a dedicated third-party translation API as a required dependency (a machine-translation fallback link is acceptable if AI translation quality is insufficient).

### Key Entities

- **Research Project**: Named research topic area with description, keywords, schedule, optional email-notification preference, and a public URL identity; owned by a single owner for MVP.
- **Monitored Source**: A configured input for a project — PubMed, ClinicalTrials.gov, or RSS — used by monitoring runs.
- **Monitoring Run**: A scheduled (or test) execution that fetches, deduplicates, classifies, summarizes, ranks, and may publish a digest.
- **Publication**: A distinct research item (paper, trial, feed item) known to a project, with source identity, relevance outcome, optional summary sections, importance rank, and original-source link.
- **Digest**: The published bundle of qualifying publications from one monitoring run for a project, ordered in the public chronological feed.
- **Content Translation**: A derived, cached rendering of canonical English AI content in a supported non-English locale, created on first request.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An authenticated owner can create one research project (first real instance: HHT-focused), add a keyword set, configure at least PubMed as a source, and set a schedule in under 15 minutes without developer intervention.
- **SC-002**: After schedule activation, a monitoring run completes without owner intervention and, when new relevant items exist, publishes exactly one new digest for that run to the public feed.
- **SC-003**: An anonymous visitor can open the project’s public URL and read at least one digest with AI-summarized, importance-ranked publications without creating an account.
- **SC-004**: Visitors can switch among the five supported languages and obtain non-English AI content for a given publication within one first-request wait, with subsequent requests for the same content+language served from the already produced translation.
- **SC-005**: Re-running monitoring against the same already-processed publications does not create duplicate digest entries for those publications (0 duplicates in a verification pass).
- **SC-006**: With email notification enabled, the owner receives a short link-only email within 10 minutes of digest publication; with it disabled, zero such emails are sent for that publish event.
- **SC-007**: Importance filtering reduces the visible publication list to the selected level with no off-level items remaining in the filtered view.

## Assumptions

- A single project owner operates the admin panel for MVP; multiple projects per owner are allowed, but success is proven with one public HHT-focused project.
- “Relevance” is a binary gate before summarization; importance ranking applies only to relevant publications included in digests.
- Deduplication key is based on stable external identifiers when present (e.g., DOI, PubMed ID, trial ID) and falls back to normalized title+source identity when not.
- Empty digests are not published (FR-010); the public feed simply shows the last successful non-empty digests.
- On-demand translation uses the same general AI capability as summarization unless quality is insufficient, in which case a visitor-facing machine-translation link (e.g., Google Translate) is an acceptable fallback — not a paid dedicated translation product integration.
- Monitoring runs process a bounded batch of new candidates per source per run; overflow is deferred to later runs.
- Owner email for notifications is the address associated with the admin/owner account.
- ClinicalTrials.gov and RSS are in MVP scope as configurable source types even if the first production proof uses PubMed only.
- Public project pages may show an empty state when no digests have been published yet.
- Out-of-scope items in FR-019 remain excluded even if technically easy to add during implementation.
