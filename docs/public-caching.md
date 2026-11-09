# Public read caching

Anonymous reads must not wake the Neon compute on every visit. Two layers, both in
`apps/web/src/lib/publicCache.ts`:

1. **Next data cache** (`unstable_cache`, tag `public-content`): the query result is reused for up
   to 1 hour, so a CDN miss does not reach Postgres. Non-English issue lists use 5 minutes because
   issue translations are written without a content hook.
2. **CDN**: `Cache-Control: public, s-maxage=300, stale-while-revalidate=300`.

| Route                                       | Data cache      | CDN                                    |
| ------------------------------------------- | --------------- | -------------------------------------- |
| `GET /api/public/projects`                  | 1 h             | 5 min                                  |
| `GET /api/public/projects/:slug`            | 1 h             | 5 min                                  |
| `GET /api/public/projects/:slug/materials`  | 1 h             | 5 min                                  |
| `GET /api/public/projects/:slug/issues`     | 1 h (en), 5 min | 5 min                                  |
| `GET /api/public/projects/:slug/issues/:id` | none (writes)   | 5 min if translation settled, else off |

Errors and 404s are `no-store`. Not cached: subscribe/confirm/unsubscribe, `/r/*` click redirects,
admin and Payload APIs, and the page HTML (the issue page counts a page view per visit and reads
`?src=` / `?notice=`). Pages fetch these APIs, so they get the cached data.

## Invalidation

`revalidatePublicContent()` runs from `afterChange` / `afterDelete` of Digests, Publications,
ResearchProjects and ContentTranslations. A worker publishing a digest (`POST /api/digests`)
therefore drops the data cache as soon as the request finishes (after commit). The CDN copy is not
purged: it expires within `s-maxage` (5 min), plus one stale-while-revalidate refresh. Worst case a
new digest is visible about 5 minutes after publication.

Add any new anonymous read route to this table; never apply these helpers to personalised,
authenticated or subscription routes.
