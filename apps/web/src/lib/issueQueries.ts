import 'server-only';

import { getPayload } from 'payload';
import config from '@payload-config';
import { compareIssueItems, type Locale, type Summary } from '@hht/shared';

import {
  type IssueDigestDoc,
  type IssueProjectDoc,
  type IssuePublicationDoc,
  type LoadedIssue,
  relationId,
} from '@/lib/issueTypes';
import { type PublicationForMaterial, type TranslationForMaterial } from '@/lib/materials';

export type {
  IssueDigestDoc,
  IssueProjectDoc,
  IssuePublicationDoc,
  LoadedIssue,
} from '@/lib/issueTypes';

export async function findProjectBySlug(slug: string): Promise<IssueProjectDoc | null> {
  const payload = await getPayload({ config });
  const projects = await payload.find({
    collection: 'research-projects',
    where: { slug: { equals: slug } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  });
  const project = projects.docs[0];
  if (!project) return null;
  return {
    id: project.id,
    slug: String(project.slug),
    name: String(project.name),
  };
}

async function loadTranslations(
  pubIds: Array<string | number>,
  locale: Locale,
): Promise<Map<string, TranslationForMaterial>> {
  const translationByPubId = new Map<string, TranslationForMaterial>();
  if (locale === 'en' || pubIds.length === 0) return translationByPubId;

  const payload = await getPayload({ config });
  const translations = await payload.find({
    collection: 'content-translations',
    where: {
      and: [{ publication: { in: pubIds } }, { locale: { equals: locale } }],
    },
    limit: 200,
    depth: 0,
    overrideAccess: true,
  });

  for (const row of translations.docs) {
    const pubId = relationId(row.publication);
    if (!pubId) continue;
    translationByPubId.set(pubId, {
      title: row.title ?? null,
      fields: (row.fields as Summary | undefined) ?? null,
    });
  }

  return translationByPubId;
}

// `object`, not `Record<string, unknown>`: generated Payload interfaces (present on Vercel
// builds) have no index signature.
function mapPublicationDoc(source: object): IssuePublicationDoc {
  const doc = source as Record<string, unknown>;
  return {
    id: doc.id as string | number,
    title: doc.title as string | null | undefined,
    sourceType: doc.sourceType as string | null | undefined,
    importance: (doc.importance as IssuePublicationDoc['importance']) ?? null,
    publishedOrUpdatedAt: (doc.publishedOrUpdatedAt as string | null | undefined) ?? null,
    originalUrl: doc.originalUrl as string | null | undefined,
    summary: (doc.summary as Summary | null | undefined) ?? null,
    monitoredSource: doc.monitoredSource as PublicationForMaterial['monitoredSource'],
    feedPublishedAt: (doc.feedPublishedAt as string | null | undefined) ?? null,
  };
}

export function sortIssuePublications(publications: IssuePublicationDoc[]): IssuePublicationDoc[] {
  return [...publications].sort((a, b) =>
    compareIssueItems(
      {
        id: String(a.id),
        importance: a.importance ?? null,
        publishedOrUpdatedAt: a.publishedOrUpdatedAt ?? null,
      },
      {
        id: String(b.id),
        importance: b.importance ?? null,
        publishedOrUpdatedAt: b.publishedOrUpdatedAt ?? null,
      },
    ),
  );
}

async function loadVisiblePublications(publicationRefs: unknown): Promise<IssuePublicationDoc[]> {
  const ids = Array.isArray(publicationRefs)
    ? publicationRefs.map((item) => relationId(item)).filter((id): id is string => id != null)
    : [];
  if (ids.length === 0) return [];

  const payload = await getPayload({ config });
  const publications = await payload.find({
    collection: 'publications',
    where: {
      and: [{ id: { in: ids } }, { feedPublishedAt: { exists: true } }],
    },
    depth: 1,
    limit: ids.length,
    overrideAccess: true,
  });

  return sortIssuePublications(publications.docs.map((doc) => mapPublicationDoc(doc)));
}

function mapDigestDoc(source: object): IssueDigestDoc {
  const doc = source as Record<string, unknown>;
  return {
    id: doc.id as string | number,
    publishedAt: String(doc.publishedAt),
    hiddenFromPublic: (doc.hiddenFromPublic as boolean | null | undefined) ?? false,
    issueTextStatus: (doc.issueTextStatus as string | null | undefined) ?? null,
    issueTextRevision: (doc.issueTextRevision as number | null | undefined) ?? null,
    issueSummaryPoints: (doc.issueSummaryPoints as IssueDigestDoc['issueSummaryPoints']) ?? null,
    issueItemSentences: (doc.issueItemSentences as IssueDigestDoc['issueItemSentences']) ?? null,
    publications: doc.publications,
  };
}

export async function listVisibleIssues(
  projectId: string | number,
  limit: number,
): Promise<IssueDigestDoc[]> {
  const payload = await getPayload({ config });
  const digests = await payload.find({
    collection: 'digests',
    where: {
      and: [{ project: { equals: projectId } }, { hiddenFromPublic: { not_equals: true } }],
    },
    sort: '-publishedAt',
    limit,
    depth: 0,
    overrideAccess: true,
  });

  return digests.docs.map((doc) => mapDigestDoc(doc));
}

export async function getVisibleIssue(
  projectId: string | number,
  issueId: string,
): Promise<IssueDigestDoc | null> {
  const payload = await getPayload({ config });

  let digest;
  try {
    digest = await payload.findByID({
      collection: 'digests',
      id: issueId,
      depth: 0,
      overrideAccess: true,
    });
  } catch {
    return null;
  }

  const digestProjectId = relationId(digest.project);
  if (!digestProjectId || digestProjectId !== String(projectId)) return null;
  if (digest.hiddenFromPublic) return null;

  return mapDigestDoc(digest);
}

export async function loadIssueSummary(
  digest: IssueDigestDoc,
  project: IssueProjectDoc,
  locale: Locale,
): Promise<LoadedIssue> {
  const publications = await loadVisiblePublications(digest.publications);
  const translationByPubId = await loadTranslations(
    publications.map((publication) => publication.id),
    locale,
  );

  return {
    digest,
    project,
    publications,
    translationByPubId,
  };
}
