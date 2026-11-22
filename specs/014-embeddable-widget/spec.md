# Feature Specification: Embeddable Widget

**Feature Branch**: `014-embeddable-widget`

**Created**: 2026-10-27

**Status**: Draft

**Input**: User description: "Embeddable Widget — a partner site (first: curehht-ru.org) shows the latest issue and a subscribe form from this platform with one snippet, so patients who visit the partner site find the digest without looking for it."

## Clarifications

### Session 2026-10-27

- Q: How is the specific partner recorded on a subscription that stores only email, language, source and consent? → A: The source value names the partner (for example `site:curehht-ru`), built from the partner-site source plus the partner's attribution value. It is checked against the project's partner list. Anything unknown is recorded as `other`. No new subscriber field (FR-020).
- Q: If the domain turns out to be blocked for most Russian readers, what does this spec deliver? → A: The frame widget and its in-snippet fallback content only. The reachability check is a launch prerequisite. If the domain is blocked, a separate later spec adds a static snapshot that the partner's own build pulls from our public issue data (FR-034).
- Q2 (form in the frame or link-out) and Q3 (items shown) from the description are settled as recommended there. See Assumptions.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Latest issue on the partner site (Priority: P1)

A patient opens the "News" section of a partner patient site. Inside that page they see a block from this platform with the latest public issue of the project in their language: the issue date, the summary points, and the first few items, each with its title, its plain-language sentence and a link to the item page on our site. The block always shows the medical disclaimer line and the AI-generated label, and it has an "All issues" link to the project's issue archive. The patient learns what is new in research without knowing that our site exists.

**Why this priority**: The partner site's own news section is written by hand and was last updated in March 2026, while its readers are exactly our audience. Putting the weekly issue where they already read is the reason for this feature, and nothing else in this spec matters if the content isn't there.

**Independent Test**: Embed the widget for a project with at least two published issues on a test page served from an allowed origin, with locale `ru`. Confirm that the widget shows the newest visible issue's date, every summary point, the first 3 items in issue order with title, sentence and item link, the disclaimer, the AI label, and an "All issues" link. Confirm that every link opens our site in a new tab.

**Acceptance Scenarios**:

1. **Given** a project whose latest visible issue has 7 items, **When** the widget renders with default settings, **Then** it shows the issue date, every summary point, the first 3 items in the issue page's order, and a line or link indicating that the full issue has more items.
2. **Given** the snippet asks for 5 items, **When** the widget renders, **Then** it shows the first 5 items, or all of them if the issue has fewer.
3. **Given** the widget's locale is `ru` and the issue's Russian text exists, **When** it renders, **Then** the summary, item sentences and all widget text are in Russian.
4. **Given** the widget's locale is `ru` and the Russian text of the issue is not available yet, **When** it renders, **Then** it shows the English text with the same "not yet translated" note the issue page shows (spec 005 FR-013), and the widget chrome stays in Russian.
5. **Given** any widget state that shows issue content, **When** the widget is inspected, **Then** the medical disclaimer line and the AI-generated label are both visible without any interaction.
6. **Given** the owner hides the latest issue, **When** the widget is next loaded after its cache has been refreshed (at most 1 hour later), **Then** it shows the newest issue that is still visible, or the "no issues yet" state if none is visible.
7. **Given** a project with no published visible issue, **When** the widget renders, **Then** it shows a short localized line saying the first issue is coming, plus the subscribe option from User Story 3, and no error.

---

### User Story 2 - One-snippet embed that never breaks the partner page (Priority: P1)

The partner site maintainer copies one snippet from our instructions, sets the project and language, and pastes it into a page. The widget appears at the full height of its content, with no inner scrollbars, and adapts to narrow phones and to the reader's light or dark preference. Sites that do not allow third-party scripts can use a plain frame snippet with a fixed height instead. When our site can't be reached, the partner page shows a short static message with useful links instead of an empty box or an endless spinner. The maintainer never has to touch the snippet again: new issues appear by themselves.

**Why this priority**: The first partner is a static site that is rebuilt only when someone deploys it, so content has to be fetched in the reader's browser. The maintainer is a volunteer, so pasting the snippet has to be the only step. A partner won't keep a widget that can break their page.

