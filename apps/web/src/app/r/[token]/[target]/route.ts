import { NextResponse } from 'next/server';
import { getPayload } from 'payload';
import config from '@payload-config';

import { resolveClickRedirect, type ClickRow } from '@/lib/clickRedirect';
import { getPublicSiteUrl } from '@/lib/siteUrl';
import { hashSubscriptionToken } from '@/lib/subscriptionTokens';

type Params = { params: Promise<{ token: string; target: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { token, target } = await params;
  const payload = await getPayload({ config });
  const hash = hashSubscriptionToken(token);
  const found = await payload.find({
    collection: 'issue-deliveries',
    where: { clickTokenHash: { equals: hash } },
    limit: 1,
    depth: 1,
    overrideAccess: true,
  });
  const delivery = found.docs[0];
  let row: ClickRow | null = null;
  if (delivery) {
    const digest = delivery.digest;
    const subscriber = delivery.subscriber;
    const digestId = typeof digest === 'object' ? digest.id : digest;
    const projectRef = typeof digest === 'object' ? digest.project : null;
    let slug = '';
    if (projectRef && typeof projectRef === 'object' && 'slug' in projectRef) {
      slug = String(projectRef.slug);
    } else if (projectRef) {
      const project = await payload.findByID({
        collection: 'research-projects',
        id: projectRef as number,
        depth: 0,
        overrideAccess: true,
      });
      slug = String(project.slug);
    }
    const language = typeof subscriber === 'object' && subscriber.language === 'ru' ? 'ru' : 'en';
    const source = typeof subscriber === 'object' ? (subscriber.source ?? 'other') : 'other';
    row = {
      language,
      slug,
      digestId: String(digestId),
      source,
      clicked: Boolean(delivery.clicked),
    };
  }

  const result = await resolveClickRedirect({
    siteUrl: getPublicSiteUrl(),
    target,
    row,
    markClicked: async () => {
      if (!delivery) return;
      await payload.update({
        collection: 'issue-deliveries',
        id: delivery.id,
        data: { clicked: true },
        overrideAccess: true,
      });
    },
  });
  return NextResponse.redirect(result.location, 302);
}
