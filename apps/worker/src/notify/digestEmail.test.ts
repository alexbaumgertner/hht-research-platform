import { assertLinkOnlyEmail, buildDigestEmailPayload } from './digestEmail.js';

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
});
