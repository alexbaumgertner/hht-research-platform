import type { SubscriptionSource } from '@hht/shared';
import { getPayload } from 'payload';
import config from '@payload-config';

export type AnalyticsMetric =
  'page_view' | 'form_submit' | 'confirmation' | 'widget_view' | 'outbound_click';

/**
 * Anonymous +1 on (project, issueKey, source, metric). Does not read the `src` cookie.
 * `source` must already be resolved (`resolveSubscriptionSource`) or read from a stored row.
 */
export async function incrementAnalyticsCount(input: {
  projectId: string | number;
  issueKey: string;
  source: SubscriptionSource;
  metric: AnalyticsMetric;
}): Promise<void> {
  const source = input.source;
  const payload = await getPayload({ config });
  const existing = await payload.find({
    collection: 'analytics-counts',
    where: {
      and: [
        { project: { equals: input.projectId } },
        { issueKey: { equals: input.issueKey } },
        { source: { equals: source } },
        { metric: { equals: input.metric } },
      ],
    },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  });
  const row = existing.docs[0];
  if (row) {
    await payload.update({
      collection: 'analytics-counts',
      id: row.id,
      data: { count: (row.count ?? 0) + 1 },
      overrideAccess: true,
    });
    return;
  }
  await payload.create({
    collection: 'analytics-counts',
    data: {
      project: Number(input.projectId),
      issueKey: input.issueKey,
      source,
      metric: input.metric,
      count: 1,
    },
    overrideAccess: true,
  });
}
