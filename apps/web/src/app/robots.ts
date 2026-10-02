import type { MetadataRoute } from 'next';

import { buildRobots } from '@/lib/seo';
import { getPublicSiteUrl } from '@/lib/siteUrl';

export const dynamic = 'force-dynamic';

export default function robots(): MetadataRoute.Robots {
  return buildRobots(getPublicSiteUrl());
}
