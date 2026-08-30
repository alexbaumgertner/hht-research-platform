import { getPayload } from 'payload';
import config from '@payload-config';
import {
  ImportanceSchema,
  filterByImportance,
  sanitizeHttpUrl,
  type Importance,
} from '@hht/shared';
import { NextResponse } from 'next/server';

type Params = { params: Promise<{ slug: string }> };

type PubDoc = {
  id: string | number;
  title?: string | null;
  importance?: Importance | null;
  originalUrl?: string | null;
  summary?: { objective?: string | null } | null;
};

export async function GET(req: Request, { params }: Params) {
  const { slug } = await params;
  const url = new URL(req.url);
  const importanceParam = url.searchParams.get('importance') ?? undefined;
  const importanceParsed = importanceParam ? ImportanceSchema.safeParse(importanceParam) : null;
  if (importanceParam && importanceParsed && !importanceParsed.success) {
    return NextResponse.json({ error: 'Invalid importance' }, { status: 400 });
  }
  const importance = importanceParsed?.success ? importanceParsed.data : undefined;

  const payload = await getPayload({ config });

  const projects = await payload.find({
    collection: 'research-projects',
    where: { slug: { equals: slug } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  });
  const project = projects.docs[0];
  if (!project) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const digests = await payload.find({
    collection: 'digests',
    where: { project: { equals: project.id } },
    sort: '-publishedAt',
    depth: 2,
    limit: 50,
    overrideAccess: true,
  });

  const docs = digests.docs
    .map((digest) => {
      const rawPubs = (digest.publications || []) as PubDoc[];
      const publications = filterByImportance(
        rawPubs.map((p) => ({
          id: String(p.id),
          title: p.title ?? '',
          importance: p.importance ?? null,
          originalUrl: sanitizeHttpUrl(p.originalUrl) ?? '',
          summaryPreview: p.summary?.objective ?? null,
        })),
        importance,
      );

      return {
        id: String(digest.id),
        publishedAt: digest.publishedAt,
        publications,
      };
    })
    .filter((d) => (importance ? d.publications.length > 0 : true));

  return NextResponse.json({ docs });
}
