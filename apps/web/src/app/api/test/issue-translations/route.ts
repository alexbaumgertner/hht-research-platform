import { NextResponse } from 'next/server';
import { getPayload } from 'payload';
import config from '@payload-config';
import { z } from 'zod';

import { relationIds } from '@/lib/issueTypes';
import { isStubTranslatorEnabled, stubInvocationKey, stubState } from '@/lib/issueTranslator';

/**
 * Test-only (research R16): lets the single-flight spec start from "no row" on
 * every CI retry and read what the requests left behind. Exists only with the
 * stub translator, never on a production deployment.
 */

const NO_STORE = { 'Cache-Control': 'no-store' };
const LOCALES = ['de', 'tr', 'ru', 'uk'] as const;

function notFound() {
  return NextResponse.json({ error: 'Not found' }, { status: 404, headers: NO_STORE });
}

const DigestIdSchema = z.coerce.number().int().positive();

const PostSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('reset'),
    digest: DigestIdSchema,
    stubDelayMs: z.number().int().min(0).max(60_000).optional(),
  }),
  z.object({
    action: z.literal('edit-first-point'),
    digest: DigestIdSchema,
    text: z.string().trim().min(1),
  }),
]);

export async function GET(req: Request) {
  if (!isStubTranslatorEnabled()) return notFound();

  const parsed = DigestIdSchema.safeParse(new URL(req.url).searchParams.get('digest'));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid digest' }, { status: 400, headers: NO_STORE });
  }
  const digest = parsed.data;

  const payload = await getPayload({ config });
  const rows = await payload.find({
    collection: 'issue-translations',
    where: { digest: { equals: digest } },
    depth: 0,
    pagination: false,
    overrideAccess: true,
  });

  const { invocations } = stubState();
  return NextResponse.json(
    {
      rows: rows.docs.map((row) => ({
        locale: row.locale,
        status: row.status,
        attempts: row.attempts,
        sourceRevision: row.sourceRevision,
      })),
      invocations: Object.fromEntries(
        LOCALES.map((locale) => [
          locale,
          invocations.get(stubInvocationKey(String(digest), locale)) ?? 0,
        ]),
      ),
    },
    { headers: NO_STORE },
  );
}

export async function POST(req: Request) {
  if (!isStubTranslatorEnabled()) return notFound();

  const parsed = PostSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400, headers: NO_STORE });
  }
  const body = parsed.data;
  const payload = await getPayload({ config });

  if (body.action === 'reset') {
    await payload.delete({
      collection: 'issue-translations',
      where: { digest: { equals: body.digest } },
      overrideAccess: true,
    });
    const state = stubState();
    for (const locale of LOCALES) {
      state.invocations.delete(stubInvocationKey(String(body.digest), locale));
    }
    if (body.stubDelayMs === undefined) state.delayOverrides.delete(String(body.digest));
    else state.delayOverrides.set(String(body.digest), body.stubDelayMs);
    return NextResponse.json({ ok: true }, { headers: NO_STORE });
  }

  // A real update through the Digests hooks, so the spec sees the production
  // invalidation path (revision bump + afterChange delete).
  const digest = await payload.findByID({
    collection: 'digests',
    id: body.digest,
    depth: 0,
    overrideAccess: true,
  });
  const stored = (digest.issueSummaryPoints ?? []) as Array<{ text: string; items?: unknown }>;
  const points = stored.map((point, index) => ({
    text: index === 0 ? body.text : point.text,
    items: relationIds(point.items).map(Number),
  }));
  if (points.length === 0) {
    return NextResponse.json(
      { error: 'Digest has no summary' },
      { status: 400, headers: NO_STORE },
    );
  }

  const updated = await payload.update({
    collection: 'digests',
    id: body.digest,
    data: { issueSummaryPoints: points },
    depth: 0,
    overrideAccess: true,
  });
  return NextResponse.json(
    { ok: true, issueTextRevision: updated.issueTextRevision ?? 0 },
    { headers: NO_STORE },
  );
}