**Independent Test**: Paste the script snippet into a static test page on an allowed origin, open it at 320 px and 1280 px wide in light and dark mode, and confirm the widget has no inner scrollbar and follows the color scheme. Paste the plain frame snippet and confirm it renders at its fixed height. Block our domain in the browser, reload, and confirm that the fallback message with its links appears within the timeout and no empty frame stays on the page.

**Acceptance Scenarios**:

1. **Given** the script snippet with a project and locale on a page from an allowed origin, **When** the page loads, **Then** the widget appears and its height matches its content, so the reader never sees a scrollbar inside the widget.
2. **Given** the widget's content height changes (for example the subscribe form shows a confirmation message, fonts finish loading, or the reader rotates the phone), **When** the change happens, **Then** the widget's height follows it.
3. **Given** a 320 px wide viewport, **When** the widget renders, **Then** all content is readable and usable without horizontal scrolling.
4. **Given** theme `auto` and a reader whose system prefers dark mode, **When** the widget renders, **Then** it uses its dark appearance. With theme `light` or `dark` it uses that appearance regardless of the reader's setting.
5. **Given** the plain frame snippet on a site that blocks third-party scripts, **When** the page loads, **Then** the widget renders at the height set in the snippet and all its content can be reached.
6. **Given** our domain is unreachable from the reader's network, including when the snippet's script itself cannot be fetched, **When** the partner page loads, **Then** within at most 10 seconds the reader sees the snippet's fallback content (one sentence and the links the partner put in the snippet, such as the VK community and the subscribe page), and never a blank frame, a browser error page inside the frame, or a spinner that does not stop.
7. **Given** the snippet names a project that does not exist or has no widget enabled, **When** the page loads, **Then** the partner page shows the fallback content and no error from our side.
8. **Given** a pull request in the partner site's repository that adds the snippet to its Russian news page, **When** its GitHub Pages preview is opened, **Then** the widget renders with the latest Russian issue.

---

### User Story 3 - Subscribe from the widget, attributed to the partner (Priority: P1)

A patient reading the widget subscribes without leaving the partner site. The widget has the same subscribe form as the issue page: email, email language, unticked consent checkbox linking to the privacy note, and the hidden anti-bot field. After submitting, they see the "check your inbox" message inside the widget. The confirmation email and the confirmation page work exactly as for subscriptions from our own site. The subscription is attributed to the partner site, not to `other`. A partner can instead choose a button that opens our subscribe page in a new tab, and that subscription is attributed to the partner too.

**Why this priority**: Quarter criterion 2 needs confirmed subscribers with a known source. Today they can only come from the patient chats. A partner site whose readers are already patients is the largest untapped source. Without attribution, these subscribers can't be told apart from `other`.

**Independent Test**: On a test page from an allowed origin, submit the widget's form with consent ticked, follow the confirmation link, and confirm in the admin that one new confirmed subscriber exists for the project with the partner's attribution and the chosen language. Repeat with the link-out option and confirm the same attribution.

**Acceptance Scenarios**:

1. **Given** a widget with locale `ru`, **When** the subscribe form renders, **Then** it shows an email field, an email language choice preset to Russian, and an unticked consent checkbox whose privacy link opens in a new tab.
2. **Given** a reader submits without ticking consent, **When** the form is processed, **Then** nothing is stored, no email is sent, and the widget shows the consent message in its own locale.
3. **Given** a reader submits a valid address with consent, **When** the form is processed, **Then** the widget shows the same "check your inbox" response as the issue page, the reader receives one confirmation email, and after confirmation the subscription is stored with the partner's attribution.
4. **Given** the reader's browser blocks third-party cookies and storage (for example Safari or Firefox defaults), **When** they use the widget's form, **Then** subscribing works the same way.
5. **Given** the partner chose the link-out option, **When** the reader presses the subscribe button, **Then** our subscribe page opens in a new tab, and a subscription made there is attributed to the partner.
6. **Given** a reader follows any link from the widget to our site and subscribes there during the same visit, **When** the subscription is stored, **Then** it is attributed to the partner (consistent with spec 006 FR-006).
7. **Given** someone repeatedly submits the widget's form, or fills the hidden field, **When** the submissions are processed, **Then** the same per-IP and per-address limits, honeypot handling and one-confirmation-per-hour rule apply as on our own site, and the widget submissions and the site submissions count against the same limits.
8. **Given** a submission that claims a partner attribution that is not configured for that project, **When** it is processed, **Then** it is recorded as `other`.

