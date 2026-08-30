/**
 * Helpers for Digests collection hooks.
 * Keep POST /api/digests off the default-depth populate path and avoid a nested
 * Local API transaction (the combination that 504s on Vercel Hobby).
 */

import type { PayloadRequest } from 'payload';

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
