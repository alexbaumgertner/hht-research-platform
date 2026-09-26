'use client';

import { useDocumentInfo } from '@payloadcms/ui';
import { useEffect, useState } from 'react';

type Counts = { confirmed: Record<string, number>; pending: Record<string, number> };

export function SubscriberCounts() {
  const { id } = useDocumentInfo();
  const [counts, setCounts] = useState<Counts | null>(null);

  useEffect(() => {
    if (!id) return;
    void fetch(`/api/admin/projects/${id}/subscriber-counts`, { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((body: Counts | null) => setCounts(body))
      .catch(() => setCounts(null));
  }, [id]);

  if (!counts) return null;
  return (
    <div>
      <p>Confirmed by source: {JSON.stringify(counts.confirmed)}</p>
      <p>Pending by source: {JSON.stringify(counts.pending)}</p>
    </div>
  );
}
