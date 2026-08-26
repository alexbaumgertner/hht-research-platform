import { getPayload } from 'payload';
import config from '@payload-config';
import { LocaleSchema, type ContentTranslationLocale, type Summary } from '@hht/shared';
import { NextResponse } from 'next/server';

import { buildMachineTranslationFallbackUrl, summaryToPlainText } from '@/lib/translationFallback';
import { shouldUseCachedTranslation, translateSummary } from '@/lib/translations';

type Params = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Params) {
  const { id } = await params;
  const url = new URL(req.url);
  const localeRaw = url.searchParams.get('locale') || 'en';
  const localeParsed = LocaleSchema.safeParse(localeRaw);
  if (!localeParsed.success) {
    return NextResponse.json({ error: 'Invalid locale' }, { status: 400 });
  }
  const locale = localeParsed.data;

  const payload = await getPayload({ config });
  let publication;
  try {
    publication = await payload.findByID({
      collection: 'publications',
      id,
      depth: 0,
      overrideAccess: true,
    });
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const englishSummary = (publication.summary || null) as Summary | null;
  if (!englishSummary) {
    return NextResponse.json({ error: 'Summary not available' }, { status: 404 });
  }

  let summary: Summary = {
    objective: englishSummary.objective || '',
    methods: englishSummary.methods || '',
    results: englishSummary.results || '',
    limitations: englishSummary.limitations || '',
    whyItMatters: englishSummary.whyItMatters || '',
  };
  let translationFallbackUrl: string | null = null;
  let resolvedLocale = locale;

  if (locale !== 'en') {
    const target = locale as ContentTranslationLocale;
    const existing = await payload.find({
      collection: 'content-translations',
      where: {
        and: [{ publication: { equals: id } }, { locale: { equals: target } }],
      },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    });

    const cached = existing.docs[0]?.fields as Summary | undefined;
    if (shouldUseCachedTranslation(cached)) {
      summary = cached as Summary;
    } else {
      try {
        const translated = await translateSummary(summary, target);
        await payload.create({
          collection: 'content-translations',
          data: {
            publication: publication.id,
            locale: target,
            fields: translated,
          },
          overrideAccess: true,
        });
        summary = translated;
      } catch {
        translationFallbackUrl = buildMachineTranslationFallbackUrl(
          summaryToPlainText(summary),
          target,
        );
        resolvedLocale = 'en';
      }
    }
  }

  return NextResponse.json({
    id: String(publication.id),
    title: publication.title,
    originalUrl: publication.originalUrl,
    importance: publication.importance ?? null,
    locale: resolvedLocale,
    summary,
    translationFallbackUrl,
  });
}
