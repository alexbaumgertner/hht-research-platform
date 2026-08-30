import { test, expect } from '@playwright/test';

const LOCALES = ['en', 'de', 'tr', 'ru', 'uk'] as const;

test.describe('i18n locales', () => {
  for (const locale of LOCALES) {
    test(`renders home chrome for ${locale}`, async ({ page }) => {
      await page.goto(`/${locale}`);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      // Mantine Select exposes the control as a textbox with accessible name from label/aria-label
      await expect(
        page.getByRole('textbox', { name: /Language|Sprache|Dil|Язык|Мова/i }),
      ).toBeVisible();
    });
  }
});
