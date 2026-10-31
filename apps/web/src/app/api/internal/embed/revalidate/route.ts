import { NextResponse } from 'next/server';

import { safeEqualString } from '@/access';
import { revalidateEmbed } from '@/lib/embed/revalidateEmbed';

/**
 * `revalidateTag` is refused while a page or a cached function is rendering. A background
 * translation that finishes there asks this route to do it from a clean request context.
 */
export async function POST(req: Request) {
  const expected = process.env.PAYLOAD_API_KEY;
  const provided = req.headers.get('x-payload-api-key');
  if (!expected || !provided || !safeEqualString(provided, expected)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const body = (await req.json().catch(() => null)) as { projectId?: unknown } | null;
  const projectId = body?.projectId;
  if (typeof projectId !== 'string' && typeof projectId !== 'number') {
    return NextResponse.json({ error: 'projectId required' }, { status: 400 });
  }
  revalidateEmbed(projectId, { viaRoute: false });
  return NextResponse.json({ ok: true });
}
