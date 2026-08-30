# Research: Research Materials Feed

**Branch**: `002-research-materials-feed` | **Date**: 2026-08-30 | **Spec**: [`spec.md`](./spec.md)

This feature has no unresolved `[NEEDS CLARIFICATION]` markers — the `/speckit-clarify` session
closed all product-level ambiguity. What remains here are **technical** decisions the spec
deliberately left to planning (its Assumptions section says so explicitly in several places).
Each decision below states what was chosen, why, and what was rejected.

---

## R1 — Replace the digest-grouped read path with a new flat materials endpoint

**Decision**: Add `GET /api/public/projects/:slug/materials?locale=`, returning a flat,
already-locale-resolved array of published materials. The project page (`page.tsx`) calls this
instead of the existing `GET /api/public/projects/:slug/digests`. The old digests route is
deleted, along with `ImportanceFilter.tsx` (the four-level select it powered).

**Rationale**: A grep across `apps/web` and `apps/worker` confirms `GET
/api/public/projects/:slug/digests` has exactly one consumer — the page being replaced. Payload's
own internal `/api/digests` collection endpoint (used by the worker to _create_ digests) is a
different route and is untouched. Leaving the public digests route in place after nothing calls
it would be exactly the kind of orphaned surface Principle V (Maintainability) warns against.

**Alternatives considered**:

- _Keep `/digests` and reshape its response to be flat._ Rejected — the response shape (digest →
  publications) and the query semantics (importance-only filtering) don't match the new contract
  (search + multi-source + high-importance, locale-resolved). Forcing one endpoint to serve both
  shapes would make it harder to reason about than two clean, single-purpose ones.
- _Keep both endpoints indefinitely "just in case."_ Rejected — nothing in the spec or codebase
  needs it, and Principle V explicitly favors removing what's unused over keeping dead paths warm.

---

## R2 — Publishing gate: extend the existing digest-publish hook, don't add a join query

**Decision**: Add a denormalized `publications.feedPublishedAt` (date, system-managed) field. The
existing `Digests` collection's `afterChange` hook — which already denormalizes
`hasPublishedDigest` onto the project when a digest is created — is extended to also stamp
`feedPublishedAt` on every publication listed in the newly created digest. The materials endpoint
then queries `publications` directly with `where: { project: eq, feedPublishedAt: { exists: true } }`.

**Rationale**: This is the same pattern the codebase already uses and already trusts (see
`Digests.ts` `afterChange` → `research-projects.hasPublishedDigest`). Payload 3's join-field
feature could express "publication belongs to some digest" as a reverse-relationship query, but
it's a heavier, less-proven mechanism in this codebase for the same outcome, and Principle V
favors the boring, already-understood solution.

**Rejected**: Querying `digests` first and intersecting with `publications` client-side or in the
route handler — this is an N+1-shaped join done in application code for something the DB can
answer directly once the field exists, and it would need re-deriving from digests on every
request.

**Follow-on requirement — one-time backfill (must ship with this feature, not after)**:
`feedPublishedAt` does not exist on publications created before this feature. Without a backfill,
every already-published material vanishes from the feed the moment this deploys. A one-time
migration script must set `feedPublishedAt = digest.publishedAt` for every publication already
present in an existing digest's `publications` array, run once before/at deploy. This is captured
in `quickstart.md` and must become an explicit `/speckit-tasks` item — it is a correctness
requirement (FR-002/FR-003), not an optimization.

---

## R3 — Source badge derivation: two small additive schema fields, resolved at read time

**Decision**:

- Add `monitored-sources.displayCategory`: select (`news` | `guideline` | `social`), optional,
  shown in the admin UI only when `type === 'rss'`.
