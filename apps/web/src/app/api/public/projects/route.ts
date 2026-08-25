import { getPayload } from 'payload';
import config from '@payload-config';
import { NextResponse } from 'next/server';

export async function GET() {
  const payload = await getPayload({ config });

  const result = await payload.find({
    collection: 'research-projects',
    where: {
      hasPublishedDigest: { equals: true },
    },
    sort: '-updatedAt',
    depth: 0,
    limit: 100,
    overrideAccess: true,
  });

  const docs = await Promise.all(
    result.docs.map(async (project) => {
      const digests = await payload.find({
        collection: 'digests',
        where: { project: { equals: project.id } },
        sort: '-publishedAt',
        limit: 1,
        depth: 0,
        overrideAccess: true,
      });
      const latest = digests.docs[0];
      return {
        id: String(project.id),
        slug: project.slug,
        name: project.name,
        description: project.description ?? null,
        latestDigestPublishedAt: latest?.publishedAt ?? null,
      };
    }),
  );

  return NextResponse.json({ docs });
}