---

### User Story 4 - Link to the latest period review (Priority: P2)

When the project has published a monthly or quarterly review (spec 013), the widget also shows a link to the latest one, so readers who missed several weeks can catch up.

**Why this priority**: It adds value only after spec 013 ships, and the widget must not wait for it.

**Independent Test**: For a project with no period review, confirm the widget shows no review link and no empty space for one. After a period review is published, confirm the link appears, is localized, and opens the review in a new tab.

**Acceptance Scenarios**:

1. **Given** no published period review exists, **When** the widget renders, **Then** there is no review link and no placeholder.
2. **Given** a published, visible period review exists, **When** the widget renders, **Then** it shows one localized link to the latest review.

---

### User Story 5 - Embed analytics per partner (Priority: P3)

The owner sees, next to the existing issue-page counts in the admin, how many times the widget was viewed and how many outbound clicks it produced, per partner site, plus how many form submissions and confirmations came from each partner. No cookies are set and no personal data is stored.

**Why this priority**: The subscriber's attribution (User Story 3) already proves criterion 2. These counts add a conversion signal (views → clicks → subscriptions) that helps decide whether to approach more partners.

**Independent Test**: Load the widget twice on an allowed origin, click one item link and the "All issues" link, submit the form once, and confirm the admin shows 2 widget views, 2 outbound clicks and 1 form submission for that partner, and that no cookie was set in the widget.

**Acceptance Scenarios**:

1. **Given** the widget is viewed and its links are clicked, **When** the owner opens the analytics view, **Then** widget views and outbound clicks are shown per project and per partner, in the same place as the existing issue-page counts.
2. **Given** a reader uses the widget, **When** their browser is inspected, **Then** no cookie or local storage entry was created by the widget and no third-party tracker was loaded.
3. **Given** counting a click fails, **When** the reader clicks a widget link, **Then** the link still opens its target.

---

### Edge Cases

- **Page on an origin that is not allowed**: the browser refuses to display our embed page inside it, so none of our content renders. The script snippet detects that the widget never became ready and shows the fallback content after the timeout.
- **Project with an empty allow-list**: embedding is refused on every site. This is the default for every project until the owner adds origins.
- **Embed page opened directly in a browser tab** (not framed): it may render, since its content is public anyway, but it is excluded from search engine indexing so it does not compete with the issue page.
- **Latest issue hidden while its widget view is cached**: the widget is refreshed when the issue is hidden. If that refresh fails, the cached view expires within 1 hour at most. A hidden issue is never served in a fresh widget response.
- **Issue edited or regenerated** (spec 005 FR-021): the widget is refreshed the same way as when the issue is hidden.
- **Issue text generation failed** (spec 005 FR-015): the widget shows the item titles and links without summary points or sentences, like the issue page does, and still shows the disclaimer and AI label.
- **Translation still missing when the widget view is cached**: the English fallback shows with its note. Once the translation exists, readers see it within 5 minutes, without waiting for the full cache window.
- **Unsupported or missing locale in the snippet**: the widget uses English, the platform's default locale.
- **Item count out of range or not a number**: the widget uses the default of 3. A value larger than the issue's item count shows all items.
- **Widget locale is de, tr or uk**: the widget is in that locale and the email language is preset to English, because emails exist only in Russian and English (spec 006).
- **Same partner page embeds two widgets** (for example two projects): each widget sizes, falls back and attributes itself independently.
- **Partner page uses a strict security policy that blocks our script but allows frames**: the maintainer uses the plain frame snippet. If the policy also blocks frames, the snippet shows its fallback content.
- **Our site is slow but reachable**: if the widget becomes ready after the fallback has already been shown, the fallback stays, so the page doesn't jump while the reader is reading it.
- **Reader has JavaScript disabled on the partner page**: the script snippet shows its fallback content. The plain frame snippet still works, and its form submits without JavaScript, as on the issue page (spec 006 FR-001).
- **Rate limit hit from the widget**: the widget shows the same response as the site would (spec 006 edge cases), in the widget's locale.
- **Preview builds of the partner site on another origin** (such as a GitHub Pages preview on a fork): they render the widget only if their origin is added to the project's allow-list. Adding it is an owner action in the admin, with no code change.

