import { NextResponse } from 'next/server';

import { requireAdmin } from '../subscriber-counts/route';

type Params = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Params) {
  const payload = await requireAdmin(req);
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const counts = await payload.find({
    collection: 'analytics-counts',
    where: { project: { equals: id } },
    limit: 500,
    depth: 0,
    overrideAccess: true,
  });
  const deliveries = await payload.find({
    collection: 'issue-deliveries',
    where: { and: [{ project: { equals: id } }, { clicked: { equals: true } }] },
    limit: 500,
    depth: 0,
    overrideAccess: true,
  });
  const byIssue = new Map<string, number>();
  const bySubscriber = new Map<string, Set<string>>();
  for (const row of deliveries.docs) {
    const issueId = String(typeof row.digest === 'object' ? row.digest.id : row.digest);
    const subscriberId = String(
      typeof row.subscriber === 'object' ? row.subscriber.id : row.subscriber,
    );
    byIssue.set(issueId, (byIssue.get(issueId) ?? 0) + 1);
    const issues = bySubscriber.get(subscriberId) ?? new Set<string>();
    issues.add(issueId);
    bySubscriber.set(subscriberId, issues);
  }
  let clickedTwoOrMoreIssues = 0;
  for (const issues of bySubscriber.values()) {
    if (issues.size >= 2) clickedTwoOrMoreIssues += 1;
  }
  return NextResponse.json({
    counts: counts.docs.map((row) => ({
      issueKey: row.issueKey,
      source: row.source,
      metric: row.metric,
      count: row.count,
    })),
    clickingSubscribers: [...byIssue.entries()].map(([issueId, count]) => ({ issueId, count })),
    clickedTwoOrMoreIssues,
  });
}
