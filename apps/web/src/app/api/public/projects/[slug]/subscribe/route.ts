import { normalizeSubscriberEmail, parseChatSource, type EmailLanguage } from '@hht/shared';
import { NextResponse } from 'next/server';
import { getPayload } from 'payload';
import config from '@payload-config';

import { incrementAnalyticsCount } from '@/lib/analyticsCounts';
import { getPublicSiteUrl } from '@/lib/siteUrl';
import { consumeSubscribeRateLimit } from '@/lib/subscribeRateLimit';
import {
  newConfirmationToken,
  sameAddress,
  sendConfirmationEmail,
  subscriberMailEnabled,
} from '@/lib/subscriberMail';

type Notice = 'need_consent' | 'bad_email' | 'try_later' | 'check_inbox';

function clientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]?.trim() || 'unknown';
  return req.headers.get('x-real-ip')?.trim() || 'unknown';
}

function isEmailSyntax(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 320) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}

function redirectNotice(req: Request, slug: string, notice: Notice): Response {
  const site = getPublicSiteUrl();
  let target = new URL(`/en/projects/${slug}`, site);
  const referer = req.headers.get('referer');
  if (referer) {
    try {
      const url = new URL(referer);
      if (url.origin === new URL(site).origin) target = url;
    } catch {
      // Keep the project page.
    }
  }
  target.searchParams.set('notice', notice);
  return NextResponse.redirect(target, 303);
}

type Params = { params: Promise<{ slug: string }> };

export async function POST(req: Request, { params }: Params) {
  const { slug } = await params;
  const form = await req.formData();
  const consent = form.get('consent');
  const emailRaw = String(form.get('email') ?? '');
  const languageRaw = String(form.get('language') ?? '');
  const honeypot = String(form.get('company') ?? '').trim();
  const src = parseChatSource(String(form.get('src') ?? ''));
  const issueKey = String(form.get('issue') ?? '').trim() || 'none';
  const language: EmailLanguage = languageRaw === 'ru' ? 'ru' : 'en';

  if (consent !== 'yes') return redirectNotice(req, slug, 'need_consent');
  if (!isEmailSyntax(emailRaw)) return redirectNotice(req, slug, 'bad_email');

  const payload = await getPayload({ config });
  const projects = await payload.find({
    collection: 'research-projects',
    where: { slug: { equals: slug } },
    limit: 1,
    depth: 1,
    overrideAccess: true,
  });
  const project = projects.docs[0];
  if (!project) return redirectNotice(req, slug, 'try_later');

  const email = normalizeSubscriberEmail(emailRaw);
  if (honeypot.length === 0) {
    await incrementAnalyticsCount({
      projectId: project.id,
      issueKey,
      source: src,
      metric: 'form_submit',
    });
  }

  if ((await consumeSubscribeRateLimit(clientIp(req))) === 'limited') {
    return redirectNotice(req, slug, 'try_later');
  }
  if (honeypot.length > 0) return redirectNotice(req, slug, 'check_inbox');

  const owner =
    project.owner && typeof project.owner === 'object' && 'email' in project.owner
      ? String(project.owner.email ?? '')
      : '';
  const ownerMatch = owner.length > 0 && sameAddress(email, owner);
  if (!subscriberMailEnabled() && !ownerMatch) {
    return redirectNotice(req, slug, 'check_inbox');
  }

  const existing = await payload.find({
    collection: 'subscribers',
    where: { and: [{ project: { equals: project.id } }, { email: { equals: email } }] },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  });
  const row = existing.docs[0];
  if (row?.status === 'confirmed') return redirectNotice(req, slug, 'check_inbox');

  const hourAgo = Date.now() - 60 * 60 * 1000;
  if (row?.status === 'pending' && row.confirmationSentAt) {
    const sentAt = new Date(row.confirmationSentAt).getTime();
    if (!Number.isNaN(sentAt) && sentAt > hourAgo) {
      return redirectNotice(req, slug, 'check_inbox');
    }
  }

  if (row?.status === 'unsubscribed') {
    await payload.delete({ collection: 'subscribers', id: row.id, overrideAccess: true });
  }

  const token = newConfirmationToken();
  const senderName = project.emailFromName?.trim() || project.name;
  const replyTo = owner || null;

  if (row?.status === 'pending') {
    const previous = {
      confirmationTokenHash: row.confirmationTokenHash,
      confirmationExpiresAt: row.confirmationExpiresAt,
      confirmationSentAt: row.confirmationSentAt,
    };
    await payload.update({
      collection: 'subscribers',
      id: row.id,
      data: {
        language,
        source: src,
        confirmationTokenHash: token.hash,
        confirmationExpiresAt: token.confirmationExpiresAt,
        confirmationSentAt: token.confirmationSentAt,
      },
      overrideAccess: true,
    });
    try {
      await sendConfirmationEmail({
        to: email,
        language,
        projectName: senderName,
        replyTo,
        subscriberId: row.id,
        token: token.token,
        tokenHash: token.hash,
      });
    } catch {
      await payload.update({
        collection: 'subscribers',
        id: row.id,
        data: previous,
        overrideAccess: true,
      });
      return redirectNotice(req, slug, 'try_later');
    }
    return redirectNotice(req, slug, 'check_inbox');
  }

  const created = await payload.create({
    collection: 'subscribers',
    data: {
      project: project.id,
      email,
      language,
      source: src,
      status: 'pending',
      consentAt: new Date().toISOString(),
      confirmationTokenHash: token.hash,
      confirmationExpiresAt: token.confirmationExpiresAt,
      confirmationSentAt: token.confirmationSentAt,
    },
    overrideAccess: true,
  });
  try {
    await sendConfirmationEmail({
      to: email,
      language,
      projectName: senderName,
      replyTo,
      subscriberId: created.id,
      token: token.token,
      tokenHash: token.hash,
    });
  } catch {
    await payload.delete({ collection: 'subscribers', id: created.id, overrideAccess: true });
    return redirectNotice(req, slug, 'try_later');
  }
  return redirectNotice(req, slug, 'check_inbox');
}
