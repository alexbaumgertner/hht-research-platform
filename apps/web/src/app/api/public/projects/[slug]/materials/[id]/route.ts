import { getPayload } from 'payload';
import config from '@payload-config';
import { LocaleSchema, type Locale, type Summary } from '@hht/shared';
import { NextResponse } from 'next/server';

import {
  toMaterialDetail,
  type PublicationForMaterial,
  type TranslationForMaterial,
} from '@/lib/materials';

type Params = { params: Promise<{ slug: string; id: string }> };

function relationId(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === 'object' && 'id' in value) {
    return String((value as { id: string | number }).id);
  }
  return String(value);
}

export async function GET(req: Request, { params }: Params) {
  const { slug, id } = await params;
  const url = new URL(req.url);
  const localeRaw = url.searchParams.get('locale') || 'en';
  const localeParsed = LocaleSchema.safeParse(localeRaw);
  if (!localeParsed.success) {
    return NextResponse.json({ error: 'Invalid locale' }, { status: 400 });
  }
  const locale: Locale = localeParsed.data;

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

  let publication;
  try {
    publication = await payload.findByID({
      collection: 'publications',
      id,
      depth: 1,
      overrideAccess: true,
    });
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const pubProjectId = relationId(publication.project);
  if (!pubProjectId || pubProjectId !== String(project.id)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  if (!publication.feedPublishedAt) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  let translation: TranslationForMaterial | null = null;
  if (locale !== 'en') {
    const existing = await payload.find({
      collection: 'content-translations',
      where: {
        and: [{ publication: { equals: id } }, { locale: { equals: locale } }],
      },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    });
    const row = existing.docs[0];
    if (row) {
      translation = {
        title: row.title ?? null,
        fields: (row.fields as Summary | undefined) ?? null,
      };
    }
  }

  const mapped: PublicationForMaterial = {
    id: publication.id,
    title: publication.title,
    sourceType: publication.sourceType,
    importance: publication.importance ?? null,
    publishedOrUpdatedAt: publication.publishedOrUpdatedAt ?? null,
    originalUrl: publication.originalUrl,
    abstractOrBody: publication.abstractOrBody ?? null,
    summary: (publication.summary as Summary | null) ?? null,
    monitoredSource: publication.monitoredSource as PublicationForMaterial['monitoredSource'],
  };

  return NextResponse.json(toMaterialDetail(mapped, locale, translation));
}
