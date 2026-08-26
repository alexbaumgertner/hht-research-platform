import { z } from 'zod';

export const LocaleSchema = z.enum(['en', 'de', 'tr', 'ru', 'uk']);
export type Locale = z.infer<typeof LocaleSchema>;

export const PUBLIC_LOCALES = LocaleSchema.options;
export const CONTENT_TRANSLATION_LOCALES = ['de', 'tr', 'ru', 'uk'] as const;
export type ContentTranslationLocale = (typeof CONTENT_TRANSLATION_LOCALES)[number];

export const ScheduleSchema = z.enum(['daily', 'weekly', 'monthly']);
export type Schedule = z.infer<typeof ScheduleSchema>;

export const MonitoringStatusSchema = z.enum(['active', 'paused']);
export type MonitoringStatus = z.infer<typeof MonitoringStatusSchema>;

export const SourceTypeSchema = z.enum(['pubmed', 'clinicaltrials', 'rss']);
export type SourceType = z.infer<typeof SourceTypeSchema>;

export const ImportanceSchema = z.enum(['critical', 'high', 'medium', 'low']);
export type Importance = z.infer<typeof ImportanceSchema>;

export const RelevanceSchema = z.enum(['pending', 'relevant', 'irrelevant']);
export type Relevance = z.infer<typeof RelevanceSchema>;

export const RunStatusSchema = z.enum([
  'running',
  'completed',
  'completed_partial_failure',
  'failed',
]);
export type RunStatus = z.infer<typeof RunStatusSchema>;

export const SummarySchema = z.object({
  objective: z.string(),
  methods: z.string(),
  results: z.string(),
  limitations: z.string(),
  whyItMatters: z.string(),
});
export type Summary = z.infer<typeof SummarySchema>;

export const DEFAULT_BOOTSTRAP_LOOKBACK_DAYS = 30;
export const DEFAULT_BATCH_SIZE_PER_SOURCE = 50;

export function filterByImportance<T extends { importance?: Importance | null }>(
  items: T[],
  importance: Importance | undefined,
): T[] {
  if (!importance) return items;
  return items.filter((item) => item.importance === importance);
}

/** Payload array rows are `{ value }`; APIs/tests may also pass plain strings. */
export type KeywordInput = string | { value?: string | null } | null | undefined;

export function keywordText(keyword: KeywordInput): string {
  if (typeof keyword === 'string') return keyword.trim();
  if (keyword && typeof keyword === 'object' && typeof keyword.value === 'string') {
    return keyword.value.trim();
  }
  return '';
}

export function hasNonEmptyKeywords(keywords: KeywordInput[] | null | undefined): boolean {
  return Boolean(keywords?.some((k) => keywordText(k).length > 0));
}

export function isValidHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export * from './dedupe.js';
export * from './schedule.js';
