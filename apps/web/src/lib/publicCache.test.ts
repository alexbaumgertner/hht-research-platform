import { PUBLIC_CACHE_CONTROL, revalidatePublicContent } from './publicCache';

describe('publicCache', () => {
  it('lets the CDN cache for minutes, not hours, so a publish shows up quickly', () => {
    expect(PUBLIC_CACHE_CONTROL).toBe('public, s-maxage=300, stale-while-revalidate=300');
  });

  it('is a no-op outside a Next request (hooks run from seeds and tests)', () => {
    expect(() => revalidatePublicContent()).not.toThrow();
  });
});
