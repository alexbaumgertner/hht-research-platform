import { buildIframeSnippet, buildScriptSnippet, type Locale } from '@hht/shared';
import { NextResponse } from 'next/server';
import { getTranslations } from 'next-intl/server';

import { requireAdmin } from '../subscriber-counts/route';
import { embedPartnersOf } from '@/lib/embed/partners';
import { getPublicSiteUrl } from '@/lib/siteUrl';

type Params = { params: Promise<{ id: string }> };

const LOCALES: Locale[] = ['ru', 'en'];

/** Ready-to-paste snippets for every saved partner, in Russian and English. */
export async function GET(req: Request, { params }: Params) {
  const payload = await requireAdmin(req);
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const project = await payload.findByID({
    collection: 'research-projects',
    id,
    depth: 0,
    overrideAccess: true,
  });
  const siteUrl = getPublicSiteUrl();
  const partners = await Promise.all(
    embedPartnersOf(project).map(async (partner) => ({
      key: partner.key,
      name: partner.name,
      snippets: await Promise.all(
        LOCALES.map(async (locale) => {
          const t = await getTranslations({ locale, namespace: 'Widget' });
          const target = { siteUrl, project: String(project.slug), partner: partner.key, locale };
          return {
            locale,
            script: buildScriptSnippet({
              ...target,
              items: 3,
              theme: 'auto',
              subscribe: 'form',
              fallback: {
                sentence: t('fallbackSentence'),
                communityLabel: t('fallbackCommunity'),
                communityUrl: partner.fallbackCommunityUrl ?? undefined,
                subscribeLabel: t('fallbackSubscribe'),
              },
            }),
            frame: buildIframeSnippet({
              ...target,
              options: { theme: 'auto', items: 3, mode: 'form' },
              title: t('frameTitle', { projectName: String(project.name) }),
              height: 900,
            }),
          };
        }),
      ),
    })),
  );
  return NextResponse.json({ partners });
}
