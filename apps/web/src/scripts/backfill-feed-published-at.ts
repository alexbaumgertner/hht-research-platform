/**
 * One-time backfill: set feedPublishedAt = digest.publishedAt for every
 * publication already listed on a digest, only when unset (idempotent).
 *
 * Usage: pnpm --filter @hht/web exec tsx src/scripts/backfill-feed-published-at.ts
 */
import { getPayload } from 'payload';
import config from '@payload-config';

async function backfill() {
  const payload = await getPayload({ config });

  const projects = await payload.find({
    collection: 'research-projects',
    limit: 500,
    depth: 0,
    overrideAccess: true,
  });

  for (const project of projects.docs) {
    let updated = 0;

    const digests = await payload.find({
      collection: 'digests',
      where: { project: { equals: project.id } },
      limit: 500,
      depth: 0,
      overrideAccess: true,
    });

    for (const digest of digests.docs) {
      const publishedAt = digest.publishedAt;
      if (!publishedAt) continue;

      // `ensure-schema` deletes the generated payload-types before `next build`,
      // so `digest.publications` is loosely typed there — annotate explicitly.
      const rawPubs = (digest.publications ?? []) as Array<number | { id?: number }>;
      const pubIds = rawPubs
        .map((p) => (typeof p === 'object' && p !== null ? p.id : p))
        .filter((id): id is number => typeof id === 'number');

      for (const pubId of pubIds) {
        let pub;
        try {
          pub = await payload.findByID({
            collection: 'publications',
            id: pubId,
            depth: 0,
            overrideAccess: true,
          });
        } catch {
          continue;
        }
        if (pub.feedPublishedAt) continue;

        await payload.update({
          collection: 'publications',
          id: pubId,
          data: { feedPublishedAt: publishedAt },
          overrideAccess: true,
        });
        updated += 1;
      }
    }

    console.log(`project=${project.slug ?? project.id} feedPublishedAt backfilled=${updated}`);
  }

  process.exit(0);
}

backfill().catch((err) => {
  console.error(err);
  process.exit(1);
});
