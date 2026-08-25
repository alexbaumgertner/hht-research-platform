import { test, expect } from '@playwright/test';

test.describe('admin project config', () => {
  test('admin requires authentication for write UI', async ({ page }) => {
    await page.goto('/admin');
    // Unauthenticated visitors should see login, not project CRUD
    await expect(page.locator('input[name="email"], input[type="email"]').first()).toBeVisible({
      timeout: 60_000,
    });
  });
});
