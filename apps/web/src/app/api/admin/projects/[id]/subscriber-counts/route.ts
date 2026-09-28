import { NextResponse } from 'next/server';
import { getPayload, type Payload } from 'payload';
import config from '@payload-config';

export async function requireAdmin(req: Request): Promise<Payload | null> {
  const payload = await getPayload({ config });
  const { user } = await payload.auth({ headers: req.headers });
  if (!user) return null;
  return payload;
}

type Params = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Params) {
  const payload = await requireAdmin(req);
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const subscribers = await payload.find({
    collection: 'subscribers',
    where: { project: { equals: id } },
    limit: 500,
    depth: 0,
    overrideAccess: true,
  });
  const confirmed: Record<string, number> = {};
  const pending: Record<string, number> = {};
  const confirmedLanguage: Record<string, number> = {};
  const pendingLanguage: Record<string, number> = {};
  for (const row of subscribers.docs) {
    const bucket =
      row.status === 'confirmed' ? confirmed : row.status === 'pending' ? pending : null;
    const languages =
      row.status === 'confirmed'
        ? confirmedLanguage
        : row.status === 'pending'
          ? pendingLanguage
          : null;
    if (!bucket || !languages) continue;
    bucket[row.source] = (bucket[row.source] ?? 0) + 1;
    languages[row.language] = (languages[row.language] ?? 0) + 1;
  }
  return NextResponse.json({ confirmed, pending, confirmedLanguage, pendingLanguage });
}