- Add `publications.monitoredSource`: relationship → `monitored-sources`, optional.
- The worker threads `source.id` (already available in `runProject`'s per-source loop) into both
  existing `cms.createPublication(...)` call sites as `monitoredSource`.
- Resolution at read time (in the materials endpoint, not stored):

  | `publication.sourceType`     | `monitoredSource.displayCategory` | Resulting badge                 |
  | ---------------------------- | --------------------------------- | ------------------------------- |
  | `pubmed`                     | n/a                               | `pubmed`                        |
  | `clinicaltrials`             | n/a                               | `trials`                        |
  | `rss`                        | `news` / unset / source missing   | `news` (FR-015 default)         |
  | `rss`                        | `guideline`                       | `guideline`                     |
  | `rss`                        | `social`                          | `social`                        |
  | anything else / unrecognised | n/a                               | neutral fallback badge (FR-018) |

**Rationale**: This is exactly what Clarification 2 resolved — the owner tags a source once, every
material from it inherits the badge, retagging propagates without re-collecting anything (FR-014,
SC-010). Storing the _resolved_ category on each publication was considered and rejected: it would
need a bulk rewrite every time an owner retags a source, which is precisely the re-collection cost
FR-014 says must not happen. Resolving at read time keeps retagging a single-row write.

**No backfill needed for this one**: legacy `rss` publications with no `monitoredSource` link
resolve to `news` under the same default-to-news rule that covers an untagged source (FR-015) —
the two cases collapse into one, so nothing has to run once this ships.

---

## R4 — Feed date is `publishedOrUpdatedAt`; missing means missing, not "pick another date"

**Decision**: The date used for both display and sort order is `publications.publishedOrUpdatedAt`
(the source's own publish/update date — already stored, already populated by every adapter). If
it is null, the material sorts last and shows no date, per the spec's own edge case wording
("sorts last and displays no date rather than an invalid one").

**Rationale**: The spec's data-model description ("publication/tracked date, used for sort order")
maps most naturally onto the field that already exists for exactly this purpose. Falling back to
`createdAt` or the digest's `publishedAt` when `publishedOrUpdatedAt` is missing was considered and
rejected — the spec's edge case explicitly wants missing dates to behave as _missing_ (sort last,
show nothing), not silently substituted with a different, potentially misleading date.

---

## R5 — Title localization: extend `content-translations`, translate in the same AI call as summary

**Decision**: Add a sibling `title` field (text) to `ContentTranslations` alongside the existing
`fields` group. The worker's existing per-locale translation step (`translateSummary`, called once
per qualifying publication per locale at digest-publish time) is extended to also translate the
title in the **same** model call — one enriched schema (`{ title, objective, methods, results,
limitations, whyItMatters }`) instead of two separate AI Gateway calls.

**Rationale**: Clarification 5 and the spec's "Title translation" assumption both anticipate this:
titles become localizable, but the platform's canonical-English-first, translate-on-publish
pattern doesn't change. Doing it in the same call keeps the AI Gateway cost profile exactly where
it is today (Principle III, Free-Tier-First) instead of doubling per-locale calls.

**Read-time fallback** (mirrors the existing summary fallback in
`/api/public/publications/[id]/route.ts`, generalized to also cover title):

1. Requested locale has a cached translation with both title and summary present → use it, no
   fallback note.
2. Otherwise → use the English (canonical) title/summary, with `isFallback: true` and
   `displayedLocale: 'en'` in the response, so the UI can render the small fallback note (FR-038).
