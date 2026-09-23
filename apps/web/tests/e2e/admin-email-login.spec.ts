import { expect, test } from '@playwright/test';

test.describe('admin email-code login', () => {
  test('login page asks for an email and has no password field', async ({ page }) => {
    await page.goto('/admin/login');
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Send login code' })).toBeVisible();
    await expect(page.locator('input[type="password"]')).toHaveCount(0);
  });

  test('password login is disabled on the API', async ({ request }) => {
    const res = await request.post('/api/users/login', {
      data: { email: 'someone@example.com', password: 'anything' },
    });
    expect(res.status()).toBeGreaterThanOrEqual(400);
  });

  test('requesting a code does not reveal whether the address is an admin', async ({ request }) => {
    const res = await request.post('/api/auth/request-code', {
      data: { email: `unknown-${Date.now()}@example.com` },
      headers: { 'x-forwarded-for': `203.0.113.${Math.floor(Math.random() * 250)}` },
    });
    expect(res.status()).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  test('a wrong code is rejected', async ({ request }) => {
    const res = await request.post('/api/auth/verify-code', {
      data: { email: 'unknown@example.com', code: '123456' },
    });
    expect(res.status()).toBe(401);
  });
});