## Requirements _(mandatory)_

### Functional Requirements

**Widget content**

- **FR-001**: The widget MUST show the project's latest published issue that is not hidden from the public: its date, every summary point, and the first N items in the issue page's order (spec 005 FR-008), each with title, plain-language sentence and a link to its item page. N defaults to 3 and can be set in the snippet. If the issue has more than N items, the widget MUST say how many more are in the full issue and link to it.
- **FR-002**: The widget MUST link to the full issue and to the project's issue archive ("All issues").
- **FR-003**: Whenever the widget shows issue content, it MUST show the medical disclaimer line and the AI-generated label (spec 005 FR-011) without any interaction.
- **FR-004**: Issue text MUST be shown in the widget's locale and follow the same translation and fallback rules as the issue page (spec 005 FR-012, FR-013). A view that shows the English fallback MUST be replaced by the translated view within 5 minutes after the translation becomes available.
- **FR-005**: A hidden issue MUST NOT appear in any freshly generated widget view. When the latest issue is hidden, the widget MUST show the newest issue that is still visible, or the "no issues yet" state.
- **FR-006**: The widget MUST NOT show any content that the platform does not already publish on the project's public pages.
- **FR-007**: When a published, visible period review exists for the project (spec 013), the widget MUST link to the latest one. When none exists, or spec 013 has not shipped, the widget MUST render without a review link or a placeholder.

**Embedding and allowed sites**

