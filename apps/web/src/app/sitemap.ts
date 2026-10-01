import type { MetadataRoute } from 'next';
import { getPayload } from 'payload';
import config from '@payload-config';

import { buildSitemap, type SitemapProject } from '@/lib/seo';
import { getPublicSiteUrl } from '@/lib/siteUrl';

export const dynamic = 'force-dynamic';

/** Same visibility rules as the public API: published projects, visible issues, feed materials. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const payload = await getPayload({ config });
  const projects = await payload.find({
    collection: 'research-projects',
    where: { hasPublishedDigest: { equals: true } },
    pagination: false,
    depth: 0,
    overrideAccess: true,
  });

  const entries: SitemapProject[] = await Promise.all(
    projects.docs.map(async (project) => {
      const [issues, materials] = await Promise.all([
        payload.find({
          collection: 'digests',
          where: {
            and: [{ project: { equals: project.id } }, { hiddenFromPublic: { not_equals: true } }],
          },
          sort: '-publishedAt',
          pagination: false,
          depth: 0,
          overrideAccess: true,
        }),
        payload.find({
          collection: 'publications',
          where: {
            and: [{ project: { equals: project.id } }, { feedPublishedAt: { exists: true } }],
          },
          pagination: false,
          depth: 0,
          overrideAccess: true,
        }),
      ]);
      return {
        slug: project.slug,
        issues: issues.docs.map((doc) => ({
          id: String(doc.id),
          updatedAt: doc.updatedAt ?? null,
        })),
        materials: materials.docs.map((doc) => ({
          id: String(doc.id),
          updatedAt: doc.updatedAt ?? null,
        })),
      };
    }),
  );

  return buildSitemap(getPublicSiteUrl(), entries);
}
