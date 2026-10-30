import 'server-only';

import { formatEmbedOptions, partnerSource, type EmbedOptions, type Locale } from '@hht/shared';
import { unstable_cache } from 'next/cache';
import { getTranslations } from 'next-intl/server';

import { embedTag } from '@/lib/embed/revalidateEmbed';
import type { EmbedLinks, EmbedModel } from '@/lib/embed/renderEmbed';
import { findProjectBySlug, listVisibleIssues, loadIssueSummary } from '@/lib/issueQueries';
import { ISSUE_TRANSLATION_WAIT_MS } from '@/lib/issueTranslation';
import { translateIssueText } from '@/lib/issueTextTranslation';
import { toIssueDetail } from '@/lib/issues';
import { getPublicSiteUrl } from '@/lib/siteUrl';

export function embedLinks(input: {
  siteUrl: string;
  locale: Locale;
  slug: string;
  issueId: string | null;
  partnerKey: string;
}): EmbedLinks {
  const base = `${input.siteUrl}/${input.locale}`;
  const project = `${base}/projects/${encodeURIComponent(input.slug)}`;
  const src = `src=${partnerSource(input.partnerKey)}`;
  return {
    issue: `${project}/issues/${input.issueId ?? ''}?${src}`,
    archive: `${project}/issues?${src}`,
    subscribe: `${project}?${src}#subscribe`,
    privacy: `${base}/privacy`,
    item: (id) => `${project}/publications/${encodeURIComponent(id)}?${src}`,
  };
}

async function build(
  slug: string,
  partnerKey: string,
  locale: Locale,
  options: EmbedOptions,
): Promise<EmbedModel | null> {
  const deadline = Date.now() + ISSUE_TRANSLATION_WAIT_MS;
  const project = await findProjectBySlug(slug);
  if (!project) return null;
  const partner = project.embedPartners.find((p) => p.key === partnerKey);
  if (!partner) return null;

  const [latest] = await listVisibleIssues(project.id, 1);
  let issue = null;
  if (latest) {
    const [loaded, t] = await Promise.all([
      loadIssueSummary(latest, project, locale),
      getTranslations({ locale, namespace: 'Issue' }),
    ]);
    const translation = await translateIssueText(loaded, locale, deadline);
    issue = toIssueDetail(loaded, locale, t, translation);
  }
  const items = issue ? issue.items.slice(0, options.items) : [];
  return {
    locale,
    options,
    project: { id: project.id, slug: project.slug, name: project.name },
    partner: { key: partner.key, name: partner.name, origins: partner.origins },
    issue,
    items,
    moreCount: issue ? issue.items.length - items.length : 0,
    periodReview: null,
    source: partnerSource(partner.key),
    links: embedLinks({
      siteUrl: getPublicSiteUrl(),
      locale,
      slug: project.slug,
      issueId: issue?.id ?? null,
      partnerKey: partner.key,
    }),
  };
}

/** Cached per project tag (expired by `revalidateEmbed`) for at most one hour. */
export async function loadEmbedModel(input: {
  slug: string;
  partnerKey: string;
  locale: Locale;
  options: EmbedOptions;
}): Promise<EmbedModel | null> {
  const project = await findProjectBySlug(input.slug);
  if (!project) return null;
  const { slug, partnerKey, locale, options } = input;
  return unstable_cache(
    () => build(slug, partnerKey, locale, options),
    ['embed-model', slug, partnerKey, locale, formatEmbedOptions(options)],
    { tags: [embedTag(project.id)], revalidate: 3600 },
  )();
}
