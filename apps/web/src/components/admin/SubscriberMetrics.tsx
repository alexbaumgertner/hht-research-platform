'use client';

import { useDocumentInfo } from '@payloadcms/ui';
import { useEffect, useState } from 'react';

type Metrics = {
  counts: Array<{ issueKey: string; source: string; metric: string; count: number }>;
  clickingSubscribers: Array<{ issueId: string; count: number }>;
  clickedTwoOrMoreIssues: number;
};

export function SubscriberMetrics() {
  const { id } = useDocumentInfo();
  const [metrics, setMetrics] = useState<Metrics | null>(null);

  useEffect(() => {
    if (!id) return;
    void fetch(`/api/admin/projects/${id}/subscriber-metrics`, { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((body: Metrics | null) => setMetrics(body))
      .catch(() => setMetrics(null));
  }, [id]);

  if (!metrics) return null;
  return (
    <div>
      <p>Clicked in two or more issues: {metrics.clickedTwoOrMoreIssues}</p>
      <ul>
        {metrics.clickingSubscribers.map((row) => (
          <li key={row.issueId}>
            Issue {row.issueId}: {row.count} clicking subscribers
          </li>
        ))}
      </ul>
      <ul>
        {metrics.counts.map((row) => (
          <li key={`${row.issueKey}-${row.source}-${row.metric}`}>
            {row.metric} / {row.source} / {row.issueKey}: {row.count}
          </li>
        ))}
      </ul>
    </div>
  );
}
