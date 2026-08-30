import {
  assertLinkOnlyEmail,
  buildDigestEmailPayload,
  sendDigestPublishedEmail,
} from './digestEmail.js';

describe('digest email payload', () => {
  it('includes feed URL and excludes digest body', () => {
    const payload = buildDigestEmailPayload({
      to: 'owner@example.com',
      projectName: 'HHT Research',
      feedUrl: 'https://example.com/en/projects/hht-research',
    });

    expect(payload.feedUrl).toContain('/projects/hht-research');
    expect(payload.bodyText).toContain(payload.feedUrl);
    expect(assertLinkOnlyEmail(payload)).toBe(true);
  });

  it('assertLinkOnlyEmail rejects summary content in the body', () => {
    expect(
      assertLinkOnlyEmail({
        to: 'a@b.c',
        subject: 'x',
        feedUrl: 'https://example.com',
        bodyText: 'Objective: something important',
      }),
    ).toBe(false);
  });
});

describe('sendDigestPublishedEmail', () => {
  const originalKey = process.env.RESEND_API_KEY;
  const originalSite = process.env.PUBLIC_SITE_URL;

  afterEach(() => {
    process.env.RESEND_API_KEY = originalKey;
    process.env.PUBLIC_SITE_URL = originalSite;
  });

  it('skips send when RESEND_API_KEY is missing after passing link-only check', async () => {
    delete process.env.RESEND_API_KEY;
    process.env.PUBLIC_SITE_URL = 'https://example.com';
    await expect(
      sendDigestPublishedEmail({
        to: 'owner@example.com',
        projectName: 'Proj',
        projectId: '1',
        projectSlug: 'proj',
      }),
    ).resolves.toBeUndefined();
  });
});
