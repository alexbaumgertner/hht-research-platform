import { getPayload } from 'payload';
import config from '@payload-config';
import { NextResponse } from 'next/server';

import { buildHealthReport } from '@/lib/health';

export const dynamic = 'force-dynamic';

/**
 * Public monitoring health: 200 when every public project's pipeline ran on
 * schedule, 503 when one is overdue. Polled by a Cloud Monitoring uptime check
 * (dead-man switch for the worker).
 */
export async function GET() {
  const payload = await getPayload({ config });

  const projects = await payload.find({
    collection: 'research-projects',
    where: { hasPublishedDigest: { equals: true } },
    depth: 0,
    limit: 100,
    overrideAccess: true,
  });

  const rows = await Promise.all(
    projects.docs.map(async (project) => {
      const digests = await payload.find({
        collection: 'digests',
        where: { project: { equals: project.id } },
        sort: '-publishedAt',
        limit: 1,
        depth: 0,
        overrideAccess: true,
      });
      return {
        slug: project.slug,
        schedule: project.schedule,
        monitoringStatus: project.monitoringStatus,
        lastSuccessfulRunAt: project.lastSuccessfulRunAt ?? null,
        latestDigestPublishedAt: digests.docs[0]?.publishedAt ?? null,
        anchor: {
          publishWeekday: project.publishWeekday ?? null,
          publishHourUtc: project.publishHourUtc ?? null,
        },
      };
    }),
  );

  const report = buildHealthReport(rows);
  return NextResponse.json(report, {
    status: report.ok ? 200 : 503,
    headers: { 'Cache-Control': 'no-store' },
  });
}
