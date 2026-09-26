import { buildChatPosts, EMAIL_COPY } from '@hht/shared';
import { NextResponse } from 'next/server';

import { requireAdmin } from '../../../projects/[id]/subscriber-counts/route';
import { relationId } from '@/lib/issueTypes';
import { getPublicSiteUrl } from '@/lib/siteUrl';

type Params = { params: Promise<{ id: string }> };

/** Local shapes so both typecheck passes accept `payload.find()` docs. */
type DigestPublicationRef = {
  title?: string | null;
  sourceType?: string | null;
  publishedOrUpdatedAt?: string | null;
};

type SummaryPointRef = { text: string };

type ItemSentenceRef = {
  publication?: unknown;
  sentence: string;
};

type IssueTranslationRef = {
  summaryPoints?: SummaryPointRef[] | null;
  itemSentences?: Array<{ sentence: string }> | null;
};

export async function GET(req: Request, { params }: Params) {
  const payload = await requireAdmin(req);
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const digest = await payload.findByID({
    collection: 'digests',
    id,
    depth: 1,
    overrideAccess: true,
  });
  const project = digest.project;
  const projectName =
    project && typeof project === 'object'
      ? project.emailFromName?.trim() || project.name
      : 'Project';
  const slug = project && typeof project === 'object' ? project.slug : '';
  const publicationRefs = (digest.publications ?? []) as Array<number | DigestPublicationRef>;
  const publications = new Map(
    publicationRefs.map((item) => {
      const doc = typeof item === 'object' ? item : null;
      return [String(relationId(item)), doc] as const;
    }),
  );
  const itemSentences = (digest.issueItemSentences ?? []) as ItemSentenceRef[];
  const items = itemSentences.map((row) => {
    const publication = publications.get(String(relationId(row.publication)));
    return {
      title: publication?.title?.trim() || 'Untitled',
      source: publication?.sourceType ?? 'Source',
      date: publication?.publishedOrUpdatedAt ?? null,
      sentence: row.sentence,
      isTrial: publication?.sourceType === 'clinicaltrials',
    };
  });
  const summaryPoints = (digest.issueSummaryPoints ?? []) as SummaryPointRef[];
  const english = {
    summaryPoints: summaryPoints.flatMap((point) => (point.text ? [point.text] : [])),
    items,
  };
  const translation = await payload.find({
    collection: 'issue-translations',
    where: {
      and: [
        { digest: { equals: id } },
        { locale: { equals: 'ru' } },
        { status: { equals: 'ready' } },
      ],
    },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  });
  const russianRow = translation.docs[0] as IssueTranslationRef | undefined;
  const russian = russianRow
    ? {
        summaryPoints: (russianRow.summaryPoints ?? []).map((point) => point.text),
        items: items.map((item, index) => ({
          ...item,
          sentence: russianRow.itemSentences?.[index]?.sentence ?? item.sentence,
        })),
      }
    : english;
  const site = getPublicSiteUrl();
  const posts = buildChatPosts({
    projectName,
    issueDate: digest.publishedAt,
    english,
    russian,
    issueUrl: (src) => `${site}/en/projects/${slug}/issues/${digest.id}?src=${src}`,
    subscribeUrl: (src) => `${site}/en/projects/${slug}?src=${src}#subscribe`,
  });
  return NextResponse.json({
    posts,
    disclaimer: { en: EMAIL_COPY.en.disclaimer, ru: EMAIL_COPY.ru.disclaimer },
  });
}
