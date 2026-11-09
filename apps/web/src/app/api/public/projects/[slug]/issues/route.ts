import { LocaleSchema, type Locale } from '@hht/shared';
import { NextResponse } from 'next/server';

import { findProjectBySlug, listVisibleIssues, loadIssueSummary } from '@/lib/issueQueries';
import { findReadyIssueTranslations } from '@/lib/issueTranslationStore';
import { toIssueSummaryListItem } from '@/lib/issues';
import { cachePublicRead, NO_STORE_HEADERS, PUBLIC_CACHE_HEADERS } from '@/lib/publicCache';

type Params = { params: Promise<{ slug: string }> };

// Non-English lists show translations that land without a content hook, so refresh sooner.
const TRANSLATED_LIST_REVALIDATE_SECONDS = 300;

function parseLimit(raw: string | null): number | 'invalid' {
  if (raw == null || raw === '') return 100;
  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value) || value < 1 || value > 100) return 'invalid';
  return value;
}

async function loadIssueList(slug: string, locale: Locale, limit: number) {
  const project = await findProjectBySlug(slug);
  if (!project) return null;

  const digests = await listVisibleIssues(project.id, limit);
  const [loadedIssues, translations] = await Promise.all([
    Promise.all(digests.map((digest) => loadIssueSummary(digest, project, locale))),
    locale === 'en'
      ? Promise.resolve(new Map<string, never>())
      : findReadyIssueTranslations(digests, locale),
  ]);

  const docs = loadedIssues.map((loaded) =>
    toIssueSummaryListItem(
      loaded.digest,
      loaded.publications,
      locale,
      translations.get(String(loaded.digest.id))?.summaryPoints[0] ?? null,
    ),
  );

  docs.sort((a, b) => {
    const byDate = b.date.localeCompare(a.date);
    if (byDate !== 0) return byDate;
    return b.id.localeCompare(a.id);
  });

  return docs;
}

const loadIssueListEn = cachePublicRead('issues', loadIssueList);
const loadIssueListTranslated = cachePublicRead(
  'issues-translated',
  loadIssueList,
  TRANSLATED_LIST_REVALIDATE_SECONDS,
);

export async function GET(req: Request, { params }: Params) {
  const { slug } = await params;
  const url = new URL(req.url);
  const localeRaw = url.searchParams.get('locale') || 'en';
  const localeParsed = LocaleSchema.safeParse(localeRaw);
  if (!localeParsed.success) {
    return NextResponse.json({ error: 'Invalid locale' }, { status: 400 });
  }
  const locale: Locale = localeParsed.data;

  const limit = parseLimit(url.searchParams.get('limit'));
  if (limit === 'invalid') {
    return NextResponse.json({ error: 'Invalid limit' }, { status: 400 });
  }

  const load = locale === 'en' ? loadIssueListEn : loadIssueListTranslated;
  const docs = await load(slug, locale, limit);
  if (!docs) {
    return NextResponse.json({ error: 'Not found' }, { status: 404, headers: NO_STORE_HEADERS });
  }

  return NextResponse.json({ docs }, { headers: PUBLIC_CACHE_HEADERS });
}
