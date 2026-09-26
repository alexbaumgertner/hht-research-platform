import { NextResponse } from 'next/server';
import { getPayload } from 'payload';
import config from '@payload-config';

import { isEmailStubEnabled } from '@/lib/email';

export async function GET(req: Request) {
  if (!isEmailStubEnabled()) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  const slug = new URL(req.url).searchParams.get('slug');
  if (!slug) return NextResponse.json({ error: 'Missing slug' }, { status: 400 });
  const payload = await getPayload({ config });
  const projects = await payload.find({
    collection: 'research-projects',
    where: { slug: { equals: slug } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  });
  const project = projects.docs[0];
  if (!project) return NextResponse.json({ docs: [] });
  const subscribers = await payload.find({
    collection: 'subscribers',
    where: { project: { equals: project.id } },
    limit: 100,
    depth: 0,
    overrideAccess: true,
  });
  return NextResponse.json({
    docs: subscribers.docs.map((row) => ({
      email: row.email,
      language: row.language,
      source: row.source,
      status: row.status,
    })),
  });
}
