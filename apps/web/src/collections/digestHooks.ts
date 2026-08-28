/**
 * Helpers for Digests collection hooks.
 * Keep POST /api/digests off the default-depth populate path and avoid a nested
 * Local API transaction (the combination that 504s on Vercel Hobby).
 */

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
