import { test, expect } from '@playwright/test';

test.describe('public material detail', () => {
  test('order: header and summary before abstract; original link in new tab', async ({ page }) => {
    await page.goto('/en/projects/hht-research');

    const notFound = page.getByText(/Not found/i);
    if (await notFound.isVisible().catch(() => false)) {
      test.skip(true, 'Seed data required for public material detail');
      return;
    }

    const titleLink = page.locator('article a[href*="/publications/"]').first();
    await expect(titleLink).toBeVisible();
    await titleLink.click();
    await expect(page).toHaveURL(/\/en\/projects\/hht-research\/publications\//);

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByText(/opens in a new tab/i)).toHaveCount(0);

    const original = page.getByRole('link', { name: /view original source/i });
    await expect(original).toBeVisible();
    await expect(original).toHaveAttribute('target', '_blank');
    const rel = await original.getAttribute('rel');
    expect(rel).toMatch(/noopener/);

    const whyHeading = page.getByRole('heading', { name: /why it matters/i });
    const abstractHeading = page.getByRole('heading', { name: /^abstract$/i });
    await expect(whyHeading).toBeVisible();
    await expect(abstractHeading).toBeVisible();

    const originalBox = await original.boundingBox();
    const whyBox = await whyHeading.boundingBox();
    const abstractBox = await abstractHeading.boundingBox();
    expect(originalBox).toBeTruthy();
    expect(whyBox).toBeTruthy();
    expect(abstractBox).toBeTruthy();
    expect(originalBox!.y).toBeLessThan(whyBox!.y);
    expect(whyBox!.y).toBeLessThan(abstractBox!.y);
  });

  test('unknown id shows not-found, not load-error', async ({ page }) => {
    await page.goto('/en/projects/hht-research/publications/000000000000000000000000');
    await expect(page.getByText(/this material could not be found/i)).toBeVisible();
    await expect(page.getByText(/could not be loaded/i)).toHaveCount(0);
    await expect(page.getByRole('link', { name: /back to feed/i })).toBeVisible();
  });

  test('locale switch translates chrome and keeps abstract', async ({ page }) => {
    await page.goto('/en/projects/hht-research');
    if (
      await page
        .getByText(/Not found/i)
        .isVisible()
        .catch(() => false)
    ) {
      test.skip(true, 'Seed data required');
      return;
    }

    await page.locator('article a[href*="/publications/"]').first().click();
    await expect(page).toHaveURL(/\/publications\//);

    const lang = page.getByRole('textbox', { name: /Language/i });
    await lang.click();
    await page.getByRole('option', { name: /Deutsch/i }).click();

    await expect(page).toHaveURL(/\/de\/projects\/hht-research\/publications\//);
    await expect(page.getByRole('link', { name: /zurück zum feed/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /ziel/i })).toBeVisible();
    await expect(page.getByText(/auf englisch angezeigt/i).first()).toBeVisible();
  });
});
