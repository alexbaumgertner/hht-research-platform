import { expect, test } from '@playwright/test';

// Check the original response as well as the login page: following redirects
// automatically could hide missing protection on /admin itself.
for (const path of [
  '/',
  '/en',
  '/admin',
  '/admin/login',
  '/api/public/projects',
  '/api/users/me',
]) {
  test(`denies framing on ${path}`, async ({ request }) => {
    const response = await request.get(path, { maxRedirects: 0 });
    expect(response.status()).toBeGreaterThanOrEqual(200);
    expect(response.status()).toBeLessThan(400);
    expect(response.headers()['x-frame-options']).toBe('DENY');
    expect(response.headers()['content-security-policy']).toMatch(
      /(?:^|;)\s*frame-ancestors\s+'none'\s*(?:;|$)/,
    );
  });
}
