import { NextResponse } from 'next/server';
import { getPayload } from 'payload';
import config from '@payload-config';

import { isEmailStubEnabled } from '@/lib/email';

type Params = { params: Promise<{ id: string }> };

/** Test-only: flips `hiddenFromPublic` through Payload so the real hooks run. */
export async function POST(req: Request, { params }: Params) {
  if (!isEmailStubEnabled()) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as { hidden?: unknown } | null;
  if (typeof body?.hidden !== 'boolean') {
    return NextResponse.json({ error: 'hidden must be a boolean' }, { status: 400 });
  }
  const payload = await getPayload({ config });
  await payload.update({
    collection: 'digests',
    id,
    data: { hiddenFromPublic: body.hidden },
    overrideAccess: true,
  });
  return NextResponse.json({ ok: true });
}
