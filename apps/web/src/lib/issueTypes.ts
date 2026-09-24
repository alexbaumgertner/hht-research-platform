import type { TranslationForMaterial, PublicationForMaterial } from '@/lib/materials';

export type IssueDigestDoc = {
  id: string | number;
  publishedAt: string;
  hiddenFromPublic?: boolean | null;
  issueTextStatus?: string | null;
  issueTextRevision?: number | null;
  issueSummaryPoints?: Array<{
    text?: string | null;
    items?: unknown;
  }> | null;
  issueItemSentences?: Array<{
    publication?: unknown;
    sentence?: string | null;
  }> | null;
  publications?: unknown;
};

export type IssueProjectDoc = {
  id: string | number;
  slug: string;
  name: string;
};

export type IssuePublicationDoc = PublicationForMaterial & {
  sourceType?: string | null;
  feedPublishedAt?: string | null;
};

export type LoadedIssue = {
  digest: IssueDigestDoc;
  project: IssueProjectDoc;
  publications: IssuePublicationDoc[];
  translationByPubId: Map<string, TranslationForMaterial>;
};

export function relationId(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === 'object' && 'id' in value) {
    return String((value as { id: string | number }).id);
  }
  return String(value);
}

export function relationIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => relationId(item)).filter((id): id is string => id != null);
}

export function sentenceByPublicationId(digest: IssueDigestDoc): Map<string, string> {
  const sentences = new Map<string, string>();
  for (const row of digest.issueItemSentences ?? []) {
    const pubId = relationId(row.publication);
    const sentence = row.sentence?.trim();
    if (pubId && sentence) sentences.set(pubId, sentence);
  }
  return sentences;
}

export function visibleSummaryPointItemIds(
  digest: IssueDigestDoc,
  visiblePublicationIds: Set<string>,
): Array<{ text: string; itemIds: string[] }> {
  const points: Array<{ text: string; itemIds: string[] }> = [];

  for (const point of digest.issueSummaryPoints ?? []) {
    const text = point.text?.trim();
    if (!text) continue;
    const itemIds = relationIds(point.items).filter((id) => visiblePublicationIds.has(id));
    points.push({ text, itemIds });
  }

  return points;
}
