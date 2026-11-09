import { revalidateTag, unstable_cache } from 'next/cache';
import { after } from 'next/server';

/**
 * Caching for anonymous public read endpoints, so visitors do not wake Neon.
 *
 * Two layers: the Next data cache holds the query result for up to an hour and is
 * dropped on demand when content changes (`revalidatePublicContent`); the CDN holds the
 * response for a few minutes, which also caps how stale a visitor can see content after
 * a publish. Never use these for authenticated, personalised or subscription routes.
 */
export const PUBLIC_CONTENT_TAG = 'public-content';

const CDN_S_MAXAGE_SECONDS = 300;
const CDN_STALE_WHILE_REVALIDATE_SECONDS = 300;

export const PUBLIC_CACHE_CONTROL = `public, s-maxage=${CDN_S_MAXAGE_SECONDS}, stale-while-revalidate=${CDN_STALE_WHILE_REVALIDATE_SECONDS}`;

export const PUBLIC_CACHE_HEADERS = { 'Cache-Control': PUBLIC_CACHE_CONTROL };
export const NO_STORE_HEADERS = { 'Cache-Control': 'no-store' };

const DATA_CACHE_REVALIDATE_SECONDS = 3600;

/** Cache a JSON-serialisable loader in the data cache, tagged for on-demand invalidation. */
export function cachePublicRead<Args extends unknown[], Result>(
  keyPart: string,
  loader: (...args: Args) => Promise<Result>,
  revalidate: number = DATA_CACHE_REVALIDATE_SECONDS,
): (...args: Args) => Promise<Result> {
  return unstable_cache(loader, ['public-read', keyPart], {
    tags: [PUBLIC_CONTENT_TAG],
    revalidate,
  });
}

/**
 * Drop cached public reads once the current request finishes. Called from collection
 * hooks, which run before the write transaction commits: dropping the cache earlier would
 * let a concurrent read re-cache the old rows. Hooks also run outside a Next request
 * (seed scripts, tests, local API), where there is no cache to drop.
 */
export function revalidatePublicContent(): void {
  try {
    after(() => revalidateTag(PUBLIC_CONTENT_TAG, { expire: 0 }));
  } catch {
    // No Next request context.
  }
}