- **FR-008**: Each project MUST have a list of embed partners that the owner manages in the admin, with no code change. Each partner has a display name, one or more allowed origins, an attribution value, and a fallback community link if the partner wants one. A project with no partners MUST NOT be embeddable anywhere.
- **FR-009**: Responses for widget pages MUST tell browsers to display them only inside pages whose origin is on that project's list of allowed origins. Pages on any other origin MUST NOT display our content. Origins are matched exactly by scheme, host and port.
- **FR-010**: The script snippet MUST take the project, the locale, and optionally the item count, the theme (`light`, `dark` or `auto`, default `auto`) and the subscribe mode (form or link-out, default form). It MUST insert a frame with our widget page and keep the frame's height equal to the content height whenever the content changes, so the frame never shows its own scrollbar.
- **FR-011**: A plain frame snippet without any script MUST also work, at a fixed height chosen by the partner. All content MUST stay reachable at that height.
- **FR-012**: The snippet MUST carry fallback content (one sentence and the partner's links, for example to the VK community and to our subscribe page). This content MUST be visible when the script cannot load or JavaScript is off. It MUST stay visible when the widget hasn't signaled that it is ready within 10 seconds. It MUST be replaced by the widget only once the widget is ready. The partner page MUST never be left with an empty frame, an error page inside a frame, or a spinner that never stops.
- **FR-013**: The script MUST only accept size and readiness messages that come from our widget page, and MUST ignore all other messages.
- **FR-014**: With theme `auto`, the widget MUST follow the reader's system light/dark preference. With `light` or `dark`, it MUST use that appearance.
- **FR-015**: The widget MUST be fully usable at a 320 px viewport width without horizontal scrolling.
- **FR-016**: Widget pages MUST NOT set cookies or use browser storage, including the source cookie used on the main site (spec 006 FR-006). They MUST NOT load third-party scripts, trackers or fonts. They MUST be excluded from search engine indexing.
- **FR-017**: Every link that leaves the widget MUST open in a new tab without giving the opened page access to the partner page.

**Subscribing and attribution**

- **FR-018**: In form mode, the widget MUST offer the same subscribe form as the issue page (spec 006 FR-001): email, email language (preset to Russian for `ru`, English otherwise), an unticked consent checkbox naming the project and linking to the privacy note, and the hidden anti-bot field. Its responses MUST be shown inside the widget in the widget's locale. It MUST work in browsers that block third-party cookies and storage, and without JavaScript inside the frame.
- **FR-019**: In link-out mode, the widget MUST show a subscribe button that opens our subscribe page in a new tab. That page carries the partner's attribution.
- **FR-020**: The list of allowed subscription sources MUST be extended with a partner-site source. A subscription from the widget, or from our site reached through a widget link during the same visit, MUST be recorded with one source value that names the partner: the partner-site source plus that partner's attribution value (for example `site:curehht-ru`). The value MUST be accepted only if the partner is configured for the subscription's project. A missing or unrecognized source, including a partner value that is not configured for that project, MUST be recorded as `other`. The chat sources `vk`, `wa`, `fb` and `tg` stay unchanged.
- **FR-021**: A widget subscription MUST NOT store any data beyond what spec 006 FR-007 allows.
- **FR-022**: Widget subscriptions MUST go through the same abuse protection as the site's subscribe endpoint (spec 006 FR-008): per-IP and per-address rate limits, the honeypot, and at most one confirmation email per address per hour. These MUST share counters with the site, so that the widget is not a way around them. The on-screen response MUST stay identical for new, pending, confirmed and silently discarded addresses (spec 006 FR-005).
- **FR-023**: Confirmation emails, confirmation pages, welcome issue and unsubscribing for widget subscribers MUST behave exactly as spec 006 defines for any subscriber.

**Freshness and caching**

- **FR-024**: A widget view MAY be cached between our site and readers for at most 1 hour. It MUST be refreshed when an issue of the project is published, hidden, edited or regenerated, so readers normally see the change within minutes, and in any case within 1 hour.

**Performance**

- **FR-025**: The script snippet's code MUST be at most 3 KB compressed and MUST NOT depend on any UI framework.
- **FR-026**: The widget page MUST NOT ship any code of the admin panel to readers.
- **FR-027**: The widget's main content MUST become visible within 2.5 seconds on a mid-range phone over a 4G connection (75th percentile in a lab test with standard mobile throttling).

**Accessibility and language**

- **FR-028**: The widget frame MUST have a descriptive, localized title. The widget content MUST meet WCAG 2.1 AA, work with a keyboard and a screen reader, and declare its language. It MUST pass the same accessibility checks as the issue page.
- **FR-029**: Every widget text, including the frame title, the fallback examples in the partner instructions, the "no issues yet" line and the form messages, MUST be available in all five UI locales (Constitution VI).

**Analytics**

- **FR-030**: The system MUST count widget views and outbound clicks per project and per partner, plus form submissions and confirmations per partner, without cookies, personal data or third-party trackers. It MUST show these counts in the admin next to the existing issue-page counts (spec 006 FR-038, FR-040). Counting MUST NOT delay or break any link.

**Partner instructions and first partner**

- **FR-031**: The project MUST provide short partner instructions with both snippets, every option, a fallback-content example in Russian and English, and the note that the partner's origin must be added by the owner before the widget renders.
- **FR-032**: For launch, a pull request to the first partner's site repository MUST add the script snippet to its Russian news page. Its preview MUST render the widget with the latest Russian issue.

**Cross-cutting**

- **FR-033**: Partner names, origins, attribution values, fallback links and any disease-specific wording MUST come from project data or configuration, not from code (Constitution V).
- **FR-034**: The reachability of our domain from Russian residential and mobile networks without a VPN MUST be checked before the widget is offered to the first partner, and the result MUST be recorded in the project docs. This spec delivers the frame widget and its fallback content whatever the result. If the domain is blocked for most of those readers, the fallback content (FR-012) is what they see. A static snapshot that the partner's own build pulls from our public issue data is a separate, later spec.

### Key Entities

- **Embed Partner**: A site allowed to embed a project's widget. Belongs to one project. Holds a display name, one or more allowed origins (exact scheme, host and port), an attribution value that is unique within the project, and an optional fallback community link. Managed by the owner in the admin. With no partners, the project can't be embedded.
- **Widget View**: The rendered widget for one project, one locale, theme and item count: the latest visible issue's date, summary, first N items, links, disclaimer, AI label, optional period-review link, and subscribe form or button. Derived entirely from already-published data. Cacheable for at most 1 hour.
- **Subscriber** (from spec 006): Unchanged, except that its source can now name a partner of its project (FR-020). The accepted source values are now per project: the fixed chat sources plus one partner value per configured partner.
- **Analytics Count** (from spec 006): Gains widget metrics (widget view, outbound click) and a partner dimension. It still holds no personal data.
- **Issue** (from spec 005): The content shown. Its visibility, edits and regeneration trigger widget refreshes.
- **Period Review** (from spec 013, optional): If present, the latest one is linked from the widget.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A partner maintainer can add the widget to a page by pasting one snippet and changing at most two values (project and language), in under 5 minutes, with no further changes needed when new issues are published.
- **SC-002**: On a test page from an allowed origin, the widget renders the latest issue, sizes itself to its content with no inner scrollbar at 320 px and 1280 px widths, and a subscription made through it is stored with the partner's attribution.
- **SC-003**: On a test page from an origin that is not allowed, none of our content is visible. The fallback content is shown within 10 seconds.
- **SC-004**: After the owner hides the latest issue, no widget shows it any more within 1 hour, and normally within 5 minutes.
- **SC-005**: With our domain blocked in the browser, 100% of test loads on the partner page show the fallback content within 10 seconds, and none shows an empty frame or a spinner that doesn't stop.
- **SC-006**: The widget's main content is visible within 2.5 seconds on a mid-range phone over 4G (lab test with mobile throttling), and the script snippet adds at most 3 KB compressed to the partner page.
- **SC-007**: The widget passes the issue page's accessibility checks with no serious or critical violations. A keyboard-only user can read the content, open every link and submit the form.
- **SC-008**: The first partner's Russian news page shows the widget with the current issue in production. On 2026-12-31, the number of confirmed subscribers attributed to the partner can be read directly from the admin.
- **SC-009**: The owner can see widget views, outbound clicks, form submissions and confirmations per partner in the admin without external tools.

## Assumptions

- Decisions from the feature description are fixed: the first partner is the Russian-language patient site curehht-ru.org, with Russian only at launch, while the widget supports all five UI locales. There are no new content sources. All partner data comes from project data. The subscription still stores only email, language, source and consent. The widget sets no cookies and loads no third-party trackers.
- **In-frame form by default, link-out optional** (resolves the description's Q2 as recommended). The existing subscribe flow needs no cookie, because the source travels with the form submission. The in-frame form is therefore not affected by third-party cookie blocking. Link-out covers partners whose own policies get in the way.
- **First 3 items in issue order by default** (resolves Q3). Until spec 007 ships, importance does not tell items apart, so "first 3 in issue order" is the honest default. It matches the top-3 rule for chat posts in spec 006. When spec 007 ships, issue order already reflects its ranking, so the widget follows without changes.
- **Fallback content lives in the snippet itself**, not only in snippet options read by the script. If our domain is blocked, the script that would build the fallback is blocked too. Fallback markup that is shown until the widget is ready is the only form that always works. This still meets the description's intent: one sentence plus partner-chosen links.
- The live site currently sends no framing restrictions on any route, including the admin (verified on 2026-10-27), and serves pages as not cacheable. Restricting framing on non-widget routes is a separate small hardening fix, outside this spec. It should land before or together with this feature.
- The issue page has no automated accessibility checks today. "The same checks as the issue page" means the checks introduced for both pages as part of this work: an automated scan with no serious or critical violations, plus manual keyboard and screen-reader checks.
- The 10-second readiness timeout and the 5-minute translation refresh are defaults. They can be tuned in planning if measurements show a reason.
- The first partner's site is a static export on GitHub Pages, rebuilt only on deploy. The owner maintains its repository, so the snippet can be merged there directly. Preview origins used for testing are added to the allow-list by the owner and removed afterwards.
- Allowed origins are exact. Wildcard subdomains are not supported, because no partner needs them and they widen the attack surface.
- Spec 013 (period reviews) is not in this repository yet. User Story 4 is delivered by a check for its data that returns nothing until 013 ships.
- Depends on spec 005 (issues, archive, translation and fallback, hide/edit/regenerate) and spec 006 (subscribe flow, abuse protection, source attribution, anonymous counts and their admin view).
- Out of scope: hardening framing on non-widget routes, partner self-service onboarding, multiple widget layouts or custom styling beyond theme, showing materials outside issues, and a build-time static snapshot of the widget content on the partner site (a separate later spec if the FR-034 check fails).
- Removing a partner from the project does not change the source of subscriptions already recorded with that partner's value. Their attribution stays readable in the admin.
