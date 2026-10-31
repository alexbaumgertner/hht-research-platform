import { revalidateTag } from 'next/cache';

import { getPublicSiteUrl } from '@/lib/siteUrl';

export function embedTag(projectId: string | number): string {
  return `embed:project:${projectId}`;
}

/** Next refuses `revalidateTag` inside a render or a cached function (e.g. `after()` work started there). */
function isRenderContextError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /during render|cached with/.test(message);
}

async function revalidateViaRoute(projectId: string | number): Promise<void> {
  const key = process.env.PAYLOAD_API_KEY;
  if (!key) throw new Error('PAYLOAD_API_KEY is not set');
  const res = await fetch(`${getPublicSiteUrl()}/api/internal/embed/revalidate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-payload-api-key': key },
    body: JSON.stringify({ projectId }),
  });
  if (!res.ok) throw new Error(`revalidate route answered ${res.status}`);
}

/**
 * Expires every cached embed page of a project. Never throws: a failed hook must not block a save.
 * Inside a render context it hands over to the internal route instead (fire and forget).
 */
export function revalidateEmbed(
  projectId: string | number,
  options: { viaRoute?: boolean } = {},
): void {
  const log = (error: unknown) =>
    console.error('[embed] revalidate failed', {
      projectId: String(projectId),
      error: error instanceof Error ? error.message : String(error),
    });
  try {
    revalidateTag(embedTag(projectId), { expire: 0 });
  } catch (error) {
    if (options.viaRoute !== false && isRenderContextError(error)) {
      revalidateViaRoute(projectId).catch(log);
      return;
    }
    log(error);
  }
}
