import 'server-only';

import type { Locale } from '@hht/shared';
import { after } from 'next/server';

import { resolveIssueTranslation } from '@/lib/issueTranslation';
import { createPayloadTranslationStore } from '@/lib/issueTranslationStore';
import { getIssueTranslator } from '@/lib/issueTranslator';
import type { LoadedIssue } from '@/lib/issueQueries';
import { hasIssueText, issueTranslationSource, type IssueTextTranslation } from '@/lib/issues';

/**
 * Wait-then-fallback (spec 005 research R8): the same path for browsers, crawlers
 * and the embed widget, with the wait measured from `deadline`.
 */
export async function translateIssueText(
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
