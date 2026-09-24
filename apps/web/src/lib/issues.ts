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

const META_TITLE: Record<Locale, string> = {
  en: '{projectName}: update of {date}',
  de: '{projectName}: Update vom {date}',
  tr: '{projectName}: {date} güncellemesi',
  ru: '{projectName}: обновление от {date}',
  uk: '{projectName}: оновлення від {date}',
};

const META_DESCRIPTION_FALLBACK: Record<Locale, string> = {
  en: '{count} new materials for {projectName}.',
  de: '{count} neue Materialien für {projectName}.',
  tr: '{projectName} için {count} yeni materyal.',
  ru: '{count} новых материалов для {projectName}.',
  uk: '{count} нових матеріалів для {projectName}.',
};

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

function applyTemplate(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ''));
}

export function buildIssueMetaTitle(projectName: string, date: string, locale: Locale): string {
  return applyTemplate(META_TITLE[locale], {
    projectName,
    date: formatIssueDate(date, locale),
  });
}

export function buildIssueMetaDescription(input: {
  locale: Locale;
  projectName: string;
  itemCount: number;
  firstSummaryPoint: string | null;
}): string {
  if (input.firstSummaryPoint) {
    return truncateDescription(input.firstSummaryPoint);
  }
  return applyTemplate(META_DESCRIPTION_FALLBACK[input.locale], {
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
      title: buildIssueMetaTitle(loaded.project.name, loaded.digest.publishedAt, locale),
      description: buildIssueMetaDescription({
        locale,
        projectName: loaded.project.name,
        itemCount: items.length,
        firstSummaryPoint,
      }),
    },
  };
}
