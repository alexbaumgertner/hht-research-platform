import { findProjectBySlug } from '@/lib/issueQueries';
import { SHARE_IMAGE_SIZE, SHARE_IMAGE_TYPE, toLocale } from '@/lib/metadata';
import { renderProjectCard, renderSiteCard } from '@/lib/shareCards';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const size = SHARE_IMAGE_SIZE;
export const contentType = SHARE_IMAGE_TYPE;

type Props = { params: Promise<{ locale: string; slug: string }> };

export default async function Image({ params }: Props) {
  const { locale: rawLocale, slug } = await params;
  const locale = toLocale(rawLocale);

  try {
    const project = await findProjectBySlug(slug);
    if (project) return await renderProjectCard(locale, project.name);
  } catch (error) {
    console.error('[og] project card failed, serving site card', { slug, error });
  }

  return renderSiteCard(locale);
}
