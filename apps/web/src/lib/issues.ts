import type { Locale } from '@hht/shared';

import type { IssueText } from '@/lib/issueTranslator';
import {
  sentenceByPublicationId,
  visibleSummaryPointItemIds,
  type IssueDigestDoc,
  type IssuePublicationDoc,
  type LoadedIssue,
} from '@/lib/issueTypes';
import { toMaterial, type DisplayImportance, type MaterialSourceOrFallback } from '@/lib/materials';

export type IssueTranslationStatus = 'not-needed' | 'ready' | 'pending' | 'failed' | 'unavailable';

/** What the translation layer resolved for this response; `text` only when `ready`. */
export type IssueTextTranslation =
  { status: 'ready'; text: IssueText } | { status: Exclude<IssueTranslationStatus, 'ready'> };

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

function visiblePublicationIds(publications: IssuePublicationDoc[]): Set<string> {
  return new Set(publications.map((publication) => String(publication.id)));
}

/**
 * The English issue text a translation is made from: summary points in display
 * order (translations are positional) and the visible items' sentences.
 */
export function issueTranslationSource(loaded: LoadedIssue): IssueText {
  const visibleIds = visiblePublicationIds(loaded.publications);
  const sentences = sentenceByPublicationId(loaded.digest);
  return {
    summaryPoints: visibleSummaryPointItemIds(loaded.digest, visibleIds).map((point) => point.text),
    itemSentences: loaded.publications.flatMap((publication) => {
      const sentence = sentences.get(String(publication.id));
      return sentence ? [{ publicationId: String(publication.id), sentence }] : [];
    }),
  };
}

export function hasIssueText(text: IssueText): boolean {
  return text.summaryPoints.length > 0 || text.itemSentences.length > 0;
}

function buildIssueItems(
  loaded: LoadedIssue,
  locale: Locale,
  translated: IssueText | null,
): IssueDetailItem[] {
  const sentences = translated
    ? new Map(translated.itemSentences.map((row) => [row.publicationId, row.sentence]))
    : sentenceByPublicationId(loaded.digest);

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

function summaryPoints(
  digest: IssueDigestDoc,
  visibleIds: Set<string>,
  translated: IssueText | null,
): IssueDetail['summary'] {
  const points = visibleSummaryPointItemIds(digest, visibleIds).map((point, index) => ({
    text: translated?.summaryPoints[index] ?? point.text,
    itemIds: point.itemIds,
  }));
  return points.length > 0 ? { points } : null;
}

/**
 * `translatedExcerpt` comes only from an existing `ready` translation at the
 * current revision; listings never start one.
 */
export function toIssueSummaryListItem(
  digest: IssueDigestDoc,
  publications: IssuePublicationDoc[],
  locale: Locale,
  translatedExcerpt: string | null = null,
): IssueSummaryListItem {
  const visibleIds = visiblePublicationIds(publications);
  const firstPoint = visibleSummaryPointItemIds(digest, visibleIds)[0]?.text ?? null;
  const excerpt = locale !== 'en' && firstPoint ? (translatedExcerpt ?? firstPoint) : firstPoint;
  const isFallback = locale !== 'en' && firstPoint != null && translatedExcerpt == null;

  return {
    id: String(digest.id),
    date: digest.publishedAt,
    itemCount: publications.length,
    excerpt,
    displayedLocale: isFallback ? 'en' : locale,
    isFallback,
  };
}

export function toIssueDetail(
  loaded: LoadedIssue,
  locale: Locale,
  t: IssueMetaTranslator,
  translation: IssueTextTranslation = { status: 'not-needed' },
): IssueDetail {
  const visibleIds = visiblePublicationIds(loaded.publications);
  const translated = locale !== 'en' && translation.status === 'ready' ? translation.text : null;
  const summary = summaryPoints(loaded.digest, visibleIds, translated);
  const items = buildIssueItems(loaded, locale, translated);
  const firstSummaryPoint = summary?.points[0]?.text ?? null;
  const isFallback = locale !== 'en' && !translated && hasIssueText(issueTranslationSource(loaded));

  return {
    id: String(loaded.digest.id),
    date: loaded.digest.publishedAt,
    project: {
      slug: loaded.project.slug,
      name: loaded.project.name,
    },
    summary,
    items,
    displayedLocale: isFallback ? 'en' : locale,
    isFallback,
    translation: { status: translation.status },
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
