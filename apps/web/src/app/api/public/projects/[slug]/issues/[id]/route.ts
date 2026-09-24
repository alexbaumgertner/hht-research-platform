import { LocaleSchema, type Locale } from '@hht/shared';
import { NextResponse } from 'next/server';
import { getTranslations } from 'next-intl/server';

import { findProjectBySlug, getVisibleIssue, loadIssueSummary } from '@/lib/issueQueries';
import { toIssueDetail } from '@/lib/issues';

type Params = { params: Promise<{ slug: string; id: string }> };

export const maxDuration = 60;

const NO_STORE = { 'Cache-Control': 'no-store' };

export async function GET(req: Request, { params }: Params) {
  const { slug, id } = await params;
  const url = new URL(req.url);
  const localeRaw = url.searchParams.get('locale') || 'en';
  const localeParsed = LocaleSchema.safeParse(localeRaw);
  if (!localeParsed.success) {
    return NextResponse.json({ error: 'Invalid locale' }, { status: 400 });
  }
  const locale: Locale = localeParsed.data;

  const project = await findProjectBySlug(slug);
  if (!project) {
    return NextResponse.json({ error: 'Not found' }, { status: 404, headers: NO_STORE });
  }

  const digest = await getVisibleIssue(project.id, id);
  if (!digest) {
    return NextResponse.json({ error: 'Not found' }, { status: 404, headers: NO_STORE });
  }

  const [loaded, t] = await Promise.all([
    loadIssueSummary(digest, project, locale),
    getTranslations({ locale, namespace: 'Issue' }),
  ]);
  const detail = toIssueDetail(loaded, locale, t, 'not-needed');

  return NextResponse.json(detail, { headers: NO_STORE });
}
