import type { Importance, Locale, Summary } from '@hht/shared';
import { sanitizeHttpUrl } from '@hht/shared';

/** Reader-facing source categories (five filterable + defensive fallback). */
export type MaterialSource = 'pubmed' | 'trials' | 'news' | 'guideline' | 'social';
export type MaterialSourceOrFallback = MaterialSource | 'unknown';

export type DisplayImportance = 'normal' | 'high';
export type DisplayCategory = 'news' | 'guideline' | 'social';

export type Material = {
  id: string;
  source: MaterialSourceOrFallback;
  importance: DisplayImportance;
  date: string | null;
  url: string | null;
  title: string;
  summary: string | null;
  displayedLocale: Locale;
  isFallback: boolean;
};

/** Ordered chip set for the source filter (FR-025). */
export const MATERIAL_SOURCES: readonly MaterialSource[] = [
  'pubmed',
  'trials',
  'news',
  'guideline',
  'social',
] as const;

/** R3 badge resolution — ingestion sourceType → display source. */
export const SOURCE_TYPE_TO_MATERIAL: Record<string, MaterialSource> = {
  pubmed: 'pubmed',
  clinicaltrials: 'trials',
};

export type PublicationForMaterial = {
  id: string | number;
  title?: string | null;
  sourceType?: string | null;
  importance?: Importance | null;
  publishedOrUpdatedAt?: string | null;
  originalUrl?: string | null;
  summary?: Partial<Summary> | null;
  monitoredSource?:
    | {
        id?: string | number;
        displayCategory?: DisplayCategory | null;
        type?: string | null;
      }
    | string
    | number
    | null;
};

export type TranslationForMaterial = {
  title?: string | null;
  fields?: Partial<Summary> | null;
};

/**
 * R3: resolve display source from sourceType + optional RSS displayCategory.
 * Unrecognised sourceType → neutral fallback (`unknown`).
 * Empty/missing RSS category → `news`.
 */
export function resolveSource(
  sourceType: string | null | undefined,
  displayCategory?: DisplayCategory | null,
): MaterialSourceOrFallback {
  if (sourceType === 'pubmed') return 'pubmed';
  if (sourceType === 'clinicaltrials') return 'trials';
  if (sourceType === 'rss') {
    if (displayCategory === 'guideline' || displayCategory === 'social') {
      return displayCategory;
    }
    return 'news';
  }
  return 'unknown';
}

/** Collapse four internal importance levels to two display levels. */
export function collapseImportance(importance: Importance | null | undefined): DisplayImportance {
  if (importance === 'critical' || importance === 'high') return 'high';
  return 'normal';
}

function summaryPreview(summary: Partial<Summary> | null | undefined): string | null {
  const objective = summary?.objective?.trim();
  return objective || null;
}

function hasCompleteSummary(fields: Partial<Summary> | null | undefined): boolean {
  return Boolean(
    fields?.objective &&
    fields.methods &&
    fields.results &&
    fields.limitations &&
    fields.whyItMatters,
  );
}

export type LocalizedContent = {
  title: string;
  summary: string | null;
  displayedLocale: Locale;
  isFallback: boolean;
};

/**
 * R5 locale resolution for title + summary.
 * Partial miss → English with isFallback.
 */
export function resolveLocalizedContent(input: {
  locale: Locale;
  englishTitle: string;
  englishSummary: Partial<Summary> | null | undefined;
  translation?: TranslationForMaterial | null;
}): LocalizedContent {
  const { locale, englishTitle, englishSummary, translation } = input;
  const englishPreview = summaryPreview(englishSummary);

  if (locale === 'en') {
    return {
      title: englishTitle,
      summary: englishPreview,
      displayedLocale: 'en',
      isFallback: false,
    };
  }

  const translatedTitle = translation?.title?.trim();
  const translatedFields = translation?.fields;
  if (translatedTitle && hasCompleteSummary(translatedFields)) {
    return {
      title: translatedTitle,
      summary: summaryPreview(translatedFields),
      displayedLocale: locale,
      isFallback: false,
    };
  }

  return {
    title: englishTitle,
    summary: englishPreview,
    displayedLocale: 'en',
    isFallback: true,
  };
}

/** FR-039: placeholder from source + date when title is empty. */
export function placeholderTitle(source: MaterialSourceOrFallback, date: string | null): string {
  const datePart = date ? new Date(date).toISOString().slice(0, 10) : 'undated';
  return `${source} · ${datePart}`;
}

function extractDisplayCategory(
  monitoredSource: PublicationForMaterial['monitoredSource'],
): DisplayCategory | null {
  if (!monitoredSource || typeof monitoredSource !== 'object') return null;
  const cat = monitoredSource.displayCategory;
  if (cat === 'news' || cat === 'guideline' || cat === 'social') return cat;
  return null;
}

/** Single boundary: internal publication → reader-facing Material (R11). */
export function toMaterial(
  publication: PublicationForMaterial,
  locale: Locale,
  translation?: TranslationForMaterial | null,
): Material {
  const source = resolveSource(
    publication.sourceType,
    extractDisplayCategory(publication.monitoredSource),
  );
  const importance = collapseImportance(publication.importance);
  const date = publication.publishedOrUpdatedAt ?? null;
  const url = sanitizeHttpUrl(publication.originalUrl);

  const localized = resolveLocalizedContent({
    locale,
    englishTitle: publication.title?.trim() || '',
    englishSummary: publication.summary,
    translation,
  });

  const title = localized.title.trim() || placeholderTitle(source, date);

  return {
    id: String(publication.id),
    source,
    importance,
    date,
    url,
    title,
    summary: localized.summary,
    displayedLocale: localized.displayedLocale,
    isFallback: localized.isFallback,
  };
}

export type MaterialsEmptyState = 'empty-project' | 'no-matches' | null;

export type MaterialFilterState = {
  q: string;
  sources: MaterialSource[];
  important: boolean;
};

/**
 * Client-side filter: search ∧ sources ∧ importance.
 * Empty source list = all categories (FR-025).
 */
export function filterMaterials(
  materials: Material[],
  { q, sources, important }: MaterialFilterState,
): Material[] {
  const query = q.trim().toLowerCase();
  const sourceSet = sources.length > 0 ? new Set(sources) : null;

  return materials.filter((m) => {
    if (important && m.importance !== 'high') return false;
    if (sourceSet && !sourceSet.has(m.source as MaterialSource)) {
      // Unknown/fallback sources stay visible only when "all" (empty selection)
      return false;
    }
    if (!query) return true;
    const haystack = `${m.title}\n${m.summary ?? ''}`.toLowerCase();
    return haystack.includes(query);
  });
}

/** Distinguish empty project from over-filtered list (FR-030 / FR-031). */
export function resolveEmptyState(totalCount: number, filteredCount: number): MaterialsEmptyState {
  if (totalCount === 0) return 'empty-project';
  if (filteredCount === 0) return 'no-matches';
  return null;
}

/** Sort newest-first; null dates last (stable among nulls). */
export function sortMaterialsByDateDesc(materials: Material[]): Material[] {
  return [...materials].sort((a, b) => {
    if (a.date === null && b.date === null) return 0;
    if (a.date === null) return 1;
    if (b.date === null) return -1;
    return b.date.localeCompare(a.date);
  });
}
