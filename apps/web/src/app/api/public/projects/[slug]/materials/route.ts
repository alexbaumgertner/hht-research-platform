import { getPayload } from 'payload';
import config from '@payload-config';
import { LocaleSchema, type Locale, type Summary } from '@hht/shared';
import { NextResponse } from 'next/server';

import {
  sortMaterialsByDateDesc,
  toMaterial,
  type PublicationForMaterial,
  type TranslationForMaterial,
} from '@/lib/materials';

type Params = { params: Promise<{ slug: string }> };

export async function GET(req: Request, { params }: Params) {
  const { slug } = await params;
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

  const publications = await payload.find({
    collection: 'publications',
    where: {
      and: [{ project: { equals: project.id } }, { feedPublishedAt: { exists: true } }],
    },
    depth: 1,
    limit: 200,
    overrideAccess: true,
  });

  const pubIds = publications.docs.map((p) => p.id);
  const translationByPubId = new Map<string, TranslationForMaterial>();

  if (locale !== 'en' && pubIds.length > 0) {
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
      const pubRef = row.publication;
      const pubId =
        typeof pubRef === 'object' && pubRef && 'id' in pubRef ? String(pubRef.id) : String(pubRef);
      translationByPubId.set(pubId, {
        title: row.title ?? null,
        fields: (row.fields as Summary | undefined) ?? null,
      });
    }
  }

  const materials = publications.docs.map((doc) => {
    const publication: PublicationForMaterial = {
      id: doc.id,
      title: doc.title,
      sourceType: doc.sourceType,
      importance: doc.importance ?? null,
      publishedOrUpdatedAt: doc.publishedOrUpdatedAt ?? null,
      originalUrl: doc.originalUrl,
      summary: (doc.summary as Summary | null) ?? null,
      monitoredSource: doc.monitoredSource as PublicationForMaterial['monitoredSource'],
    };
    return toMaterial(publication, locale, translationByPubId.get(String(doc.id)) ?? null);
  });

  return NextResponse.json({ docs: sortMaterialsByDateDesc(materials) });
}
