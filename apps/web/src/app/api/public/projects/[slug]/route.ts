import { getPayload } from 'payload';
import config from '@payload-config';
import { NextResponse } from 'next/server';

import { cachePublicRead, NO_STORE_HEADERS, PUBLIC_CACHE_HEADERS } from '@/lib/publicCache';

type Params = { params: Promise<{ slug: string }> };

const loadProject = cachePublicRead('project', async (slug: string) => {
  const payload = await getPayload({ config });

  const result = await payload.find({
    collection: 'research-projects',
    where: { slug: { equals: slug } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  });

  const project = result.docs[0];
  if (!project) return null;

  return {
    id: String(project.id),
    slug: project.slug,
    name: project.name,
    description: project.description ?? null,
    lastSuccessfulRunAt: project.lastSuccessfulRunAt ?? null,
  };
});

export async function GET(_req: Request, { params }: Params) {
  const { slug } = await params;
  const project = await loadProject(slug);
  if (!project) {
    return NextResponse.json({ error: 'Not found' }, { status: 404, headers: NO_STORE_HEADERS });
  }
  return NextResponse.json(project, { headers: PUBLIC_CACHE_HEADERS });
}
