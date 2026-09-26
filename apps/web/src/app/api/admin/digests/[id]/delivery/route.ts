import { NextResponse } from 'next/server';

import { requireAdmin } from '../../../projects/[id]/subscriber-counts/route';

type Params = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Params) {
  const payload = await requireAdmin(req);
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const digest = await payload.findByID({
    collection: 'digests',
    id,
    depth: 0,
    overrideAccess: true,
  });
  const project = await payload.findByID({
    collection: 'research-projects',
    id: typeof digest.project === 'object' ? digest.project.id : digest.project,
    depth: 0,
    overrideAccess: true,
  });
  const deliveries = await payload.find({
    collection: 'issue-deliveries',
    where: { digest: { equals: id } },
    limit: 500,
    depth: 0,
    overrideAccess: true,
  });
  const counts: Record<string, number> = {};
  for (const row of deliveries.docs) {
    counts[row.status] = (counts[row.status] ?? 0) + 1;
  }
  const vkRows = await payload.find({
    collection: 'vk-posts',
    where: { digest: { equals: id } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  });
  const vk = project.vkCommunityId
    ? {
        status: vkRows.docs[0]?.status ?? 'pending',
        vkPostId: vkRows.docs[0]?.vkPostId ?? null,
      }
    : 'not-configured';
  return NextResponse.json({
    counts,
    subscriberSendBlockedAt: digest.subscriberSendBlockedAt ?? null,
    vk,
  });
}

export async function POST(req: Request, { params }: Params) {
  const payload = await requireAdmin(req);
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const body = (await req.json()) as { action?: string };
  if (body.action === 'retry-failed') {
    const failed = await payload.find({
      collection: 'issue-deliveries',
      where: { and: [{ digest: { equals: id } }, { status: { equals: 'failed' } }] },
      limit: 200,
      depth: 0,
      overrideAccess: true,
    });
    for (const row of failed.docs) {
      await payload.update({
        collection: 'issue-deliveries',
        id: row.id,
        data: { status: 'pending', attempts: 0, nextAttemptAt: null },
        overrideAccess: true,
      });
    }
  } else if (body.action === 'send-to-subscribers') {
    await payload.update({
      collection: 'digests',
      id,
      data: { subscriberSendBlockedAt: null },
      overrideAccess: true,
    });
  } else if (body.action === 'retry-vk') {
    const failed = await payload.find({
      collection: 'vk-posts',
      where: { and: [{ digest: { equals: id } }, { status: { equals: 'failed' } }] },
      limit: 5,
      depth: 0,
      overrideAccess: true,
    });
    for (const row of failed.docs) {
      await payload.update({
        collection: 'vk-posts',
        id: row.id,
        data: { status: 'pending' },
        overrideAccess: true,
      });
    }
  } else {
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
