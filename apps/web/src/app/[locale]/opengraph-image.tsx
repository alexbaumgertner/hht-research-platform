import { SHARE_IMAGE_SIZE, SHARE_IMAGE_TYPE, toLocale } from '@/lib/metadata';
import { renderSiteCard } from '@/lib/shareCards';

export const runtime = 'nodejs';
export const size = SHARE_IMAGE_SIZE;
export const contentType = SHARE_IMAGE_TYPE;

export default async function Image({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return renderSiteCard(toLocale(locale));
}
