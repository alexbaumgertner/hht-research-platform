import { findProjectBySlug, getVisibleIssue, loadIssueSummary } from '@/lib/issueQueries';
import { SHARE_IMAGE_SIZE, SHARE_IMAGE_TYPE, toLocale } from '@/lib/metadata';
import { renderIssueCard, renderProjectCard, renderSiteCard } from '@/lib/shareCards';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const size = SHARE_IMAGE_SIZE;
export const contentType = SHARE_IMAGE_TYPE;

type Props = { params: Promise<{ locale: string; slug: string; issueId: string }> };

export default async function Image({ params }: Props) {
  const { locale: rawLocale, slug, issueId } = await params;
  const locale = toLocale(rawLocale);

  let project;
  try {
    project = await findProjectBySlug(slug);
  } catch (error) {
    console.error('[og] project lookup failed, serving site card', { slug, error });
  }
  if (!project) return renderSiteCard(locale);

  try {
    const digest = await getVisibleIssue(project.id, issueId);
    if (digest) {
      // English skips publication translations; the card only needs the visible item count.
      const loaded = await loadIssueSummary(digest, project, 'en');
      return await renderIssueCard(locale, {
        projectName: project.name,
        date: digest.publishedAt,
        itemCount: loaded.publications.length,
      });
    }
  } catch (error) {
    console.error('[og] issue card failed, serving project card', { slug, issueId, error });
  }

  return renderProjectCard(locale, project.name);
}
