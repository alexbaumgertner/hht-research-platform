import { LocaleSchema, type Locale } from '@hht/shared';
import { NextResponse } from 'next/server';
import { getTranslations } from 'next-intl/server';

import { findProjectBySlug, getVisibleIssue, loadIssueSummary } from '@/lib/issueQueries';
import { ISSUE_TRANSLATION_WAIT_MS } from '@/lib/issueTranslation';
import { translateIssueText } from '@/lib/issueTextTranslation';
import { toIssueDetail } from '@/lib/issues';
import { NO_STORE_HEADERS } from '@/lib/publicCache';

type Params = { params: Promise<{ slug: string; id: string }> };

export const maxDuration = 60;

export async function GET(req: Request, { params }: Params) {
  const deadline = Date.now() + ISSUE_TRANSLATION_WAIT_MS;
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
    return NextResponse.json({ error: 'Not found' }, { status: 404, headers: NO_STORE_HEADERS });
  }

  const digest = await getVisibleIssue(project.id, id);
  if (!digest) {
    return NextResponse.json({ error: 'Not found' }, { status: 404, headers: NO_STORE_HEADERS });
  }

  const [loaded, t] = await Promise.all([
    loadIssueSummary(digest, project, locale),
    getTranslations({ locale, namespace: 'Issue' }),
  ]);
  const translation = await translateIssueText(loaded, locale, deadline);
  const detail = toIssueDetail(loaded, locale, t, translation);

  // Never CDN-cached: a hidden or deleted issue must 404 at once, and a discarded translation
  // must not outlive the edit that invalidated it. Purging every CDN variant is not possible.
  return NextResponse.json(detail, { headers: NO_STORE_HEADERS });
}
