# Specification Quality Checklist: Research Materials Feed

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-08-30
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic (no implementation details)
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification

## Notes

**Status: all checklist items pass. Spec is ready for `/speckit-plan`.**

### Iteration 1 — findings

The Mantine component suggestions in the source request were deliberately kept out of the spec
(they are planning-level detail) and belong in `/speckit-plan`.

Two open questions were raised, both scope-level and both carrying constitutional weight:

1. **Source taxonomy.** The request names five source categories; the platform tracks three, and
   Principle II ("Ruthless Scope Discipline") explicitly caps the first release at three source
   types.
2. **Route identity.** A digest-grouped feed already exists at `/[locale]/projects/[slug]`.

All other gaps were closed with documented defaults rather than clarification markers:
four-level internal importance collapsing to two display levels, English-canonical titles
degrading through the existing fallback rule, dark-scheme readiness without shipping a scheme
toggle, and session-transient filter state.

### Iteration 2 — resolutions

1. **Source taxonomy → derive.** All five badges ship, but news, guideline, and social are
   derived at the presentation layer rather than as new ingestion sources. No constitutional
   amendment needed. Captured in FR-010 through FR-018 and the "Source category derivation"
   assumption.
2. **Route identity → replace.** The flat material feed replaces the digest-grouped view at
   `/[locale]/projects/[slug]`. The HHT slug stays `hht-research`. Captured in the "Route and
   page identity" assumption and Out of Scope.

### Iteration 3 — `/speckit-clarify` session 2026-08-30

Five questions asked and answered; all integrated. Checkbox states unchanged at 16/16 — the
session closed genuine gaps rather than fixing failures, and no item regressed.

1. **Publication eligibility.** Only material carried by a published digest is publicly visible.
   Digests lose their visual role but keep their gatekeeping one, so this feature does not widen
   public exposure. FR-002, FR-003, SC-014.
2. **Source sub-classification.** The owner tags each configured source once; materials inherit
   the badge. This supersedes the earlier "derivable from data already held" wording and adds the
   only two data-layer changes in the feature: a display category on the source and a
   material-to-source link. FR-012 through FR-015, SC-010.
3. **Loading and failure states.** Server-rendered, so no loading state; load failure is a third
   distinct state with a retry, never shown as an empty project. FR-032 through FR-034, SC-011.
4. **Terminology.** "Material" is reader-facing in all five locales, "publication" stays
   internal. Recorded in a new Glossary section and FR-042.
5. **Untitled material.** Rendered with a source-and-date placeholder rather than omitted, which
   keeps the 100%-reachability promise in SC-013 honest. FR-039.

Requirement IDs were renumbered to stay sequential after these insertions; the spec now carries
FR-001 through FR-051 and SC-001 through SC-014.

### Carried into planning

- Updating the existing end-to-end coverage of the digest-grouped project page, since this is a
  replacement rather than an addition.
- Deciding whether filter state is reflected in the address bar for shareable links.
- Backfilling the material-to-source link for material already collected, and choosing a display
  category for each existing configured source.
- SC-002 and SC-003 are worded as usability checks with participants. On a solo-maintained
  project these may need a lighter validation method agreed during planning.
