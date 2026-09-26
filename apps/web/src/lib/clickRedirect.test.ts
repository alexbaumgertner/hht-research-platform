import { clickDestination, resolveClickRedirect, type ClickRow } from './clickRedirect';

const siteUrl = 'https://example.com';
const row: ClickRow = {
  language: 'en',
  slug: 'demo',
  digestId: '9',
  source: 'fb',
  clicked: false,
};

describe('click redirect', () => {
  it('sets clicked once for a known token and still redirects when the write throws', async () => {
    let writes = 0;
    const first = await resolveClickRedirect({
      siteUrl,
      target: 'issue',
      row,
      markClicked: async () => {
        writes += 1;
      },
    });
    expect(first).toEqual({
      status: 302,
      location: 'https://example.com/en/projects/demo/issues/9',
    });
    expect(writes).toBe(1);

    const again = await resolveClickRedirect({
      siteUrl,
      target: 'issue',
      row: { ...row, clicked: true },
      markClicked: async () => {
        writes += 1;
      },
    });
    expect(again.status).toBe(302);
    expect(writes).toBe(1);

    const broken = await resolveClickRedirect({
      siteUrl,
      target: 'privacy',
      row,
      markClicked: async () => {
        throw new Error('db down');
      },
    });
    expect(broken).toEqual({ status: 302, location: 'https://example.com/en/privacy' });
  });

  it('redirects an unknown token to the site root', async () => {
    const result = await resolveClickRedirect({
      siteUrl,
      target: 'issue',
      row: null,
      markClicked: async () => {
        throw new Error('should not write');
      },
    });
    expect(result).toEqual({ status: 302, location: 'https://example.com' });
  });

  it('matches issue, privacy, and subscribe targets', () => {
    expect(clickDestination({ siteUrl, target: 'issue', row })).toBe(
      'https://example.com/en/projects/demo/issues/9',
    );
    expect(clickDestination({ siteUrl, target: 'privacy', row })).toBe(
      'https://example.com/en/privacy',
    );
    expect(clickDestination({ siteUrl, target: 'subscribe', row })).toBe(
      'https://example.com/en/projects/demo?src=fb#subscribe',
    );
    expect(clickDestination({ siteUrl, target: 'nope', row })).toBe('https://example.com');
  });
});
