import { test, expect } from '@playwright/test';

test.describe('public feed', () => {
  test('home → project feed → importance filter → publication detail', async ({ page }) => {
    await page.goto('/en');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    const projectLink = page
      .getByRole('link')
      .filter({ hasText: /HHT|Research/i })
      .first();
    const empty = page.getByText(/No published projects yet/i);

    if (await empty.isVisible().catch(() => false)) {
      test.skip(true, 'Seed data required for full public-feed path');
      return;
    }

    await projectLink.click();
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    const filter = page.getByLabel(/Importance|Wichtigkeit|Önem|Важность|Важливість/i);
    if (await filter.isVisible()) {
      await filter.click();
      await page.getByRole('option').first().click();
    }

    const pubLink = page.locator('a[href*="/publications/"]').first();
    if (await pubLink.count()) {
      await pubLink.click();
      await expect(
        page.getByRole('link', { name: /original|source|quelle|kaynağı|источник|джерело/i }),
      ).toBeVisible();
    }
  });
});
