import { revalidateTag } from 'next/cache';

export function embedTag(projectId: string | number): string {
  return `embed:project:${projectId}`;
}

/** Expires every cached embed page of a project. Never throws: a failed hook must not block a save. */
export function revalidateEmbed(projectId: string | number): void {
  try {
    revalidateTag(embedTag(projectId), { expire: 0 });
  } catch (error) {
    console.error('[embed] revalidate failed', {
      projectId: String(projectId),
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
