import type { Summary } from '@hht/shared';

export type TranslationLookup = {
  hit: boolean;
  fields: Summary | null;
};

export function cacheKey(publicationId: string, locale: string): string {
  return `${publicationId}:${locale}`;
}

/** Pure helper for Jest: whether a cached translation should be reused. */
export function shouldUseCachedTranslation(cached: Summary | null | undefined): boolean {
  return Boolean(
    cached?.objective &&
    cached.methods &&
    cached.results &&
    cached.limitations &&
    cached.whyItMatters,
  );
}
