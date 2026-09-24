import { LocaleSchema, type Locale } from '@hht/shared';
import { after, NextResponse } from 'next/server';
import { getTranslations } from 'next-intl/server';

import {
  findProjectBySlug,
  getVisibleIssue,
  loadIssueSummary,
  type LoadedIssue,
} from '@/lib/issueQueries';
import { ISSUE_TRANSLATION_WAIT_MS, resolveIssueTranslation } from '@/lib/issueTranslation';
import { createPayloadTranslationStore } from '@/lib/issueTranslationStore';
import { getIssueTranslator } from '@/lib/issueTranslator';
import {
  hasIssueText,
  issueTranslationSource,
  toIssueDetail,
  type IssueTextTranslation,
} from '@/lib/issues';

type Params = { params: Promise<{ slug: string; id: string }> };

export const maxDuration = 60;

const NO_STORE = { 'Cache-Control': 'no-store' };

/**
 * Wait-then-fallback (research R8): the same path for browsers and crawlers, with
 * the 8 s budget measured from the start of the handler.
 */
async function translateIssueText(
  loaded: LoadedIssue,
  locale: Locale,
  deadline: number,
): Promise<IssueTextTranslation> {
  if (locale === 'en') return { status: 'not-needed' };

  const source = issueTranslationSource(loaded);
  if (!hasIssueText(source)) return { status: 'unavailable' };

  const translator = getIssueTranslator();
  if (!translator) return { status: 'failed' };

  try {
    return await resolveIssueTranslation({
      store: createPayloadTranslationStore(),
      translator,
      key: { digestId: String(loaded.digest.id), locale },
      revision: loaded.digest.issueTextRevision ?? 0,
      source,
      deadline,
      keepAlive: (work) => after(work),
      log: (message, context) => console.error(`[issue-translation] ${message}`, context),
    });
  } catch (error) {
    console.error('[issue-translation] lookup failed', {
      digestId: String(loaded.digest.id),
      locale,
      error: error instanceof Error ? error.message : String(error),
    });
    return { status: 'failed' };
  }
}

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
  const translation = await translateIssueText(loaded, locale, deadline);
  const detail = toIssueDetail(loaded, locale, t, translation);

  return NextResponse.json(detail, { headers: NO_STORE });
}
