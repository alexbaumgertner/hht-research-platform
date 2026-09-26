'use client';

import { useDocumentInfo } from '@payloadcms/ui';
import { useEffect, useState } from 'react';

type Delivery = {
  counts: Record<string, number>;
  subscriberSendBlockedAt: string | null;
  vk: { status: string; vkPostId?: string | null } | 'not-configured';
};

export function IssueDeliveryStatus() {
  const { id } = useDocumentInfo();
  const [delivery, setDelivery] = useState<Delivery | null>(null);

  async function reload() {
    if (!id) return;
    const res = await fetch(`/api/admin/digests/${id}/delivery`, { credentials: 'include' });
    if (res.ok) setDelivery((await res.json()) as Delivery);
  }

  useEffect(() => {
    if (!id) return;
    void fetch(`/api/admin/digests/${id}/delivery`, { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((body: Delivery | null) => setDelivery(body))
      .catch(() => setDelivery(null));
  }, [id]);

  if (!delivery) return null;
  const failed = delivery.counts.failed ?? 0;

  return (
    <div>
      <p>
        Sent {delivery.counts.sent ?? 0}, pending {delivery.counts.pending ?? 0}, failed {failed},
        skipped {delivery.counts.skipped ?? 0}
      </p>
      <p>VK: {delivery.vk === 'not-configured' ? 'not configured' : delivery.vk.status}</p>
      {failed > 0 ? (
        <button
          type="button"
          onClick={() => {
            void fetch(`/api/admin/digests/${id}/delivery`, {
              method: 'POST',
              credentials: 'include',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'retry-failed' }),
            }).then(() => reload());
          }}
        >
          Retry failed
        </button>
      ) : null}
      {delivery.subscriberSendBlockedAt ? (
        <button
          type="button"
          onClick={() => {
            void fetch(`/api/admin/digests/${id}/delivery`, {
              method: 'POST',
              credentials: 'include',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'send-to-subscribers' }),
            }).then(() => reload());
          }}
        >
          Send to subscribers
        </button>
      ) : null}
      {delivery.vk !== 'not-configured' && delivery.vk.status === 'failed' ? (
        <button
          type="button"
          onClick={() => {
            void fetch(`/api/admin/digests/${id}/delivery`, {
              method: 'POST',
              credentials: 'include',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'retry-vk' }),
            }).then(() => reload());
          }}
        >
          Retry VK
        </button>
      ) : null}
    </div>
  );
}
