export type DigestEmailPayload = {
  to: string;
  subject: string;
  feedUrl: string;
  bodyText: string;
};

export function buildDigestEmailPayload(input: {
  to: string;
  projectName: string;
  feedUrl: string;
}): DigestEmailPayload {
  return {
    to: input.to,
    subject: `New digest: ${input.projectName}`,
    feedUrl: input.feedUrl,
    bodyText: `A new research digest was published for ${input.projectName}.\n\nOpen the feed: ${input.feedUrl}\n`,
  };
}

/** Ensures notification is link-only (no digest body). */
export function assertLinkOnlyEmail(payload: DigestEmailPayload): boolean {
  const forbidden = [/objective:/i, /methods:/i, /results:/i, /why it matters/i];
  return Boolean(payload.feedUrl) && !forbidden.some((re) => re.test(payload.bodyText));
}

export async function sendDigestPublishedEmail(input: {
  to: string;
  projectName: string;
  projectSlug?: string;
  projectId: string;
}): Promise<void> {
  const site = (process.env.PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '');
  const slug = input.projectSlug || input.projectId;
  const feedUrl = `${site}/en/projects/${slug}`;
  const payload = buildDigestEmailPayload({
    to: input.to,
    projectName: input.projectName,
    feedUrl,
  });

  if (!assertLinkOnlyEmail(payload)) {
    throw new Error('Digest email failed link-only check; refusing to send');
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn('[notify] RESEND_API_KEY missing; skipping email');
    return;
  }

  const { Resend } = await import('resend');
  const resend = new Resend(apiKey);
  await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev',
    to: payload.to,
    subject: payload.subject,
    text: payload.bodyText,
  });
}
