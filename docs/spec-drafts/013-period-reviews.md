Period Reviews — monthly, quarterly, half-year and yearly reviews of everything the project published in the period, written for patients in plain language, so a reader who skipped weekly issues can catch up in one page.

## Why

- Weekly issues answer "what's new this week". Patients and the partner foundation also ask "what happened in HHT research this quarter / this year?" Today the only answer is scrolling the archive.
- Volume makes this worth it: about 3–5 items per week, so ~15–20 per month, ~50 per quarter, ~200 per year. A month or a quarter fits one page; a year does not without synthesis.
- A quarterly review is the natural content for the Cure HHT one-pager (roadmap Stage 3) and for the partner widget (spec 012).

## Who

- **Patient (primary).** Reads a review in Russian in 3–5 minutes: what changed, what matters, what's still unknown, which trials are recruiting.
- **Partner foundation / physician (secondary).** Uses the quarterly and yearly reviews as a citable overview with links to every source.
- **Owner.** Reviews are generated and published automatically; the owner can edit or hide one, as with issues.

## User stories

1. **P1 — Monthly and quarterly reviews.**
   - After a period ends, a review is generated from all public items whose feed publication date falls in the period.
   - It has: a plain-language "the period in brief" (3–5 points), highlights (up to ~5 items, each with one sentence on why it matters to patients), trial updates (new or changed recruiting trials), and counts (items by source and by study type).
   - Every summary point links to the items it's based on, and the link must point inside the period (same rule as issue summary points).
2. **P1 — Review pages and archive.**
   - `/[locale]/projects/[slug]/reviews` lists reviews by period; each review has a stable URL keyed by period (e.g. `2026-10`, `2026-q4`, `2026-h2`, `2026`).
   - Metadata and OG image, like issue pages. Medical disclaimer and AI label on every review.
3. **P2 — Half-year and yearly reviews.** Built from the quarterly reviews plus their highlights, not from raw items, so the AI input stays bounded and the reviews stay consistent with each other.
4. **P2 — Delivery.** Reviews reach subscribers and the chats the same way issues do (email + chat post kit), subject to Q2.
5. **P2 — Owner control.** Edit text, regenerate, hide from public — the same controls and status model as issue text (`pending` / `ready` / `failed`, attempts cap, "edited by owner" kept on regeneration).
6. **P3 — Backfill.** Generate reviews for past periods since the first real issue (2026-08), with the partial first period labelled as such.

## Decisions already made (please don't re-ask)

- **Periods: month, quarter, half-year, year** — all four.
- **Audience: patients, Russian, plain language.** Not a physician evidence review. English is generated too (for the partner foundation and the platform's default locale); other UI locales follow the existing translation path.
- **Sources: only what the project already collects** (PubMed, ClinicalTrials.gov, RSS). No new sources.
- **Fully automatic publishing**, as with issues (quarter criterion 1). The owner can hide or edit after the fact.
- **Topic-agnostic.** Prompts are parameterized by project fields; no disease names in code.
- **Safety rules are the same as for issue text:** no dosing or treatment advice, uncertainty wording, every claim traceable to an item.

## Requirements

- **Schedule.** Reviews are generated at a fixed time after the period ends (e.g. the 1st of the next month, after that day's run), anchored like the weekly cadence — no drift. Generation is idempotent: one review per (project, period type, period key).
- **Period boundaries** use one timezone, stored on the project (default `Europe/Moscow` for this project, configurable).
- **Bounded input.** Month and quarter use item titles + plain sentences + summaries, not full abstracts. Half-year/year use quarterly reviews. Hard cap on items per call; overflow is ranked out, not silently dropped (log it).
- **Thin periods.** A period with fewer than a threshold of items (see Q1) still gets a review, but a short one ("a quiet month") and with no invented trends. A period with zero public items gets no review.
- **Hidden or retracted items** (or items from hidden issues) are excluded; hiding an item after a review is published puts that review back into `pending`.
- **Highlights selection.** Until spec 007 (importance rubric) ships, highlights are chosen by the AI ranking items relative to each other within the period, with study type as an input. After 007, the rubric's level is a hard input.
- **Translations** follow the issue translation model (revision-bumped, cached per locale).
- **Cost.** At most a handful of AI calls per review; estimate monthly cost in the plan.

## Acceptance

- Given seeded items across two months, the monthly job creates exactly one review per month, links only to that month's items, and rerunning it creates nothing new.
- A quarterly review links only to items inside the quarter; the yearly review cites only quarterly reviews/highlights of that year.
- A hidden item disappears from the review page after regeneration.
- The review page renders in ru at 360 px with disclaimer, AI label and OG metadata.
- A second project with different keywords needs no code change (topic-agnostic test).

## Open questions

- **Q1 — Thin-period threshold.** Below how many items is a month "quiet"? Suggest 3.
- **Q2 — Email cadence.** Weekly issues already go out. Send monthly reviews by email too, or only quarterly/half/year? Recommendation: quarterly, half-year and yearly by email; monthly on the site, in the widget and in the chat post kit only. Subscription has no preferences (Constitution IV), so this is one rule for everyone.
- **Q3 — Partial first year.** Is the 2026 yearly review useful when data starts in August, or skip it and start with 2027?
- **Q4 — Spec order.** Ship after 007 (better highlights) or before (sooner, with relative ranking)? Recommendation: after 007 for quarterly/yearly; monthly can ship before.
