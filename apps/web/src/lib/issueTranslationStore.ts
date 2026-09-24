import 'server-only';

import { getPayload, type Where } from 'payload';
import config from '@payload-config';

import { relationId } from '@/lib/issueTypes';
import type { IssueText, IssueTranslationLocale } from '@/lib/issueTranslator';
import type { TranslationKey, TranslationRow, TranslationStore } from '@/lib/issueTranslation';

// Postgres ids are numeric; the generated Payload types require `number`.
function numericId(id: string): number {
  return Number(id);
}

function toDate(value: unknown): Date | null {
  if (typeof value !== 'string' || !value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

// `object`, not `Record<string, unknown>`: generated Payload interfaces have no index signature.
export function mapTranslationRow(source: object): TranslationRow {
  const doc = source as Record<string, unknown>;
  const points = (doc.summaryPoints as Array<{ text?: string | null }> | null | undefined) ?? [];
  const sentences =
    (doc.itemSentences as Array<{ publication?: unknown; sentence?: string | null }> | null) ?? [];
  const status = doc.status as TranslationRow['status'];

  const text: IssueText | null =
    status === 'ready'
      ? {
          summaryPoints: points.map((point) => point.text ?? ''),
          itemSentences: sentences.flatMap((row) => {
            const publicationId = relationId(row.publication);
            return publicationId && row.sentence ? [{ publicationId, sentence: row.sentence }] : [];
          }),
        }
      : null;

  return {
    id: String(doc.id),
    status,
    sourceRevision: Number(doc.sourceRevision ?? 0),
    leaseExpiresAt: toDate(doc.leaseExpiresAt),
    retryAfter: toDate(doc.retryAfter),
    attempts: Number(doc.attempts ?? 1),
    text,
  };
}

/**
 * Cached translations for a listing: only `ready` rows at each digest's current
 * revision. Read-only — listings never claim or start a translation.
 */
export async function findReadyIssueTranslations(
  digests: Array<{ id: string | number; issueTextRevision?: number | null }>,
  locale: IssueTranslationLocale,
): Promise<Map<string, IssueText>> {
  const byDigest = new Map<string, IssueText>();
  if (digests.length === 0) return byDigest;

  const revisionById = new Map(digests.map((d) => [String(d.id), d.issueTextRevision ?? 0]));
  const payload = await getPayload({ config });
  const result = await payload.find({
    collection: 'issue-translations',
    where: {
      and: [
        { digest: { in: [...revisionById.keys()].map(numericId) } },
        { locale: { equals: locale } },
        { status: { equals: 'ready' } },
      ],
    },
    limit: digests.length,
    depth: 0,
    overrideAccess: true,
  });

  for (const doc of result.docs) {
    const digestId = relationId((doc as { digest?: unknown }).digest);
    if (!digestId) continue;
    const row = mapTranslationRow(doc);
    if (row.text && row.sourceRevision === revisionById.get(digestId)) {
      byDigest.set(digestId, row.text);
    }
  }
  return byDigest;
}

function keyWhere(key: TranslationKey): Where {
  return {
    and: [{ digest: { equals: numericId(key.digestId) } }, { locale: { equals: key.locale } }],
  };
}

export function createPayloadTranslationStore(): TranslationStore {
  return {
    async find(key) {
      const payload = await getPayload({ config });
      const result = await payload.find({
        collection: 'issue-translations',
        where: keyWhere(key),
        limit: 1,
        depth: 0,
        pagination: false,
        overrideAccess: true,
      });
      const doc = result.docs[0];
      return doc ? mapTranslationRow(doc) : null;
    },

    async create(key, claim) {
      const payload = await getPayload({ config });
      const doc = await payload.create({
        collection: 'issue-translations',
        data: {
          digest: numericId(key.digestId),
          locale: key.locale,
          status: 'pending',
          sourceRevision: claim.sourceRevision,
          leaseExpiresAt: claim.leaseExpiresAt.toISOString(),
          attempts: claim.attempts,
        },
        depth: 0,
        overrideAccess: true,
      });
      return mapTranslationRow(doc);
    },

    async deleteById(id) {
      const payload = await getPayload({ config });
      // A concurrent reclaimer may already have deleted it; either way the row is gone.
      await payload.delete({
        collection: 'issue-translations',
        where: { id: { equals: numericId(id) } },
        overrideAccess: true,
      });
    },

    async finish(id, result) {
      const payload = await getPayload({ config });
      const data =
        result.status === 'ready'
          ? {
              status: 'ready' as const,
              leaseExpiresAt: null,
              error: null,
              summaryPoints: result.text.summaryPoints.map((text) => ({ text })),
              itemSentences: result.text.itemSentences.map((row) => ({
                publication: numericId(row.publicationId),
                sentence: row.sentence,
              })),
            }
          : {
              status: 'failed' as const,
              leaseExpiresAt: null,
              retryAfter: result.retryAfter.toISOString(),
              error: result.error,
            };

      const updated = await payload.update({
        collection: 'issue-translations',
        where: { id: { equals: numericId(id) } },
        data,
        depth: 0,
        overrideAccess: true,
      });
      return updated.docs.length > 0;
    },
  };
}
