import { NextResponse } from 'next/server';
import { getPayload } from 'payload';
import config from '@payload-config';

import { hashSubscriptionToken } from '@/lib/subscriptionTokens';

type Params = { params: Promise<{ token: string }> };

async function unsubscribe(token: string): Promise<void> {
  const payload = await getPayload({ config });
  const hash = hashSubscriptionToken(token);
  const found = await payload.find({
    collection: 'subscribers',
    where: { unsubscribeTokenHash: { equals: hash } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  });
  const row = found.docs[0];
  if (row?.status === 'confirmed') {
    await payload.update({
      collection: 'subscribers',
      id: row.id,
      data: { status: 'unsubscribed', unsubscribedAt: new Date().toISOString() },
      overrideAccess: true,
    });
  }
}

export async function POST(req: Request, { params }: Params) {
  const { token } = await params;
  const contentType = req.headers.get('content-type') ?? '';
  if (contentType.includes('application/x-www-form-urlencoded')) {
    await req.formData();
  }
  await unsubscribe(token);
  return new NextResponse(null, { status: 200 });
}

export function GET() {
  return new NextResponse(null, { status: 405 });
}
