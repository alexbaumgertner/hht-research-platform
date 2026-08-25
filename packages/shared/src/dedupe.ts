import type { SourceType } from './index.js';

export type ExternalIds = {
  pmid?: string;
  doi?: string;
  nctId?: string;
  guid?: string;
};

/** Normalize title for fallback dedupe keys. */
export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function normalizeDoi(doi: string): string {
  return doi
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\/(dx\.)?doi\.org\//, '');
}

/**
 * Stable dedupe key per FR-006:
 * 1. DOI (normalized) if present
 * 2. else PMID / NCT ID / RSS GUID
 * 3. else normalize(title) + sourceType
 */
export function dedupeKey(externalIds: ExternalIds, title: string, sourceType: SourceType): string {
  if (externalIds.doi) {
    return `doi:${normalizeDoi(externalIds.doi)}`;
  }
  if (externalIds.pmid) {
    return `pmid:${externalIds.pmid.trim()}`;
  }
  if (externalIds.nctId) {
    return `nct:${externalIds.nctId.trim().toUpperCase()}`;
  }
  if (externalIds.guid) {
    return `guid:${externalIds.guid.trim()}`;
  }
  return `title:${sourceType}:${normalizeTitle(title)}`;
}
