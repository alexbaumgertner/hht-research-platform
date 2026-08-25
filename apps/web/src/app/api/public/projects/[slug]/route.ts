import { getPayload } from 'payload';
import config from '@payload-config';
import { NextResponse } from 'next/server';

type Params = { params: Promise<{ slug: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { slug } = await params;
  const payload = await getPayload({ config });

  const result = await payload.find({
    collection: 'research-projects',
    where: { slug: { equals: slug } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  });

  const project = result.docs[0];
  if (!project) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json({
    id: String(project.id),
    slug: project.slug,
    name: project.name,
    description: project.description ?? null,
  });
}
