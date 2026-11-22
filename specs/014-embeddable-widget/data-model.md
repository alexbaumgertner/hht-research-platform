# Data Model: Embeddable Widget

**Feature**: [`spec.md`](./spec.md) | **Research**: [`research.md`](./research.md)

Payload collections remain the schema source of truth. Run `generate:types` after the changes.
Never hand-edit `payload-types.ts`. Changes are additive except for the two `source` columns
(research R8).

## Changed: `research-projects`, new field `embedPartners`

An `array` field, placed in a new admin tab or collapsible group named "Embedding". Only admins
and the owner can write it, using the same access as the other project settings. The public API
never exposes it. The embed handler reads it with `overrideAccess`.

| Field                  | Type                               | Rules                                                                                                                                                                                                                         |
| ---------------------- | ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `name`                 | text, required                     | Shown to the owner in the admin and in the snippet comments. Max 80 chars.                                                                                                                                                    |
| `key`                  | text, required                     | `^[a-z0-9][a-z0-9-]{1,31}$`. Unique within the project (validated across rows in a `beforeValidate` hook). Used in the URL and in the source `site:<key>`. Changing it changes attribution for new subscriptions only.        |
| `origins`              | array of `{ origin: text }`, min 1 | Each is an exact origin `scheme://host[:port]`, lowercased, with no path, query, fragment or wildcard. `https:` is required, except `http:` for `localhost`, `127.0.0.1` and `*.test` (research R2). Duplicates are rejected. |
| `fallbackCommunityUrl` | text, optional                     | `https:` URL. Used only to prefill the fallback markup in the generated snippet (admin UI field below). The widget doesn't read it.                                                                                           |

**UI field `embedSnippets`** (type `ui`, read-only): for each saved partner, it shows the script
snippet and the plain-frame snippet in Russian and English, with copy buttons. It follows the
pattern of `IssuePostKit`. Strings for the snippets are built by
`packages/shared/src/embedSnippet.ts` so the docs and the admin can't drift.

**Hook**: `afterChange` → `revalidateTag('embed:project:<id>', { expire: 0 })`, which also
refreshes the cached CSP header (research R3).

**Validation helpers** (`packages/shared/src/embed.ts`): `PartnerKeySchema`,
`normalizeEmbedOrigin(value): string | null`, and `EmbedOptionsSchema` with
`parseEmbedOptions` / `formatEmbedOptions` (research R4).

## Changed: `subscribers.source`

| Before                                           | After                                                                                                                |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| `select` (enum): `vk`, `wa`, `fb`, `tg`, `other` | `text`, required, default `other`. `validate`: must match `^(vk\|wa\|fb\|tg\|other\|site:[a-z0-9][a-z0-9-]{1,31})$`. |

- The syntax check is in the collection. **Membership** (is `<key>` a partner of this subscriber's
  project) is enforced where the value enters the system, through
  `resolveSubscriptionSource(value, partnerKeys)`. Anything else becomes `other`.
- Nothing else is stored (spec FR-021, spec 006 FR-007).
- Admin list filter: free text. `subscriber-counts` already groups by the stored value, so
  `site:<key>` buckets appear without code changes. The display is improved to show the
  partner's `name` next to `site:<key>`.

## Changed: `analytics-counts`

| Field    | Change                                                                                                                                     |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `source` | `select` (enum) → `text`, same `validate` as `subscribers.source`. The unique index on `(project, issueKey, source, metric)` is unchanged. |
| `metric` | Add options `widget_view` and `outbound_click`. Adding values to an enum is additive.                                                      |

- `issueKey` for widget metrics is the id of the issue the widget showed, or `none` when no issue
  was shown.
- `AnalyticsMetric` in `apps/web/src/lib/analyticsCounts.ts` gains the two metrics.
  `incrementAnalyticsCount` takes an already-resolved source instead of calling `parseChatSource`
  itself. Callers resolve it with the project's partner keys.

## Migration of the existing data

Existing enum values are all valid under the new text rule, so no rows change. The column type
change follows research R8 (Neon branch first, the owner's go-ahead, SQL fallback).

## Derived, not stored: Widget View model

Built by `loadEmbedModel(projectSlug, partnerKey, locale, options)`. This is the `unstable_cache`
loader tagged `embed:project:<projectId>`.

| Field          | Source                                                                                                                                                                                                  |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `project`      | `{ id, slug, name }`, or `null`, in which case the response is 404 with `frame-ancestors 'none'`                                                                                                        |
| `partner`      | `{ key, name, origins }` from `embedPartners`, or `null`, in which case the response is 404 with `frame-ancestors 'none'`                                                                               |
| `issue`        | `listVisibleIssues(projectId, 1)[0]` → `IssueDetail` via the same `loadIssueSummary`, translation and fallback path as the issue API (spec 005 FR-012/013). `null` → the "first issue is coming" state. |
| `items`        | `issue.items.slice(0, options.items)`. `moreCount = issue.items.length - items.length`                                                                                                                  |
| `periodReview` | Always `null` in this feature (research R13)                                                                                                                                                            |
| `source`       | `site:<partner.key>`                                                                                                                                                                                    |
| `links`        | Built by `embedLinks()`: issue, archive, item pages, privacy and project subscribe. All absolute on `getPublicSiteUrl()`, all with `?src=site:<key>` except privacy                                     |

## State and events

No new stateful entity. Events and their effects:

| Event                                                 | Effect                                                                                                         |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `EmbedPartnersChanged`                                | Project saved → embed tag expired. New origins can frame, and removed origins are refused on the next request. |
| `IssuePublished` / `IssueHidden` / `IssueTextChanged` | `Digests.afterChange` → embed tag expired                                                                      |
| `IssueTranslationStored`                              | `issueTranslationStore` write → embed tag expired                                                              |
| `WidgetViewed`                                        | Beacon → `analytics-counts +1 (issue, site:<key>, widget_view)`                                                |
| `WidgetLinkClicked`                                   | Beacon → `analytics-counts +1 (issue, site:<key>, outbound_click)`                                             |
| `SubscriptionRequested`                               | As in spec 006, with `source = site:<key>` if valid for the project, otherwise `other`                         |
