import { normalizeSubscriberEmail } from '@hht/shared';
import { NextResponse } from 'next/server';
import { getPayload } from 'payload';
import config from '@payload-config';

import { verifySvixSignature } from '@/lib/svixVerify';

type ResendEvent = {
  type?: string;
  data?: { to?: string[] | string; email_id?: string };
};

export async function POST(req: Request) {
  const secret = process.env.RESEND_WEBHOOK_SECRET?.trim() ?? '';
  const rawBody = await req.text();
  if (!secret) return NextResponse.json({ error: 'Not configured' }, { status: 400 });

  const ok = verifySvixSignature({
    secret,
    id: req.headers.get('svix-id'),
    timestamp: req.headers.get('svix-timestamp'),
    signature: req.headers.get('svix-signature'),
    rawBody,
  });
  if (!ok) return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });

  let event: ResendEvent;
  try {
    event = JSON.parse(rawBody) as ResendEvent;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (event.type !== 'email.bounced' && event.type !== 'email.complained') {
    return NextResponse.json({ ok: true });
  }

  try {
    const payload = await getPayload({ config });
    const emailId = event.data?.email_id;
    const addresses = (
      Array.isArray(event.data?.to) ? event.data.to : event.data?.to ? [event.data.to] : []
    )
      .map((value) => normalizeSubscriberEmail(value))
      .filter(Boolean);

    const subscriberIds = new Set<string | number>();
    if (emailId) {
      const deliveries = await payload.find({
        collection: 'issue-deliveries',
        where: { resendEmailId: { equals: emailId } },
        limit: 50,
        depth: 0,
        overrideAccess: true,
      });
      for (const delivery of deliveries.docs) {
        const id =
          typeof delivery.subscriber === 'object' ? delivery.subscriber.id : delivery.subscriber;
        if (id != null) subscriberIds.add(id);
      }
    }
    if (subscriberIds.size === 0 && addresses.length > 0) {
      const subscribers = await payload.find({
        collection: 'subscribers',
        where: { email: { in: addresses } },
        limit: 100,
        depth: 0,
        overrideAccess: true,
      });
      for (const subscriber of subscribers.docs) subscriberIds.add(subscriber.id);
    }

    const now = new Date().toISOString();
    for (const id of subscriberIds) {
      const subscriber = await payload.findByID({
        collection: 'subscribers',
        id: id as number,
        depth: 0,
        overrideAccess: true,
      });
      if (subscriber.status === 'confirmed') {
        await payload.update({
          collection: 'subscribers',
          id,
          data: { status: 'unsubscribed', unsubscribedAt: now },
          overrideAccess: true,
        });
      }
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Write failed' }, { status: 500 });
  }
}
