import type { Locale } from '@hht/shared';

import {
  sentenceByPublicationId,
  visibleSummaryPointItemIds,
  type IssueDigestDoc,
  type IssuePublicationDoc,
  type LoadedIssue,
} from '@/lib/issueTypes';
import { toMaterial, type DisplayImportance, type MaterialSourceOrFallback } from '@/lib/materials';

export type IssueTranslationStatus = 'not-needed' | 'ready' | 'pending' | 'failed' | 'unavailable';

export type IssueSummaryListItem = {
  id: string;
  date: string;
  itemCount: number;
  excerpt: string | null;
  displayedLocale: Locale;
  isFallback: boolean;
};

export type IssueDetailItem = {
  id: string;
  title: string;
  source: MaterialSourceOrFallback;
  importance: DisplayImportance;
  date: string | null;
  isTrialRegistration: boolean;
  sentence: string | null;
};

export type IssueDetail = {
  id: string;
  date: string;
  project: { slug: string; name: string };
  summary: { points: Array<{ text: string; itemIds: string[] }> } | null;
  items: IssueDetailItem[];
  displayedLocale: Locale;
  isFallback: boolean;
  translation: { status: IssueTranslationStatus };
  meta: { title: string; description: string };
};

/** The `Issue` namespace translator (next-intl), bound to the response locale. */
export type IssueMetaTranslator = (
  key: 'metaTitle' | 'metaDescriptionFallback',
  values: Record<string, string | number>,
) => string;

export function formatIssueDate(date: string, locale: Locale): string {
  return new Date(date).toLocaleDateString(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function truncateDescription(text: string, maxLen = 160): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxLen) return trimmed;

  const slice = trimmed.slice(0, maxLen + 1);
  const lastSpace = slice.lastIndexOf(' ');
  if (lastSpace > 0) {
    return slice.slice(0, lastSpace).trimEnd();
  }
  return trimmed.slice(0, maxLen).trimEnd();
}

export function buildIssueMetaTitle(input: {
  t: IssueMetaTranslator;
  locale: Locale;
  projectName: string;
  date: string;
}): string {
  return input.t('metaTitle', {
    projectName: input.projectName,
    date: formatIssueDate(input.date, input.locale),
  });
}

export function buildIssueMetaDescription(input: {
  t: IssueMetaTranslator;
  projectName: string;
  itemCount: number;
  firstSummaryPoint: string | null;
}): string {
  if (input.firstSummaryPoint) {
    return truncateDescription(input.firstSummaryPoint);
  }
  return input.t('metaDescriptionFallback', {
    count: input.itemCount,
    projectName: input.projectName,
  });
}

function buildIssueItems(loaded: LoadedIssue, locale: Locale): IssueDetailItem[] {
  const sentences = sentenceByPublicationId(loaded.digest);

  return loaded.publications.map((publication) => {
    const material = toMaterial(
      publication,
      locale,
      loaded.translationByPubId.get(String(publication.id)) ?? null,
    );

    return {
      id: material.id,
      title: material.title,
      source: material.source,
      importance: material.importance,
      date: material.date,
      isTrialRegistration: publication.sourceType === 'clinicaltrials',
      sentence: sentences.get(String(publication.id)) ?? null,
    };
  });
}

function englishSummaryPoints(digest: IssueDigestDoc, visibleIds: Set<string>) {
  const points = visibleSummaryPointItemIds(digest, visibleIds);
  return points.length > 0 ? { points } : null;
}

export function toIssueSummaryListItem(
  digest: IssueDigestDoc,
  publications: IssuePublicationDoc[],
  locale: Locale,
): IssueSummaryListItem {
  const visibleIds = new Set(publications.map((publication) => String(publication.id)));
  const firstPoint = visibleSummaryPointItemIds(digest, visibleIds)[0]?.text ?? null;

  return {
    id: String(digest.id),
    date: digest.publishedAt,
    itemCount: publications.length,
    excerpt: firstPoint,
    displayedLocale: locale === 'en' || !firstPoint ? 'en' : 'en',
    isFallback: locale !== 'en' && Boolean(firstPoint),
  };
}

export function toIssueDetail(
  loaded: LoadedIssue,
  locale: Locale,
  t: IssueMetaTranslator,
  translationStatus: IssueTranslationStatus = 'not-needed',
): IssueDetail {
  const visibleIds = new Set(loaded.publications.map((publication) => String(publication.id)));
  const summary = englishSummaryPoints(loaded.digest, visibleIds);
  const items = buildIssueItems(loaded, locale);
  const firstSummaryPoint = summary?.points[0]?.text ?? null;

  return {
    id: String(loaded.digest.id),
    date: loaded.digest.publishedAt,
    project: {
      slug: loaded.project.slug,
      name: loaded.project.name,
    },
    summary,
    items,
    displayedLocale: 'en',
    isFallback: locale !== 'en',
    translation: { status: translationStatus },
    meta: {
      title: buildIssueMetaTitle({
        t,
        locale,
        projectName: loaded.project.name,
        date: loaded.digest.publishedAt,
      }),
      description: buildIssueMetaDescription({
        t,
        projectName: loaded.project.name,
        itemCount: items.length,
        firstSummaryPoint,
      }),
    },
  };
}
