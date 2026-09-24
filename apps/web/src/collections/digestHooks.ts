/**
 * Helpers for Digests collection hooks.
 * Keep POST /api/digests off the default-depth populate path and avoid a nested
 * Local API transaction (the combination that 504s on Vercel Hobby).
 */

import type { PayloadRequest } from 'payload';

import { classifyWrite } from '../access';

export function resolveRelationshipId(value: unknown): string | number | undefined {
  if (value == null) return undefined;
  if (typeof value === 'object' && 'id' in value) {
    const id = (value as { id: unknown }).id;
    if (typeof id === 'string' || typeof id === 'number') return id;
    return undefined;
  }
  if (typeof value === 'string' || typeof value === 'number') return value;
  return undefined;
}

/** Payload defaultDepth is 2; create must return IDs only so afterRead does not N+1. */
export function capCreateDepth<T>(args: T, operation: string): T {
  if (operation === 'create' && args && typeof args === 'object') {
    (args as { depth?: number }).depth = 0;
  }
  return args;
}

/**
 * Stamp feedPublishedAt on every publication listed in a newly created digest.
 * Shares `req` so Vercel Hobby does not open a second DB transaction (504).
 * No-op when publishedAt is unset.
 */
export async function stampFeedPublishedAt(
  doc: { publications?: unknown; publishedAt?: string | null },
  req: PayloadRequest,
): Promise<void> {
  const publishedAt = doc.publishedAt;
  if (!publishedAt) return;

  const raw = doc.publications;
  if (!Array.isArray(raw) || raw.length === 0) return;

  for (const entry of raw) {
    const id = resolveRelationshipId(entry);
    if (id == null) continue;
    await req.payload.db.updateOne({
      collection: 'publications',
      id,
      data: { feedPublishedAt: publishedAt },
      req,
      returning: false,
    });
  }
}

/**
 * On update, Payload has already merged omitted fields from `originalDoc`, so
 * `publications` is only missing when the stored digest has none. A worker PATCH
 * of issue fields alone must pass.
 */
export function assertDigestHasPublications(
  data: Record<string, unknown> | undefined,
  operation: string,
): void {
  if (!data) return;
  const pubs = data.publications;
  if (operation !== 'create' && pubs === undefined) return;
  if (!Array.isArray(pubs) || pubs.length === 0) {
    throw new Error('Cannot publish an empty digest');
  }
}

function relationshipIdSet(value: unknown): Set<string> {
  const ids = new Set<string>();
  if (!Array.isArray(value)) return ids;
  for (const entry of value) {
    const id = resolveRelationshipId(entry);
    if (id != null) ids.add(String(id));
  }
  return ids;
}

/** Field validator body: issue text may only cite the digest's own publications. */
export function validateRefsWithinDigest(
  value: unknown,
  data: Record<string, unknown> | undefined,
): true | string {
  const refs = Array.isArray(value) ? value : value == null ? [] : [value];
  if (refs.length === 0) return true;
  const allowed = relationshipIdSet(data?.publications);
  for (const ref of refs) {
    const id = resolveRelationshipId(ref);
    if (id == null) continue;
    if (!allowed.has(String(id))) {
      return `Publication ${id} is not in this digest's publications`;
    }
  }
  return true;
}

type IssueSummaryPointInput = { text?: string | null; items?: unknown };
type IssueItemSentenceInput = { publication?: unknown; sentence?: string | null };

export type IssueTextDoc = {
  issueSummaryPoints?: IssueSummaryPointInput[] | null;
  issueItemSentences?: IssueItemSentenceInput[] | null;
  issueTextStatus?: 'pending' | 'ready' | 'failed' | null;
  issueTextAttempts?: number | null;
  issueTextError?: string | null;
  issueTextSource?: 'generated' | 'edited' | null;
  issueTextRevision?: number | null;
};

/**
 * Normalized projection of the English issue text. Array row ids and item order
 * within a point are ignored, so re-saving the same text is not an edit.
 */
export function issueTextFingerprint(doc: IssueTextDoc | null | undefined): string {
  const points = (doc?.issueSummaryPoints ?? []).map((point) => ({
    text: (point?.text ?? '').trim(),
    items: [...relationshipIdSet(point?.items)].sort(),
  }));
  const sentences = (doc?.issueItemSentences ?? [])
    .map((row) => ({
      publication: String(resolveRelationshipId(row?.publication) ?? ''),
      sentence: (row?.sentence ?? '').trim(),
    }))
    .sort((a, b) => (a.publication < b.publication ? -1 : a.publication > b.publication ? 1 : 0));
  return JSON.stringify({ points, sentences });
}

/** Unset (pre-feature digest) is queued too: the sweep selects it like `pending`. */
function isQueued(status: IssueTextDoc['issueTextStatus']): boolean {
  return status == null || status === 'pending';
}

/**
 * Digest `beforeChange` rules (data-model §1). `data` is the merged update:
 * - English text changed → bump `issueTextRevision`.
 * - Owner changed the text → `edited` + `ready`, unless the same save re-queues.
 * - Status moved to `pending` → reset attempts and error.
 */
export function applyIssueTextRules<T extends IssueTextDoc>({
  data,
  originalDoc,
  req,
}: {
  data: T;
  originalDoc: IssueTextDoc | null | undefined;
  req: Parameters<typeof classifyWrite>[0];
}): T {
  if (!originalDoc) return data;

  const textChanged = issueTextFingerprint(data) !== issueTextFingerprint(originalDoc);
  const requeued = data.issueTextStatus === 'pending' && !isQueued(originalDoc.issueTextStatus);

  if (textChanged) {
    data.issueTextRevision = (originalDoc.issueTextRevision ?? 0) + 1;
    if (!requeued && classifyWrite(req) === 'owner') {
      data.issueTextSource = 'edited';
      data.issueTextStatus = 'ready';
      data.issueTextAttempts = 0;
      data.issueTextError = null;
    }
  }

  if (requeued) {
    data.issueTextAttempts = 0;
    data.issueTextError = null;
  }

  return data;
}

/**
 * Cached translations are bound to `issueTextRevision`; drop them when it moves.
 * Shares `req` so the delete runs in the update's transaction (504 lesson).
 */
export async function invalidateIssueTranslations(
  doc: { id?: unknown; issueTextRevision?: number | null },
  previousDoc: { issueTextRevision?: number | null } | null | undefined,
  req: PayloadRequest,
): Promise<void> {
  if (!previousDoc) return;
  if ((doc.issueTextRevision ?? 0) === (previousDoc.issueTextRevision ?? 0)) return;
  const id = resolveRelationshipId(doc.id);
  if (id == null) return;
  await req.payload.db.deleteMany({
    collection: 'issue-translations',
    where: { digest: { equals: id } },
    req,
  });
}
