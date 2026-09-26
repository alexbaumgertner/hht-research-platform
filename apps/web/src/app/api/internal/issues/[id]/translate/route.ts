import { NextResponse } from 'next/server';
import { getPayload } from 'payload';
import config from '@payload-config';

import { safeEqualString } from '@/access';
import { resolveIssueTranslation } from '@/lib/issueTranslation';
import { createPayloadTranslationStore } from '@/lib/issueTranslationStore';
import { getIssueTranslator, type IssueText } from '@/lib/issueTranslator';
import { relationId } from '@/lib/issueTypes';

export const maxDuration = 60;

const DEADLINE_MS = 50_000;

type Params = { params: Promise<{ id: string }> };

type DigestTextSource = {
  issueSummaryPoints?: Array<{ text?: string | null }> | null;
  issueItemSentences?: Array<{ publication?: unknown; sentence?: string | null }> | null;
};

function sourceFromDigest(digest: object): IssueText {
  // Generated Payload interfaces and the untyped JsonObject fallback both
  // satisfy `object`; the field list is local so neither pass needs generated types.
  const doc = digest as DigestTextSource;
  return {
    summaryPoints: (doc.issueSummaryPoints ?? []).map((point) => point.text ?? ''),
    itemSentences: (doc.issueItemSentences ?? []).flatMap((row) => {
      const publicationId = relationId(row.publication);
      return publicationId && row.sentence ? [{ publicationId, sentence: row.sentence }] : [];
    }),
  };
}

export async function POST(req: Request, { params }: Params) {
  const expected = process.env.PAYLOAD_API_KEY;
  const provided = req.headers.get('x-payload-api-key');
  if (!expected || !provided || !safeEqualString(provided, expected)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  let body: { locale?: string };
  try {
    body = (await req.json()) as { locale?: string };
  } catch {
    return NextResponse.json({ status: 'failed' }, { status: 400 });
  }
  if (body.locale !== 'ru') {
    return NextResponse.json({ status: 'unavailable' });
  }

  const payload = await getPayload({ config });
  let digest;
  try {
    digest = await payload.findByID({
      collection: 'digests',
      id,
      depth: 0,
      overrideAccess: true,
    });
  } catch {
    return NextResponse.json({ status: 'unavailable' });
  }

  const source = sourceFromDigest(digest);
  if (source.summaryPoints.length === 0 && source.itemSentences.length === 0) {
    return NextResponse.json({ status: 'unavailable' });
  }

  const translator = getIssueTranslator();
  if (!translator) return NextResponse.json({ status: 'failed' });

  const outcome = await resolveIssueTranslation({
    store: createPayloadTranslationStore(),
    translator,
    key: { digestId: String(digest.id), locale: 'ru' },
    revision: digest.issueTextRevision ?? 0,
    source,
    deadline: Date.now() + DEADLINE_MS,
    keepAlive: () => {},
  });

  if (outcome.status !== 'ready') {
    return NextResponse.json({ status: outcome.status === 'pending' ? 'failed' : outcome.status });
  }
  return NextResponse.json({ status: 'ready', text: outcome.text });
}