3. English is always present (it's the canonical write-time language), so step 3 of the spec's
   three-tier fallback ("any locale that has content") is unreachable in practice today — it stays
   documented as future-proofing per FR-029, not implemented as dead branches.

---

## R6 — Search/filter architecture: fetch once per locale, filter entirely client-side

**Decision**: The server component fetches the full (small — "tens of items" per the spec's own
scale assumption) locale-resolved array once. A client component owns search text, source
selection, and the high-importance toggle, and filters the in-memory array on every change — no
network round-trip per keystroke or toggle.

**Rationale**: This is the only architecture that can meet SC-004 (filter updates within 300ms)
trivially and by construction, and it matches FR-032 (no loading state — the page arrives
complete). Server-side filtering (re-fetching on every filter change) was rejected as unnecessary
complexity for a dataset this size, and would violate FR-032/FR-024 (no reload, no visible loading
state) without a lot of extra plumbing (debouncing, request cancellation) to hide network latency
that a client-side filter simply doesn't have.

---

## R7 — Filter state lives in the URL; `LocaleSwitcher` learns to carry it across a locale change

**Decision**: Search text, selected sources, and the high-importance toggle are reflected in the
URL query string (`?q=`, `?sources=`, `?important=`), following the same convention the existing
`ImportanceFilter` already uses (`router.push` with a query string). `LocaleSwitcher` — a shared
component rendered once in the root locale layout — is extended to append the current query string
when it navigates to the new locale's URL, instead of dropping it.

**Rationale**: FR-040 requires that changing the language preserve the reader's search text,
category selection, and importance setting. A locale switch is a full navigation to a new
locale-prefixed URL, which remounts the page — any state that isn't in the URL is lost at that
point. Putting filter state in the URL solves FR-040 for free and, as a side effect, makes a
filtered view shareable via link (the spec left this optional; getting it for free is a reason to
take it, not a reason it was required). `LocaleSwitcher`'s current behavior of dropping the query
string on locale change is a small, low-risk, backward-compatible extension — on pages with no
query params (home page), it's a no-op.

**Rejected**: Client-only React state for filters. It cannot survive the remount a locale switch
causes, so FR-040 would need a separate carry-over mechanism anyway — at which point the URL is
the simpler mechanism, not an additional one.

---

## R8 — Load failure: a route-segment `error.tsx`, not a hand-rolled try/catch-and-render

**Decision**: Add `apps/web/src/app/[locale]/projects/[slug]/error.tsx`. The materials fetch
**throws** on a non-OK response (matching the existing `fetchProject` precedent in `page.tsx`, not
`fetchDigests`'s precedent of swallowing failure into an empty array — that swallow-to-empty
behavior is exactly what FR-034 now forbids).

**Rationale**: Next.js error boundaries only replace the tree below the nearest layout. Because the
global title and `LocaleSwitcher` live in `[locale]/layout.tsx` — one level above this route
segment — they keep rendering automatically when `error.tsx` takes over, satisfying "page header,
language control, and navigation remain usable" (FR-033) with no extra plumbing. `error.tsx`
receives a `reset()` function for free, which becomes the retry action (FR-033).

**Rejected**: Catching the fetch failure inside the page component and rendering an inline error
`<div>` conditionally. This works too, but duplicates what `error.tsx` already gives idiomatically
in the App Router, and it's easy to accidentally let a future edit slide back into the
swallow-to-empty bug this feature is explicitly fixing.

---

## R9 — Dark-scheme readiness without a user-facing toggle

**Decision**: Add `<ColorSchemeScript defaultColorScheme="auto" />` to the root `<head>` and set
`MantineProvider defaultColorScheme="auto"`. No toggle UI is added anywhere.

**Rationale**: FR-045 requires the feed to render correctly under both color schemes; the spec's
own Assumptions and Out of Scope sections are explicit that shipping a _switch_ is separate work,
but the feed still has to be correct if a reader's system already prefers dark. `auto` makes
Mantine's CSS variables (and therefore every `variant="light"` badge this feature uses) respond to
the OS-level preference with no additional application code — it is the minimal change that
satisfies the requirement without building the toggle the spec says not to build.

**Rejected**: Leaving `MantineProvider` as light-only (today's behavior) and just "being careful"
with hardcoded colors. That would not satisfy FR-045 for a reader whose system is already in dark
mode — it would look wrong by default, not just lack a switch.

---

## R10 — Icon library: `@tabler/icons-react`

**Decision**: Add `@tabler/icons-react` as a new dependency in `apps/web`, used for the search
input's leading icon and the five source-category badge icons.

**Rationale**: It's MIT-licensed, tree-shakeable (only the ~6 icons used are bundled), and is the
de facto icon set paired with Mantine in the wider ecosystem — Mantine's own documentation examples
use it throughout. No runtime cost, no paid tier, nothing that affects portability (Principle III,
Principle VIII).

**Rejected**:

- _Emoji or Unicode glyphs._ Inconsistent rendering across platforms/fonts, and FR-048/FR-049
  already require text labels to carry the meaning — glyphs would be decorative at best, a
  legibility risk at worst.
- _Hand-drawn inline SVGs._ More code to own and maintain for no benefit over a well-maintained
  library already aligned with the UI kit in use.

---

## R11 — Terminology boundary: one mapping function, not a rename

**Decision**: A single function (working name: `toMaterial(publication, locale): Material`) is the
only place the internal `publication` vocabulary is translated into the reader-facing `material`
vocabulary (per the spec's Glossary and FR-042). Everything below it (collections, API contracts
internal to Payload, worker code) keeps saying "publication."

**Rationale**: This is the direct implementation of Clarification 4's decision. Concentrating the
translation in one place means a future contributor can find "where material comes from" in one
function instead of guessing which of several renamed layers is authoritative.

---

## R12 — The existing publication detail page is left in place, just no longer linked from the feed

**Explicit call-out, not a silent decision**: Today, the digest-grouped feed links each publication
title to `/[locale]/projects/[slug]/publications/[id]` — a page rendering the full structured
summary (objective/methods/results/limitations/whyItMatters) plus a machine-translation fallback
link. Per FR-006, the new feed's title link goes **directly to the external `url`** instead. The
spec's Out of Scope section does not mention removing the detail page, and it offers real value
(structured sections, machine-translation fallback) this feed's card/summary preview does not
reproduce.

**Decision**: Keep the detail page and its API route (`/api/public/publications/[id]`) as-is. The
feed simply stops linking to it. It remains reachable by direct URL and is not deleted.

**Why this is called out rather than assumed**: it is a real, visible product change (a
previously-one-click-away page becomes unlinked) that the spec doesn't explicitly decide either
way. If the detail page should actually be removed, or the feed should link to it _in addition to_
the external URL, that's a product decision worth confirming before implementation — the plan
proceeds on "keep, but unlinked" as the conservative default that deletes nothing.

---

## Summary of new dependencies and schema changes

| Type                        | What                                                          | Why |
| --------------------------- | ------------------------------------------------------------- | --- |
| npm dependency (`apps/web`) | `@tabler/icons-react`                                         | R10 |
| Schema field                | `monitored-sources.displayCategory` (select, optional)        | R3  |
| Schema field                | `publications.monitoredSource` (relationship, optional)       | R3  |
| Schema field                | `publications.feedPublishedAt` (date, system-managed)         | R2  |
| Schema field                | `content-translations.title` (text)                           | R5  |
| One-time script             | Backfill `feedPublishedAt` for already-published publications | R2  |
| Worker code change          | Thread `source.id` into both `createPublication` calls        | R3  |
| Worker code change          | Extend translation step to translate `title` in the same call | R5  |
| New route                   | `GET /api/public/projects/:slug/materials?locale=`            | R1  |
| Removed route               | `GET /api/public/projects/:slug/digests`                      | R1  |
| Removed component           | `ImportanceFilter.tsx`                                        | R1  |
| New file                    | `[locale]/projects/[slug]/error.tsx`                          | R8  |
| Provider change             | `defaultColorScheme="auto"` + `ColorSchemeScript`             | R9  |

No new infrastructure, no new paid service, no change to the worker/web service boundary (the
worker still only talks to Payload over its existing REST API) — all changes are additive fields
on collections that already exist, consistent with Principle III (Free-Tier-First) and Principle
VII (Domain Boundaries Are Service Boundaries).
